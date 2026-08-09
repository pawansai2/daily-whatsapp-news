import crypto from "crypto";
import { NextResponse } from "next/server";

import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { sendTelegramMessageToChat } from "@/lib/telegram/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type TelegramUser = {
  username?: string;
};

type TelegramChat = {
  id: number | string;
};

type TelegramMessage = {
  text?: string;
  chat?: TelegramChat;
  from?: TelegramUser;
};

type TelegramUpdate = {
  update_id?: number;
  message?: TelegramMessage;
};

type TelegramLinkResult = {
  link_status: string;
  linked_user_id: string | null;
};

function safeEqual(
  left: string,
  right: string,
): boolean {
  const leftBuffer =
    Buffer.from(left);

  const rightBuffer =
    Buffer.from(right);

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

function hashLinkCode(
  code: string,
): string {
  return crypto
    .createHash("sha256")
    .update(code.trim().toUpperCase())
    .digest("hex");
}

function extractLinkCode(
  text: string,
): string | null {
  const match =
    text
      .trim()
      .match(
        /^\/(?:link|start)(?:@\w+)?\s+([A-Z2-9]{8})$/i,
      );

  return match?.[1]
    ?.trim()
    .toUpperCase() ?? null;
}

async function reply(
  chatId: string,
  text: string,
) {
  try {
    await sendTelegramMessageToChat(
      chatId,
      text,
    );
  } catch (error) {
    console.error(
      "telegram_link_reply_failed",
      {
        message:
          error instanceof Error
            ? error.message
            : "unknown",
      },
    );
  }
}

export async function POST(
  request: Request,
) {
  const configuredSecret =
    process.env
      .TELEGRAM_WEBHOOK_SECRET
      ?.trim() ?? "";

  const suppliedSecret =
    request.headers
      .get(
        "x-telegram-bot-api-secret-token",
      )
      ?.trim() ?? "";

  if (
    !configuredSecret ||
    !suppliedSecret ||
    !safeEqual(
      configuredSecret,
      suppliedSecret,
    )
  ) {
    return NextResponse.json(
      {
        error: "Unauthorized",
      },
      {
        status: 401,
      },
    );
  }

  let update: TelegramUpdate;

  try {
    update =
      (await request.json()) as
        TelegramUpdate;
  } catch {
    return NextResponse.json({
      status: "ignored",
    });
  }

  const message = update.message;

  if (
    !message?.chat?.id ||
    !message.text
  ) {
    return NextResponse.json({
      status: "ignored",
    });
  }

  const chatId =
    String(message.chat.id);

  const code =
    extractLinkCode(message.text);

  if (!code) {
    if (
      message.text
        .trim()
        .toLowerCase()
        .startsWith("/link")
    ) {
      await reply(
        chatId,
        "Invalid link command. Generate a new connection code in your web settings and send: /link CODE",
      );
    }

    return NextResponse.json({
      status: "ignored",
    });
  }

  const admin =
    getSupabaseAdmin();

  const {
    data,
    error,
  } = await admin.rpc(
    "claim_telegram_link",
    {
      p_token_hash:
        hashLinkCode(code),
      p_chat_id: chatId,
      p_username:
        message.from?.username ??
        null,
    },
  );

  if (error) {
    console.error(
      "telegram_link_claim_failed",
      {
        code: error.code,
      },
    );

    await reply(
      chatId,
      "Telegram connection could not be completed. Please generate a new code and try again.",
    );

    return NextResponse.json({
      status: "handled",
    });
  }

  const results =
    (data ?? []) as unknown as
      TelegramLinkResult[];

  const result =
    results[0];

  switch (result?.link_status) {
    case "linked":
      await reply(
        chatId,
        "✅ Telegram connected successfully to your Daily Intelligence account.",
      );
      break;

    case "already_linked":
      await reply(
        chatId,
        "✅ This Telegram account is already connected.",
      );
      break;

    case "expired":
      await reply(
        chatId,
        "⏱ This connection code has expired. Generate a new code from your web settings.",
      );
      break;

    case "chat_already_linked":
      await reply(
        chatId,
        "This Telegram account is already connected to another user.",
      );
      break;

    default:
      await reply(
        chatId,
        "Invalid connection code. Generate a new code from your web settings.",
      );
      break;
  }

  /*
   * Telegram retries unsuccessful webhook responses,
   * so after handling the update we acknowledge it.
   */
  return NextResponse.json({
    status: "handled",
  });
}
