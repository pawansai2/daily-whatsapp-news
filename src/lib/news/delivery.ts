import {
  getSupabaseAdmin,
} from "@/lib/supabase/admin";

import {
  createTitleHash,
  fetchNews,
  filterAndRankStories,
} from "@/lib/news/provider";

import {
  buildTelegramDigest,
} from "@/lib/news/digest";

import {
  buildNewsOccurrenceKey,
  getLocalClock,
  getScheduledForIso,
  parseDeliveryMinutes,
} from "@/lib/news/schedule";

import {
  sendTelegramMessageToChat,
} from "@/lib/telegram/client";

const DELIVERY_TYPE =
  "daily_telegram";

const PROCESSING_STALE_MS =
  10 * 60 * 1000;

const FAILURE_RETRY_MS =
  5 * 60 * 1000;

export type NewsDeliverySettings = {
  owner_id: string;
  digest_enabled: boolean;
  language: string | null;
  country: string | null;
  state: string | null;
  district: string | null;
  city: string | null;
  timezone: string | null;
  delivery_time: string;
  story_limit: number | null;
  custom_keywords: unknown;
};

type ExistingDelivery = {
  id: string;
  status: string;
  attempt_count: number | null;
  updated_at: string;
};

export type NewsDeliveryResult = {
  ownerId: string;
  status:
    | "sent"
    | "skipped"
    | "failed";
  reason?: string;
  localDate?: string;
  deliveryTime?: string;
  fetched?: number;
  eligible?: number;
  sent?: number;
  messageId?: number;
};

function uniqueStrings(
  values: string[],
): string[] {
  const unique =
    new Map<
      string,
      string
    >();

  for (const rawValue of values) {
    const value =
      rawValue.trim();

    if (!value) {
      continue;
    }

    const key =
      value.toLowerCase();

    if (!unique.has(key)) {
      unique.set(
        key,
        value,
      );
    }
  }

  return Array.from(
    unique.values(),
  );
}

async function updateDeliveryStatus(
  deliveryId: string,
  status: string,
  failureCode:
    string | null,
) {
  const supabase =
    getSupabaseAdmin();

  const now =
    new Date().toISOString();

  const {
    error,
  } = await supabase
    .from("deliveries")
    .update({
      status,
      failure_code:
        failureCode,
      updated_at: now,
    })
    .eq(
      "id",
      deliveryId,
    );

  if (error) {
    console.error(
      "dispatcher_delivery_status_update_failed",
      {
        deliveryId,
        status,
        code: error.code,
      },
    );
  }

  return error;
}

export async function runNewsDeliveryForUser(
  settings: NewsDeliverySettings,
  chatId: string,
  now: Date = new Date(),
): Promise<NewsDeliveryResult> {
  const supabase =
    getSupabaseAdmin();

  const timezone =
    settings.timezone ||
    "Asia/Kolkata";

  let localClock;
  let deliveryMinutes;
  let scheduledFor;

  try {
    localClock =
      getLocalClock(
        timezone,
        now,
      );

    deliveryMinutes =
      parseDeliveryMinutes(
        settings.delivery_time,
      );

    scheduledFor =
      getScheduledForIso(
        localClock.localDate,
        settings.delivery_time,
        timezone,
      );
  } catch (error) {
    return {
      ownerId:
        settings.owner_id,
      status: "failed",
      reason:
        error instanceof Error
          ? error.message
          : "invalid_schedule",
    };
  }

  if (
    localClock.minutes <
    deliveryMinutes
  ) {
    return {
      ownerId:
        settings.owner_id,
      status: "skipped",
      reason: "not_due",
      localDate:
        localClock.localDate,
      deliveryTime:
        settings.delivery_time,
    };
  }

  const occurrenceKey =
    buildNewsOccurrenceKey(
      localClock.localDate,
      settings.delivery_time,
    );

  const {
    data: occurrenceDelivery,
    error: occurrenceError,
  } = await supabase
    .from("deliveries")
    .select(
      "id,status,attempt_count,updated_at",
    )
    .eq(
      "owner_id",
      settings.owner_id,
    )
    .eq(
      "delivery_type",
      DELIVERY_TYPE,
    )
    .eq(
      "idempotency_key",
      occurrenceKey,
    )
    .maybeSingle();

  if (occurrenceError) {
    return {
      ownerId:
        settings.owner_id,
      status: "failed",
      reason:
        "delivery_lookup_failed",
    };
  }

  let existing =
    occurrenceDelivery as
      ExistingDelivery |
      null;

  /*
   * Preserve compatibility with deliveries
   * created before occurrence keys existed.
   */
  if (!existing) {
    const {
      data: legacyDelivery,
      error: legacyError,
    } = await supabase
      .from("deliveries")
      .select(
        "id,status,attempt_count,updated_at",
      )
      .eq(
        "owner_id",
        settings.owner_id,
      )
      .eq(
        "delivery_type",
        DELIVERY_TYPE,
      )
      .eq(
        "local_delivery_date",
        localClock.localDate,
      )
      .like(
        "idempotency_key",
        "legacy:%",
      )
      .maybeSingle();

    if (legacyError) {
      return {
        ownerId:
          settings.owner_id,
        status: "failed",
        reason:
          "legacy_delivery_lookup_failed",
      };
    }

    existing =
      legacyDelivery as
        ExistingDelivery |
        null;
  }

  if (
    existing?.status ===
      "sent"
  ) {
    return {
      ownerId:
        settings.owner_id,
      status: "skipped",
      reason:
        "already_sent",
      localDate:
        localClock.localDate,
      deliveryTime:
        settings.delivery_time,
    };
  }

  if (
    existing?.status ===
      "skipped"
  ) {
    return {
      ownerId:
        settings.owner_id,
      status: "skipped",
      reason:
        "occurrence_skipped",
      localDate:
        localClock.localDate,
      deliveryTime:
        settings.delivery_time,
    };
  }

  if (existing) {
    const updatedTime =
      new Date(
        existing.updated_at,
      ).getTime();

    const age =
      Number.isFinite(
        updatedTime,
      )
        ? now.getTime() -
          updatedTime
        : Number.POSITIVE_INFINITY;

    if (
      existing.status ===
        "processing" &&
      age <
        PROCESSING_STALE_MS
    ) {
      return {
        ownerId:
          settings.owner_id,
        status: "skipped",
        reason:
          "already_processing",
      };
    }

    if (
      existing.status ===
        "failed" &&
      age <
        FAILURE_RETRY_MS
    ) {
      return {
        ownerId:
          settings.owner_id,
        status: "skipped",
        reason:
          "retry_cooldown",
      };
    }
  }

  let deliveryId:
    string | null =
    existing?.id ?? null;

  if (deliveryId && existing) {
    const nextAttempt =
      Number(
        existing.attempt_count ??
          0,
      ) + 1;

    const {
      data: locked,
      error: lockError,
    } = await supabase
      .from("deliveries")
      .update({
        status:
          "processing",
        attempt_count:
          nextAttempt,
        failure_code: null,
        scheduled_for:
          scheduledFor,
        updated_at:
          now.toISOString(),
      })
      .eq(
        "id",
        deliveryId,
      )
      .eq(
        "updated_at",
        existing.updated_at,
      )
      .select("id");

    if (lockError) {
      return {
        ownerId:
          settings.owner_id,
        status: "failed",
        reason:
          "delivery_lock_failed",
      };
    }

    if (
      !locked ||
      locked.length === 0
    ) {
      return {
        ownerId:
          settings.owner_id,
        status: "skipped",
        reason:
          "delivery_lock_taken",
      };
    }
  } else {
    const {
      data: inserted,
      error: insertError,
    } = await supabase
      .from("deliveries")
      .insert({
        owner_id:
          settings.owner_id,
        local_delivery_date:
          localClock.localDate,
        delivery_type:
          DELIVERY_TYPE,
        idempotency_key:
          occurrenceKey,
        reference_id:
          "settings:daily-news",
        scheduled_for:
          scheduledFor,
        status:
          "processing",
        attempt_count: 1,
      })
      .select("id")
      .single();

    if (insertError) {
      if (
        insertError.code ===
        "23505"
      ) {
        return {
          ownerId:
            settings.owner_id,
          status: "skipped",
          reason:
            "delivery_lock_taken",
        };
      }

      return {
        ownerId:
          settings.owner_id,
        status: "failed",
        reason:
          "delivery_create_failed",
      };
    }

    deliveryId =
      inserted.id;
  }

  const sentCutoff =
    new Date(
      now.getTime() -
        30 *
          24 *
          60 *
          60 *
          1000,
    ).toISOString();

  const [
    {
      data: interestRows,
      error: interestsError,
    },
    {
      data: sentRows,
      error: sentError,
    },
  ] = await Promise.all([
    supabase
      .from(
        "personal_interests",
      )
      .select(
        "display_name",
      )
      .eq(
        "owner_id",
        settings.owner_id,
      )
      .order(
        "created_at",
        {
          ascending: true,
        },
      ),

    supabase
      .from(
        "sent_article_hashes",
      )
      .select(
        "url_hash",
      )
      .eq(
        "owner_id",
        settings.owner_id,
      )
      .gte(
        "sent_at",
        sentCutoff,
      )
      .limit(1000),
  ]);

  if (
    interestsError ||
    sentError
  ) {
    if (deliveryId) {
      await updateDeliveryStatus(
        deliveryId,
        "failed",
        interestsError
          ? "INTERESTS_QUERY_FAILED"
          : "SENT_HISTORY_QUERY_FAILED",
      );
    }

    return {
      ownerId:
        settings.owner_id,
      status: "failed",
      reason:
        interestsError
          ? "interests_query_failed"
          : "sent_history_query_failed",
    };
  }

  const customKeywords =
    Array.isArray(
      settings.custom_keywords,
    )
      ? settings.custom_keywords.filter(
          (
            value: unknown,
          ): value is string =>
            typeof value ===
            "string",
        )
      : [];

  const interests =
    uniqueStrings([
      ...(interestRows ?? [])
        .map(
          (row) =>
            row.display_name,
        )
        .filter(
          (
            value,
          ): value is string =>
            typeof value ===
            "string",
        ),
      ...customKeywords,
    ]);

  const effectiveInterests =
    interests.length > 0
      ? interests
      : [
          "Technology",
          "Science",
        ];

  let stories;

  try {
    stories =
      await fetchNews(
        effectiveInterests,
        settings.language ??
          "en",
        {
          country:
            settings.country ??
            undefined,
          state:
            settings.state ??
            undefined,
          district:
            settings.district ??
            undefined,
          city:
            settings.city ??
            undefined,
        },
      );
  } catch (error) {
    console.error(
      "dispatcher_news_fetch_failed",
      {
        ownerId:
          settings.owner_id,
        message:
          error instanceof Error
            ? error.message
            : "unknown",
      },
    );

    if (deliveryId) {
      await updateDeliveryStatus(
        deliveryId,
        "failed",
        "NEWS_FETCH_FAILED",
      );
    }

    return {
      ownerId:
        settings.owner_id,
      status: "failed",
      reason:
        "news_fetch_failed",
    };
  }

  const sentHashes =
    (sentRows ?? [])
      .map(
        (row) =>
          row.url_hash,
      )
      .filter(
        (
          value,
        ): value is string =>
          typeof value ===
          "string",
      );

  const rankedStories =
    filterAndRankStories(
      stories,
      sentHashes,
    );

  const storyLimit =
    Math.min(
      20,
      Math.max(
        1,
        Number(
          settings.story_limit ??
            10,
        ),
      ),
    );

  const selectedStories =
    rankedStories.slice(
      0,
      storyLimit,
    );

  if (
    selectedStories.length ===
      0
  ) {
    if (deliveryId) {
      await updateDeliveryStatus(
        deliveryId,
        "skipped",
        "NO_FRESH_STORIES",
      );
    }

    return {
      ownerId:
        settings.owner_id,
      status: "skipped",
      reason:
        "no_fresh_stories",
      localDate:
        localClock.localDate,
      deliveryTime:
        settings.delivery_time,
      fetched:
        stories.length,
      eligible: 0,
      sent: 0,
    };
  }

  const message =
    buildTelegramDigest({
      stories:
        selectedStories,
      interests:
        effectiveInterests,
      timezone,
    });

  let messageId:
    number;

  try {
    messageId =
      await sendTelegramMessageToChat(
        chatId,
        message,
      );
  } catch (error) {
    console.error(
      "dispatcher_telegram_send_failed",
      {
        ownerId:
          settings.owner_id,
        message:
          error instanceof Error
            ? error.message
            : "unknown",
      },
    );

    if (deliveryId) {
      await updateDeliveryStatus(
        deliveryId,
        "failed",
        "TELEGRAM_SEND_FAILED",
      );
    }

    return {
      ownerId:
        settings.owner_id,
      status: "failed",
      reason:
        "telegram_send_failed",
    };
  }

  const sentAt =
    new Date().toISOString();

  const hashRows =
    selectedStories.map(
      (story) => ({
        owner_id:
          settings.owner_id,
        url_hash:
          story.id,
        title_hash:
          createTitleHash(
            story.title,
          ),
        sent_at:
          sentAt,
      }),
    );

  const {
    error: hashError,
  } = await supabase
    .from(
      "sent_article_hashes",
    )
    .insert(hashRows);

  if (hashError) {
    console.error(
      "dispatcher_sent_hash_insert_failed",
      {
        ownerId:
          settings.owner_id,
        code:
          hashError.code,
      },
    );
  }

  if (deliveryId) {
    let deliveryUpdateSucceeded =
      false;

    for (
      let attempt = 1;
      attempt <= 3;
      attempt += 1
    ) {
      const {
        error: updateError,
      } = await supabase
        .from("deliveries")
        .update({
          status: "sent",
          provider_message_id:
            String(messageId),
          sent_at:
            sentAt,
          failure_code: null,
          updated_at:
            sentAt,
        })
        .eq(
          "id",
          deliveryId,
        );

      if (!updateError) {
        deliveryUpdateSucceeded =
          true;
        break;
      }

      console.error(
        "dispatcher_delivery_success_update_failed",
        {
          ownerId:
            settings.owner_id,
          attempt,
          code:
            updateError.code,
        },
      );

      await new Promise(
        (resolve) =>
          setTimeout(
            resolve,
            attempt * 250,
          ),
      );
    }

    if (
      !deliveryUpdateSucceeded
    ) {
      console.error(
        "dispatcher_delivery_sent_but_not_recorded",
        {
          ownerId:
            settings.owner_id,
          messageId,
        },
      );
    }
  }

  return {
    ownerId:
      settings.owner_id,
    status: "sent",
    localDate:
      localClock.localDate,
    deliveryTime:
      settings.delivery_time,
    fetched:
      stories.length,
    eligible:
      rankedStories.length,
    sent:
      selectedStories.length,
    messageId,
  };
}
