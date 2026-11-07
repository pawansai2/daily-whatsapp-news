import { NextResponse } from "next/server";

import { createClient } from "@/lib/firebase/server";
import { loadOpportunityDetail } from "@/lib/opportunities/detail";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const uuid =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  if (!uuid.test(id)) {
    return NextResponse.json({ error: "Invalid opportunity ID." }, { status: 400 });
  }

  const store = await createClient();
  const { data: claims, error: claimsError } = await store.auth.getClaims();
  const userId = claims?.claims?.sub;
  if (claimsError || typeof userId !== "string") {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { data: settings } = await store
    .from("personal_settings")
    .select("timezone")
    .eq("owner_id", userId)
    .maybeSingle();

  try {
    const opportunity = await loadOpportunityDetail(
      store,
      userId,
      id,
      typeof settings?.timezone === "string" ? settings.timezone : "Asia/Kolkata",
    );
    if (!opportunity) {
      return NextResponse.json({ error: "Opportunity not found." }, { status: 404 });
    }
    return NextResponse.json(opportunity, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    console.error("opportunity_api_load_failed", {
      message: error instanceof Error ? error.message : "unknown",
    });
    return NextResponse.json(
      { error: "Opportunity could not be loaded." },
      { status: 500 },
    );
  }
}
