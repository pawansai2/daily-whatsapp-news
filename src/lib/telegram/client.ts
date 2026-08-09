type TelegramResponse<T = unknown> = {
  ok: boolean;
  result?: T;
  description?: string;
};

type TelegramSendResult = {
  message_id: number;
};

function getTelegramConfiguration() {
  const token =
    process.env.TELEGRAM_BOT_TOKEN?.trim();

  const chatId =
    process.env.TELEGRAM_CHAT_ID?.trim();

  if (!token) {
    throw new Error(
      "TELEGRAM_BOT_TOKEN is not configured.",
    );
  }

  if (!chatId) {
    throw new Error(
      "TELEGRAM_CHAT_ID is not configured.",
    );
  }

  return {
    token,
    chatId,
  };
}

export function hasTelegramConfiguration():
  boolean {
  return Boolean(
    process.env.TELEGRAM_BOT_TOKEN?.trim() &&
      process.env.TELEGRAM_CHAT_ID?.trim(),
  );
}

export async function sendTelegramMessage(
  text: string,
): Promise<number> {
  const { token, chatId } =
    getTelegramConfiguration();

  const cleanText = text.trim();

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
        chat_id: chatId,
        text: cleanText,
        disable_web_page_preview: true,
        protect_content: true,
      }),
      cache: "no-store",
    },
  );

  let payload: TelegramResponse<TelegramSendResult>;

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
