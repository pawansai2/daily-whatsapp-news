import { NextResponse } from "next/server";

import { createClient } from "@/lib/firebase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
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
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  }

  const {
    data: channel,
    error: channelError,
  } = await firebaseStore
    .from("user_channels")
    .select(
      "username, verified_at, is_active",
    )
    .eq("user_id", userId)
    .eq("channel", "telegram")
    .maybeSingle();

  if (channelError) {
    console.error(
      "telegram_status_load_failed",
      {
        code: channelError.code,
      },
    );

    return NextResponse.json(
      {
        error:
          "Telegram status could not be loaded.",
      },
      {
        status: 500,
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  }

  const connected =
    Boolean(
      channel?.is_active &&
        channel?.verified_at,
    );

  return NextResponse.json(
    {
      connected,
      username:
        connected
          ? channel?.username ?? null
          : null,
    },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}
