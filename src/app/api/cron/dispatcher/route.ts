import crypto from "node:crypto";
import { NextResponse } from "next/server";

import {
  getFirebaseAdminClient,
  hasFirebaseAdminConfiguration,
} from "@/lib/firebase/store";

import {
  runNewsDeliveryForUser,
  type NewsDeliverySettings,
} from "@/lib/news/delivery";

import {
  hasTelegramBotConfiguration,
} from "@/lib/telegram/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type TelegramChannelRow = {
  user_id: string;
  external_chat_id: string | null;
};

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
    !hasFirebaseAdminConfiguration()
  ) {
    return NextResponse.json(
      {
        error:
          "Firebase Admin configuration is missing",
        code:
          "FIREBASE_ADMIN_NOT_CONFIGURED",
      },
      {
        status: 503,
      },
    );
  }

  /*
   * Multi-user delivery only requires the shared bot
   * token. Individual Telegram destinations come
   * from user_channels.
   */
  if (
    !hasTelegramBotConfiguration()
  ) {
    return NextResponse.json(
      {
        error:
          "Telegram bot configuration is missing",
        code:
          "TELEGRAM_NOT_CONFIGURED",
      },
      {
        status: 503,
      },
    );
  }

  const firebaseStore =
    getFirebaseAdminClient();

  const [
    {
      data: rawSettings,
      error: settingsError,
    },
    {
      data: rawChannels,
      error: channelsError,
    },
  ] = await Promise.all([
    firebaseStore
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
      ),

    firebaseStore
      .from(
        "user_channels",
      )
      .select(
        "user_id,external_chat_id",
      )
      .eq(
        "channel",
        "telegram",
      )
      .eq(
        "is_active",
        true,
      )
      .not(
        "verified_at",
        "is",
        null,
      )
      .not(
        "external_chat_id",
        "is",
        null,
      ),
  ]);

  if (settingsError) {
    console.error(
      "dispatcher_settings_query_failed",
      {
        code:
          settingsError.code,
      },
    );

    return NextResponse.json(
      {
        error:
          "Unable to load digest settings",
        code:
          "SETTINGS_QUERY_FAILED",
      },
      {
        status: 500,
      },
    );
  }

  if (channelsError) {
    console.error(
      "dispatcher_channels_query_failed",
      {
        code:
          channelsError.code,
      },
    );

    return NextResponse.json(
      {
        error:
          "Unable to load Telegram channels",
        code:
          "CHANNELS_QUERY_FAILED",
      },
      {
        status: 500,
      },
    );
  }

  const settingsRows =
    (rawSettings ?? []) as unknown as
      NewsDeliverySettings[];

  const channelRows =
    (rawChannels ?? []) as unknown as
      TelegramChannelRow[];

  const chatByUser =
    new Map<
      string,
      string
    >();

  for (
    const channel
    of channelRows
  ) {
    const chatId =
      channel.external_chat_id
        ?.trim();

    if (chatId) {
      chatByUser.set(
        channel.user_id,
        chatId,
      );
    }
  }

  const results:
    Array<{
      status: string;
      reason?: string;
      localDate?: string;
      deliveryTime?: string;
      sent?: number;
      messageId?: number;
    }> = [];

  let sentCount = 0;
  let skippedCount = 0;
  let failedCount = 0;

  /*
   * Sequential execution is deliberate for the
   * first reliable dispatcher:
   *
   * - avoids hammering RSS providers
   * - avoids Telegram bursts
   * - simplifies occurrence locking
   *
   * Later this can use bounded concurrency.
   */
  for (
    const settings
    of settingsRows
  ) {
    const chatId =
      chatByUser.get(
        settings.owner_id,
      );

    if (!chatId) {
      skippedCount += 1;

      results.push({
        status: "skipped",
        reason:
          "telegram_not_connected",
      });

      continue;
    }

    try {
      const result =
        await runNewsDeliveryForUser(
          settings,
          chatId,
        );

      results.push({
        status:
          result.status,
        reason:
          result.reason,
        localDate:
          result.localDate,
        deliveryTime:
          result.deliveryTime,
        sent:
          result.sent,
        messageId:
          result.messageId,
      });

      if (
        result.status ===
        "sent"
      ) {
        sentCount += 1;
      } else if (
        result.status ===
        "failed"
      ) {
        failedCount += 1;
      } else {
        skippedCount += 1;
      }
    } catch (error) {
      failedCount += 1;

      console.error(
        "dispatcher_user_delivery_unhandled_failure",
        {
          ownerId:
            settings.owner_id,
          message:
            error instanceof Error
              ? error.message
              : "unknown",
        },
      );

      results.push({
        status: "failed",
        reason:
          "unhandled_delivery_failure",
      });
    }
  }

  return NextResponse.json(
    {
      status: "completed",
      enabledUsers:
        settingsRows.length,
      connectedTelegramUsers:
        chatByUser.size,
      sent:
        sentCount,
      skipped:
        skippedCount,
      failed:
        failedCount,
      results,
    },
    {
      headers: {
        "Cache-Control":
          "no-store",
      },
    },
  );
}
