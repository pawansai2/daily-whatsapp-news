import { NextResponse } from "next/server";

import { disconnectTelegramUser } from "@/lib/firebase/telegram";
import { createClient } from "@/lib/firebase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

  try {
    await disconnectTelegramUser(userId);
  } catch (error) {
    console.error(
      "telegram_disconnect_failed",
      {
        message:
          error instanceof Error ? error.message : "unknown",
      },
    );

    return NextResponse.json(
      {
        error:
          "Telegram could not be disconnected.",
      },
      {
        status: 500,
      },
    );
  }

  return NextResponse.json({
    status: "disconnected",
  });
}
