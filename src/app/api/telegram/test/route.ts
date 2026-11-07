import crypto from "node:crypto";
import { NextResponse } from "next/server";

import { createClient } from "@/lib/firebase/server";
import {
  hasTelegramConfiguration,
  sendTelegramMessage,
  sendTelegramMessageToChat,
} from "@/lib/telegram/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function safeEqual(
  left: string,
  right: string,
): boolean {
  const leftBuffer =
    Buffer.from(left, "utf8");

  const rightBuffer =
    Buffer.from(right, "utf8");

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

/*
 * Authenticated multi-user test.
 *
 * This is the endpoint used by the Telegram
 * settings screen.
 */
export async function POST() {
  const firebaseStore =
    await createClient();

  const {
    data: claimsData,
    error: claimsError,
  } = await firebaseStore.auth.getClaims();

  const userId =
    claimsData?.claims?.sub;

  if (claimsError || !userId) {
    return NextResponse.json(
      {
        error: "Authentication required.",
      },
      {
        status: 401,
      },
    );
  }

  const {
    data: channel,
    error: channelError,
  } = await firebaseStore
    .from("user_channels")
    .select(
      "external_chat_id, verified_at, is_active",
    )
    .eq("user_id", userId)
    .eq("channel", "telegram")
    .maybeSingle();

  if (channelError) {
    console.error(
      "telegram_test_channel_load_failed",
      {
        code: channelError.code,
      },
    );

    return NextResponse.json(
      {
        error:
          "Telegram connection could not be loaded.",
      },
      {
        status: 500,
      },
    );
  }

  const connected =
    Boolean(
      channel?.is_active &&
        channel?.verified_at &&
        channel?.external_chat_id,
    );

  if (
    !connected ||
    !channel?.external_chat_id
  ) {
    return NextResponse.json(
      {
        error:
          "Telegram is not connected.",
      },
      {
        status: 409,
      },
    );
  }

  try {
    const messageId =
      await sendTelegramMessageToChat(
        String(
          channel.external_chat_id,
        ),
        [
          "Daily Intelligence Assistant",
          "",
          "Your Telegram connection is working.",
          "",
          "This message was sent using your personal linked Telegram channel.",
        ].join("\n"),
      );

    return NextResponse.json({
      status: "sent",
      messageId,
    });
  } catch (error) {
    console.error(
      "telegram_user_test_send_failed",
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
          "Test message could not be sent.",
      },
      {
        status: 502,
      },
    );
  }
}

/*
 * Legacy infrastructure test.
 *
 * Keep temporarily until the existing single-user
 * daily-news route is migrated to user_channels.
 */
export async function GET(
  request: Request,
) {
  const cronSecret =
    process.env.CRON_SECRET?.trim();

  if (!cronSecret) {
    return NextResponse.json(
      {
        error:
          "CRON_SECRET is not configured",
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
        error: "Unauthorized",
        code: "UNAUTHORIZED",
      },
      {
        status: 401,
      },
    );
  }

  if (!hasTelegramConfiguration()) {
    return NextResponse.json(
      {
        error:
          "Telegram configuration is incomplete",
        code:
          "TELEGRAM_NOT_CONFIGURED",
      },
      {
        status: 503,
      },
    );
  }

  try {
    const messageId =
      await sendTelegramMessage(
        [
          "Daily Intelligence Assistant",
          "",
          "Legacy Telegram infrastructure test.",
        ].join("\n"),
      );

    return NextResponse.json({
      status: "sent",
      channel: "telegram",
      messageId,
    });
  } catch (error) {
    console.error(
      "telegram_test_send_failed",
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
          "Telegram message could not be sent",
        code:
          "TELEGRAM_SEND_FAILED",
      },
      {
        status: 502,
      },
    );
  }
}
