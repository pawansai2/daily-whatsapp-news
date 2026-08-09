import crypto from "crypto";
import { NextResponse } from "next/server";

import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CODE_ALPHABET =
  "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

const CODE_LENGTH = 8;
const LINK_LIFETIME_MINUTES = 10;

function createLinkCode(): string {
  let value = "";

  for (
    let index = 0;
    index < CODE_LENGTH;
    index += 1
  ) {
    value +=
      CODE_ALPHABET[
        crypto.randomInt(
          0,
          CODE_ALPHABET.length,
        )
      ];
  }

  return value;
}

function hashLinkCode(
  code: string,
): string {
  return crypto
    .createHash("sha256")
    .update(code.trim().toUpperCase())
    .digest("hex");
}

export async function POST() {
  const supabase =
    await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
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

  /*
   * Only one unused link code is needed at a time.
   * Delete previous unused codes belonging to this
   * authenticated user.
   */
  const {
    error: cleanupError,
  } = await admin
    .from("telegram_link_tokens")
    .delete()
    .eq("user_id", user.id)
    .is("used_at", null);

  if (cleanupError) {
    console.error(
      "telegram_link_token_cleanup_failed",
      {
        code: cleanupError.code,
      },
    );

    return NextResponse.json(
      {
        error:
          "Unable to create Telegram link code.",
      },
      {
        status: 500,
      },
    );
  }

  const code = createLinkCode();

  const expiresAt =
    new Date(
      Date.now() +
        LINK_LIFETIME_MINUTES *
          60 *
          1000,
    ).toISOString();

  const {
    error: insertError,
  } = await admin
    .from("telegram_link_tokens")
    .insert({
      user_id: user.id,
      token_hash:
        hashLinkCode(code),
      expires_at: expiresAt,
    });

  if (insertError) {
    console.error(
      "telegram_link_token_create_failed",
      {
        code: insertError.code,
      },
    );

    return NextResponse.json(
      {
        error:
          "Unable to create Telegram link code.",
      },
      {
        status: 500,
      },
    );
  }

  return NextResponse.json({
    code,
    expiresAt,
  });
}
