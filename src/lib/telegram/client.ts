type TelegramResponse<T = unknown> = {
  ok: boolean;
  result?: T;
  description?: string;
};

type TelegramSendResult = {
  message_id: number;
};

function getTelegramBotToken(): string {
  const token =
    process.env.TELEGRAM_BOT_TOKEN?.trim();

  if (!token) {
    throw new Error(
      "TELEGRAM_BOT_TOKEN is not configured.",
    );
  }

  return token;
}

function getLegacyTelegramChatId(): string {
  const chatId =
    process.env.TELEGRAM_CHAT_ID?.trim();

  if (!chatId) {
    throw new Error(
      "TELEGRAM_CHAT_ID is not configured.",
    );
  }

  return chatId;
}

/*
 * Global bot configuration.
 *
 * Multi-user delivery needs only the bot token here.
 * Individual chat IDs come from user_channels.
 */
export function hasTelegramBotConfiguration():
  boolean {
  return Boolean(
    process.env.TELEGRAM_BOT_TOKEN?.trim(),
  );
}

/*
 * Temporary compatibility check for the existing
 * single-user daily-news route.
 *
 * This will be removed after that route is converted
 * to user_channels.
 */
export function hasTelegramConfiguration():
  boolean {
  return Boolean(
    process.env.TELEGRAM_BOT_TOKEN?.trim() &&
      process.env.TELEGRAM_CHAT_ID?.trim(),
  );
}

export async function sendTelegramMessageToChat(
  chatId: string,
  text: string,
): Promise<number> {
  const token = getTelegramBotToken();

  const cleanChatId = chatId.trim();
  const cleanText = text.trim();

  if (!cleanChatId) {
    throw new Error(
      "Telegram chat ID cannot be empty.",
    );
  }

  if (!cleanText) {
    throw new Error(
      "Telegram message cannot be empty.",
    );
  }

  if (cleanText.length > 4096) {
    throw new Error(
      "Telegram message exceeds 4096 characters.",
    );
  }

  const response = await fetch(
    `https://api.telegram.org/bot${token}/sendMessage`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        chat_id: cleanChatId,
        text: cleanText,
        disable_web_page_preview: true,
        protect_content: true,
      }),
      cache: "no-store",
    },
  );

  let payload:
    TelegramResponse<TelegramSendResult>;

  try {
    payload =
      (await response.json()) as
        TelegramResponse<TelegramSendResult>;
  } catch {
    throw new Error(
      "Telegram returned an invalid response.",
    );
  }

  if (
    !response.ok ||
    !payload.ok ||
    !payload.result
  ) {
    throw new Error(
      payload.description ||
        `Telegram request failed with HTTP ${response.status}.`,
    );
  }

  return payload.result.message_id;
}

/*
 * Legacy wrapper.
 *
 * Keeps the already-working daily-news pipeline alive
 * until it is converted to per-user channels.
 */
export async function sendTelegramMessage(
  text: string,
): Promise<number> {
  return sendTelegramMessageToChat(
    getLegacyTelegramChatId(),
    text,
  );
}
