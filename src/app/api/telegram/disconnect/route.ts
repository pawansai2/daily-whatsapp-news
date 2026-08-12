import { NextResponse } from "next/server";

import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  const supabase =
    await createClient();

  const {
    data: claimsData,
    error: claimsError,
  } = await supabase.auth.getClaims();

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

  const admin =
    getSupabaseAdmin();

  const {
    error: channelError,
  } = await admin
    .from("user_channels")
    .update({
      external_chat_id: null,
      username: null,
      verified_at: null,
      is_active: false,
      updated_at:
        new Date().toISOString(),
    })
    .eq("user_id", userId)
    .eq("channel", "telegram");

  if (channelError) {
    console.error(
      "telegram_disconnect_failed",
      {
        code: channelError.code,
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

  /*
   * A disconnected account must not retain a
   * previously generated usable connection code.
   */
  const {
    error: tokenError,
  } = await admin
    .from("telegram_link_tokens")
    .delete()
    .eq("user_id", userId)
    .is("used_at", null);

  if (tokenError) {
    console.error(
      "telegram_disconnect_token_cleanup_failed",
      {
        code: tokenError.code,
      },
    );
  }

  return NextResponse.json({
    status: "disconnected",
  });
}
