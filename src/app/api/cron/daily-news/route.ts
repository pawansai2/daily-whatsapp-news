import crypto from "node:crypto";
import { NextResponse } from "next/server";

import {
  getSupabaseAdmin,
  hasSupabaseServerConfiguration,
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
  hasTelegramConfiguration,
  sendTelegramMessage,
} from "@/lib/telegram/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DELIVERY_TYPE =
  "daily_telegram";
type OwnerSettingsRow = {
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

function buildNewsOccurrenceKey(
  localDate: string,
  deliveryTime: string,
): string {
  return `news-digest:${localDate}:${deliveryTime}`;
}
function safeEqual(
  left: string,
  right: string,
): boolean {
  const leftBuffer =
    Buffer.from(
      left,
      "utf8",
    );

  const rightBuffer =
    Buffer.from(
      right,
      "utf8",
    );

  if (
    leftBuffer.length !==
    rightBuffer.length
  ) {
    return false;
  }

  return crypto.timingSafeEqual(
    leftBuffer,
    rightBuffer,
  );
}

function uniqueStrings(
  values: string[],
): string[] {
  const map =
    new Map<
      string,
      string
    >();

  for (
    const rawValue
    of values
  ) {
    const value =
      rawValue.trim();

    if (!value) {
      continue;
    }

    const key =
      value.toLowerCase();

    if (
      !map.has(key)
    ) {
      map.set(
        key,
        value,
      );
    }
  }

  return Array.from(
    map.values(),
  );
}

function getLocalClock(
  timezone: string,
): {
  localDate: string;
  minutes: number;
} {
  const formatter =
    new Intl.DateTimeFormat(
      "en-CA",
      {
        timeZone:
          timezone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23",
      },
    );

  const parts =
    formatter.formatToParts(
      new Date(),
    );

  const getPart = (
    type: string,
  ) =>
    parts.find(
      (part) =>
        part.type === type,
    )?.value ?? "";

  const year =
    getPart("year");

  const month =
    getPart("month");

  const day =
    getPart("day");

  const hour =
    Number(
      getPart("hour"),
    );

  const minute =
    Number(
      getPart("minute"),
    );

  if (
    !year ||
    !month ||
    !day ||
    !Number.isInteger(
      hour,
    ) ||
    !Number.isInteger(
      minute,
    )
  ) {
    throw new Error(
      "Unable to calculate local delivery time.",
    );
  }

  return {
    localDate:
      `${year}-${month}-${day}`,
    minutes:
      hour * 60 +
      minute,
  };
}

function parseDeliveryMinutes(
  deliveryTime: string,
): number {
  const match =
    /^([01]\d|2[0-3]):([0-5]\d)$/.exec(
      deliveryTime,
    );

  if (!match) {
    throw new Error(
      "Invalid delivery time.",
    );
  }

  return (
    Number(match[1]) *
      60 +
    Number(match[2])
  );
}

export async function GET(
  request: Request,
) {
  const cronSecret =
    process.env
      .CRON_SECRET
      ?.trim();

  if (!cronSecret) {
    return NextResponse.json(
      {
        error:
          "Cron is not configured",
        code:
          "CRON_NOT_CONFIGURED",
      },
      {
        status: 503,
      },
    );
  }

  const authorization =
    request.headers.get(
      "authorization",
    ) ?? "";

  if (
    !safeEqual(
      authorization,
      `Bearer ${cronSecret}`,
    )
  ) {
    return NextResponse.json(
      {
        error:
          "Unauthorized",
        code:
          "INVALID_CRON_CREDENTIAL",
      },
      {
        status: 401,
      },
    );
  }

  if (
    process.env
      .NEWS_DIGEST_ENABLED !==
    "true"
  ) {
    return NextResponse.json({
      status: "paused",
      reason:
        "Digest globally disabled",
    });
  }

  if (
    !hasSupabaseServerConfiguration()
  ) {
    return NextResponse.json(
      {
        error:
          "Supabase server configuration is missing",
        code:
          "SUPABASE_NOT_CONFIGURED",
      },
      {
        status: 503,
      },
    );
  }

  if (
    !hasTelegramConfiguration()
  ) {
    return NextResponse.json(
      {
        error:
          "Telegram configuration is missing",
        code:
          "TELEGRAM_NOT_CONFIGURED",
      },
      {
        status: 503,
      },
    );
  }

  const supabase =
    getSupabaseAdmin();

  const {
    data: rawSettingsRows,
    error: settingsError,
  } = await supabase
    .from(
      "personal_settings",
    )
    .select(
      [
        "owner_id",
        "digest_enabled",
        "language",
        "country",
        "state",
        "district",
        "city",
        "timezone",
        "delivery_time",
        "story_limit",
        "custom_keywords",
      ].join(","),
    )
    .eq(
      "digest_enabled",
      true,
    )
    .limit(2);
  const settingsRows =
    (rawSettingsRows ?? []) as unknown as OwnerSettingsRow[];

  if (settingsError) {
    console.error(
      "cron_settings_query_failed",
      {
        code:
          settingsError.code,
      },
    );

    return NextResponse.json(
      {
        error:
          "Unable to load owner settings",
        code:
          "SETTINGS_QUERY_FAILED",
      },
      {
        status: 500,
      },
    );
  }

  if (
    !settingsRows ||
    settingsRows.length ===
      0
  ) {
    return NextResponse.json({
      status: "skipped",
      reason:
        "No enabled owner settings found",
    });
  }

  if (
    settingsRows.length >
    1
  ) {
    return NextResponse.json(
      {
        error:
          "More than one enabled owner profile exists",
        code:
          "SINGLE_OWNER_CONSTRAINT_VIOLATION",
      },
      {
        status: 500,
      },
    );
  }

  const settings =
    settingsRows[0];

  const timezone =
    settings.timezone ||
    "Asia/Kolkata";

  let localClock: {
    localDate: string;
    minutes: number;
  };

  let deliveryMinutes:
    number;

  try {
    localClock =
      getLocalClock(
        timezone,
      );

    deliveryMinutes =
      parseDeliveryMinutes(
        settings.delivery_time,
      );
  } catch (error) {
    console.error(
      "cron_invalid_schedule",
      {
        message:
          error instanceof Error
            ? error.message
            : "unknown",
      },
    );

    return NextResponse.json(
      {
        error:
          "Invalid delivery schedule",
        code:
          "INVALID_DELIVERY_SCHEDULE",
      },
      {
        status: 500,
      },
    );
  }

  if (
    localClock.minutes <
    deliveryMinutes
  ) {
    return NextResponse.json({
      status: "skipped",
      reason:
        "Delivery time has not arrived yet",
      localDate:
        localClock.localDate,
      deliveryTime:
        settings.delivery_time,
    });
  }

  const occurrenceKey =
    buildNewsOccurrenceKey(
      localClock.localDate,
      settings.delivery_time,
    );

  const {
    data: occurrenceDelivery,
    error: occurrenceDeliveryError,
  } = await supabase
    .from("deliveries")
    .select(
      "id, status, attempt_count, updated_at",
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

  if (occurrenceDeliveryError) {
    return NextResponse.json(
      {
        error:
          "Unable to check delivery occurrence",
        code:
          "DELIVERY_LOOKUP_FAILED",
      },
      {
        status: 500,
      },
    );
  }

  let existingDelivery =
    occurrenceDelivery;

  /*
   * Backward-compatibility protection:
   *
   * Existing deliveries are migrated with legacy:* keys.
   * During the migration day, do not accidentally resend a
   * digest that was already delivered under the old model.
   */
  if (!existingDelivery) {
    const {
      data: legacyDelivery,
      error: legacyDeliveryError,
    } = await supabase
      .from("deliveries")
      .select(
        "id, status, attempt_count, updated_at",
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

    if (legacyDeliveryError) {
      return NextResponse.json(
        {
          error:
            "Unable to check legacy delivery history",
          code:
            "DELIVERY_LOOKUP_FAILED",
        },
        {
          status: 500,
        },
      );
    }

    existingDelivery =
      legacyDelivery;
  }
  if (
    existingDelivery?.status ===
    "sent"
  ) {
    return NextResponse.json({
      status: "skipped",
      reason:
        "This digest occurrence has already been sent",
      localDate:
        localClock.localDate,
    });
  }

  if (
    existingDelivery?.status ===
    "processing"
  ) {
    const updatedTime =
      new Date(
        existingDelivery.updated_at,
      ).getTime();

    const isRecent =
      Number.isFinite(
        updatedTime,
      ) &&
      Date.now() -
        updatedTime <
        10 * 60 * 1000;

    if (isRecent) {
      return NextResponse.json({
        status: "skipped",
        reason:
          "Delivery is already processing",
      });
    }
  }

  const {
    data: interestRows,
    error: interestsError,
  } = await supabase
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
    );

  if (interestsError) {
    return NextResponse.json(
      {
        error:
          "Unable to load interests",
        code:
          "INTERESTS_QUERY_FAILED",
      },
      {
        status: 500,
      },
    );
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

  const sentCutoff =
    new Date(
      Date.now() -
        30 *
          24 *
          60 *
          60 *
          1000,
    ).toISOString();

  const {
    data: sentRows,
    error: sentError,
  } = await supabase
    .from(
      "sent_article_hashes",
    )
    .select("url_hash")
    .eq(
      "owner_id",
      settings.owner_id,
    )
    .gte(
      "sent_at",
      sentCutoff,
    )
    .limit(1000);

  if (sentError) {
    return NextResponse.json(
      {
        error:
          "Unable to load sent article history",
        code:
          "SENT_HISTORY_QUERY_FAILED",
      },
      {
        status: 500,
      },
    );
  }

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
      "news_fetch_failed",
      {
        message:
          error instanceof Error
            ? error.message
            : "unknown",
      },
    );

    return NextResponse.json(
      {
        error:
          "Unable to fetch news",
        code:
          "NEWS_FETCH_FAILED",
      },
      {
        status: 502,
      },
    );
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
    return NextResponse.json({
      status: "skipped",
      reason:
        "No fresh relevant stories are available",
      fetched:
        stories.length,
    });
  }

  let deliveryId:
    string | null =
    existingDelivery?.id ??
    null;

  if (deliveryId) {
    const nextAttempt =
      Number(
        existingDelivery
          ?.attempt_count ??
          0,
      ) + 1;

    const {
      error: lockError,
    } = await supabase
      .from("deliveries")
      .update({
        status:
          "processing",
        attempt_count:
          nextAttempt,
        failure_code: null,
        updated_at:
          new Date().toISOString(),
      })
      .eq(
        "id",
        deliveryId,
      );

    if (lockError) {
      return NextResponse.json(
        {
          error:
            "Unable to acquire delivery lock",
          code:
            "DELIVERY_LOCK_FAILED",
        },
        {
          status: 500,
        },
      );
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
        return NextResponse.json({
          status: "skipped",
          reason:
            "Another delivery process already acquired today's lock",
        });
      }

      return NextResponse.json(
        {
          error:
            "Unable to create delivery record",
          code:
            "DELIVERY_LOCK_FAILED",
        },
        {
          status: 500,
        },
      );
    }

    deliveryId =
      inserted.id;
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
      await sendTelegramMessage(
        message,
      );
  } catch (error) {
    console.error(
      "telegram_digest_send_failed",
      {
        message:
          error instanceof Error
            ? error.message
            : "unknown",
      },
    );

    if (deliveryId) {
      await supabase
        .from(
          "deliveries",
        )
        .update({
          status: "failed",
          failure_code:
            "TELEGRAM_SEND_FAILED",
          updated_at:
            new Date().toISOString(),
        })
        .eq(
          "id",
          deliveryId,
        );
    }

    return NextResponse.json(
      {
        error:
          "Telegram digest could not be sent",
        code:
          "TELEGRAM_SEND_FAILED",
      },
      {
        status: 502,
      },
    );
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
    error: hashInsertError,
  } = await supabase
    .from(
      "sent_article_hashes",
    )
    .insert(
      hashRows,
    );

  if (hashInsertError) {
    console.error(
      "sent_article_hash_insert_failed",
      {
        code:
          hashInsertError.code,
      },
    );
  }

  if (deliveryId) {
    const {
      error:
        deliveryUpdateError,
    } = await supabase
      .from(
        "deliveries",
      )
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

    if (
      deliveryUpdateError
    ) {
      console.error(
        "delivery_success_update_failed",
        {
          code:
            deliveryUpdateError.code,
        },
      );
    }
  }

  return NextResponse.json({
    status: "sent",
    channel: "telegram",
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
  });
}
