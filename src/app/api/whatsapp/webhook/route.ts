import crypto from "node:crypto";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_WEBHOOK_BYTES = 256 * 1024;

type WhatsAppMessage = {
  from?: unknown;
  id?: unknown;
  type?: unknown;
  text?: {
    body?: unknown;
  };
};

type WhatsAppChangeValue = {
  metadata?: {
    phone_number_id?: unknown;
  };
  messages?: unknown;
};

type WhatsAppPayload = {
  object?: unknown;
  entry?: unknown;
};

function safeEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left, "utf8");
  const rightBuffer = Buffer.from(right, "utf8");

  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

function digitsOnly(value: string): string {
  return value.replace(/\D/g, "");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function getMessages(payload: WhatsAppPayload): Array<{
  message: WhatsAppMessage;
  phoneNumberId: string;
}> {
  if (!Array.isArray(payload.entry)) {
    return [];
  }

  const result: Array<{
    message: WhatsAppMessage;
    phoneNumberId: string;
  }> = [];

  for (const rawEntry of payload.entry) {
    if (!isRecord(rawEntry) || !Array.isArray(rawEntry.changes)) {
      continue;
    }

    for (const rawChange of rawEntry.changes) {
      if (!isRecord(rawChange) || !isRecord(rawChange.value)) {
        continue;
      }

      const value = rawChange.value as WhatsAppChangeValue;
      const metadata = value.metadata;

      if (!metadata || typeof metadata.phone_number_id !== "string") {
        continue;
      }

      if (!Array.isArray(value.messages)) {
        continue;
      }

      for (const rawMessage of value.messages) {
        if (!isRecord(rawMessage)) {
          continue;
        }

        result.push({
          message: rawMessage as WhatsAppMessage,
          phoneNumberId: metadata.phone_number_id,
        });
      }
    }
  }

  return result;
}

export async function GET(request: Request) {
  const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN?.trim();

  if (!verifyToken) {
    return NextResponse.json(
      {
        error: "Webhook verification is not configured",
        code: "WEBHOOK_NOT_CONFIGURED",
      },
      { status: 503 },
    );
  }

  const url = new URL(request.url);
  const mode = url.searchParams.get("hub.mode") ?? "";
  const providedToken = url.searchParams.get("hub.verify_token") ?? "";
  const challenge = url.searchParams.get("hub.challenge");

  if (
    mode !== "subscribe" ||
    !challenge ||
    !safeEqual(providedToken, verifyToken)
  ) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  return new NextResponse(challenge, { status: 200 });
}

export async function POST(request: Request) {
  const appSecret = process.env.META_APP_SECRET?.trim();

  if (!appSecret) {
    return NextResponse.json(
      {
        error: "Webhook signature verification is not configured",
        code: "META_APP_SECRET_MISSING",
      },
      { status: 503 },
    );
  }

  const declaredLength = Number(request.headers.get("content-length") ?? "0");

  if (
    Number.isFinite(declaredLength) &&
    declaredLength > MAX_WEBHOOK_BYTES
  ) {
    return new NextResponse("Payload too large", { status: 413 });
  }

  const signature = request.headers.get("x-hub-signature-256") ?? "";

  if (!signature.startsWith("sha256=")) {
    return new NextResponse("Invalid signature", { status: 403 });
  }

  const rawBody = await request.text();

  if (Buffer.byteLength(rawBody, "utf8") > MAX_WEBHOOK_BYTES) {
    return new NextResponse("Payload too large", { status: 413 });
  }

  const expectedSignature = `sha256=${crypto
    .createHmac("sha256", appSecret)
    .update(rawBody)
    .digest("hex")}`;

  if (!safeEqual(signature, expectedSignature)) {
    return new NextResponse("Invalid signature", { status: 403 });
  }

  let parsedPayload: unknown;

  try {
    parsedPayload = JSON.parse(rawBody) as unknown;
  } catch {
    return new NextResponse("Invalid JSON", { status: 400 });
  }

  if (!isRecord(parsedPayload)) {
    return new NextResponse("Invalid payload", { status: 400 });
  }

  const payload = parsedPayload as WhatsAppPayload;

  if (payload.object !== "whatsapp_business_account") {
    return new NextResponse("Ignored", { status: 200 });
  }

  const configuredPhoneNumberId =
    process.env.WHATSAPP_PHONE_NUMBER_ID?.trim();
  const configuredOwnerNumber =
    process.env.WHATSAPP_RECIPIENT_NUMBER?.trim();

  if (!configuredPhoneNumberId || !configuredOwnerNumber) {
    return NextResponse.json(
      {
        error: "WhatsApp owner configuration is incomplete",
        code: "WHATSAPP_OWNER_NOT_CONFIGURED",
      },
      { status: 503 },
    );
  }

  const messages = getMessages(payload);

  for (const { message, phoneNumberId } of messages) {
    if (!safeEqual(phoneNumberId, configuredPhoneNumberId)) {
      continue;
    }

    if (typeof message.from !== "string") {
      continue;
    }

    if (
      !safeEqual(
        digitsOnly(message.from),
        digitsOnly(configuredOwnerNumber),
      )
    ) {
      continue;
    }

    /*
     * Signature, business phone ID, and sender are now validated.
     *
     * The following are still intentionally not claimed as implemented:
     * - database replay protection
     * - command parsing
     * - confirmation flow
     * - settings mutation
     * - WhatsApp confirmation replies
     */
  }

  return NextResponse.json({
    status: "accepted",
    processed: false,
    reason: "Command processing is not implemented yet",
  });
}