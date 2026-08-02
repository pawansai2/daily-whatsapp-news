import crypto from "node:crypto";
import { NextResponse } from "next/server";

import {
  getSupabaseAdmin,
  hasSupabaseServerConfiguration,
} from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function safeEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left, "utf8");
  const rightBuffer = Buffer.from(right, "utf8");

  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET?.trim();

  if (!cronSecret) {
    return NextResponse.json(
      {
        error: "Cron is not configured",
        code: "CRON_NOT_CONFIGURED",
      },
      { status: 503 },
    );
  }

  const authorization = request.headers.get("authorization") ?? "";
  const expectedAuthorization = `Bearer ${cronSecret}`;

  if (!safeEqual(authorization, expectedAuthorization)) {
    return NextResponse.json(
      {
        error: "Unauthorized",
        code: "INVALID_CRON_CREDENTIAL",
      },
      { status: 401 },
    );
  }

  if (process.env.NEWS_DIGEST_ENABLED !== "true") {
    return NextResponse.json({
      status: "paused",
      reason: "Digest globally disabled",
    });
  }

  if (!hasSupabaseServerConfiguration()) {
    return NextResponse.json(
      {
        error: "Supabase server configuration is missing",
        code: "SUPABASE_NOT_CONFIGURED",
      },
      { status: 503 },
    );
  }

  const supabase = getSupabaseAdmin();

  const { data: settings, error: settingsError } = await supabase
    .from("personal_settings")
    .select(
      [
        "owner_id",
        "digest_enabled",
        "language",
        "country",
        "state",
        "district",
        "city",
        "timezone",
        "delivery_time",
      ].join(","),
    )
    .eq("digest_enabled", true)
    .limit(2);

  if (settingsError) {
    console.error("cron_settings_query_failed", {
      code: settingsError.code,
    });

    return NextResponse.json(
      {
        error: "Unable to load owner settings",
        code: "SETTINGS_QUERY_FAILED",
      },
      { status: 500 },
    );
  }

  if (!settings || settings.length === 0) {
    return NextResponse.json({
      status: "skipped",
      reason: "No enabled owner settings found",
    });
  }

  if (settings.length > 1) {
    return NextResponse.json(
      {
        error: "More than one enabled owner profile exists",
        code: "SINGLE_OWNER_CONSTRAINT_VIOLATION",
      },
      { status: 500 },
    );
  }

  /*
   * The original implementation marked deliveries as successful without
   * fetching news, formatting a digest, or sending a WhatsApp message.
   *
   * Do not create a delivery lock or success record until the complete
   * pipeline is implemented and tested.
   */
  return NextResponse.json(
    {
      error: "Daily digest pipeline is not implemented yet",
      code: "DIGEST_PIPELINE_NOT_IMPLEMENTED",
    },
    { status: 501 },
  );
}