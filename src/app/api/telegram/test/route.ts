import crypto from "node:crypto";
import { NextResponse } from "next/server";

import {
  hasTelegramConfiguration,
  sendTelegramMessage,
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
    leftBuffer.length !== rightBuffer.length
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
    process.env.CRON_SECRET?.trim();

  if (!cronSecret) {
    return NextResponse.json(
      {
        error: "CRON_SECRET is not configured",
        code: "CRON_NOT_CONFIGURED",
      },
      {
        status: 503,
      },
    );
  }

  const authorization =
    request.headers.get("authorization") ?? "";

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
          "✅ Daily Intelligence Assistant",
          "",
          "Permanent Telegram integration is working.",
          "",
          "Next: news digest pipeline.",
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
