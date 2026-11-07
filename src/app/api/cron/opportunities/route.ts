import crypto from "node:crypto";
import { NextResponse } from "next/server";

import { runOpportunityDiscovery } from "@/lib/opportunities/discovery";
import { refreshOpportunityLifecycle } from "@/lib/opportunities/lifecycle";
import {
  getFirebaseAdminClient,
  hasFirebaseAdminConfiguration,
} from "@/lib/firebase/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function safeEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left, "utf8");
  const rightBuffer = Buffer.from(right, "utf8");

  return leftBuffer.length === rightBuffer.length &&
    crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET?.trim();
  if (!cronSecret) {
    return NextResponse.json(
      { error: "Cron is not configured.", code: "CRON_NOT_CONFIGURED" },
      { status: 503 },
    );
  }

  const authorization = request.headers.get("authorization") ?? "";
  if (!safeEqual(authorization, `Bearer ${cronSecret}`)) {
    return NextResponse.json(
      { error: "Unauthorized.", code: "INVALID_CRON_CREDENTIAL" },
      { status: 401 },
    );
  }

  if (!hasFirebaseAdminConfiguration()) {
    return NextResponse.json(
      { error: "Database configuration is missing.", code: "FIREBASE_ADMIN_NOT_CONFIGURED" },
      { status: 503 },
    );
  }

  const admin = getFirebaseAdminClient();
  try {
    const result = await runOpportunityDiscovery(admin);
    let lifecycleUpdated: number;
    try {
      lifecycleUpdated = await refreshOpportunityLifecycle(
        new Date().toISOString().slice(0, 10),
      );
    } catch (error) {
      console.error("opportunity_lifecycle_refresh_failed", {
        message: error instanceof Error ? error.message : "unknown",
      });
      return NextResponse.json(
        {
          ...result,
          status: "partial",
          error: "Discovery completed but lifecycle refresh failed.",
        },
        { status: 502, headers: { "Cache-Control": "no-store" } },
      );
    }

    return NextResponse.json({
      ...result,
      lifecycleUpdated,
    }, {
      status: result.status === "failed" ? 502 : 200,
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    console.error("opportunity_discovery_run_failed", {
      message: error instanceof Error ? error.message : "unknown",
    });
    return NextResponse.json(
      { error: "Opportunity collection could not be completed." },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }

}
