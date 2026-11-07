import { NextResponse } from "next/server";

import { createClient } from "@/lib/firebase/server";
import {
  profileFromRow,
  scoringOpportunityFromRow,
} from "@/lib/opportunities/detail";
import {
  evaluateEligibility,
  scoreOpportunity,
} from "@/lib/opportunities/intelligence";
import { OPPORTUNITY_VERIFIED_FIELDS } from "@/lib/opportunities/schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const store = await createClient();
  const { data: claims, error: claimsError } = await store.auth.getClaims();
  const userId = claims?.claims?.sub;
  if (claimsError || typeof userId !== "string") {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const url = new URL(request.url);
  const category = url.searchParams.get("category");
  const limit = Math.min(
    100,
    Math.max(1, Number(url.searchParams.get("limit") ?? "50") || 50),
  );

  let query = store
    .from("opportunities")
    .select("*")
    .order("first_discovered_at", { ascending: false })
    .limit(limit);
  if (category) query = query.eq("category", category);

  const [{ data: rows, error }, { data: profileRow }, { data: settings }] =
    await Promise.all([
      query,
      store
        .from("opportunity_profiles")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle(),
      store
        .from("personal_settings")
        .select("timezone")
        .eq("owner_id", userId)
        .maybeSingle(),
    ]);

  if (error) {
    return NextResponse.json(
      { error: "Opportunities could not be loaded." },
      { status: 500 },
    );
  }

  let timezone = "Asia/Kolkata";
  if (typeof settings?.timezone === "string") {
    try {
      new Intl.DateTimeFormat("en", { timeZone: settings.timezone }).format();
      timezone = settings.timezone;
    } catch {
      timezone = "Asia/Kolkata";
    }
  }

  const profile = profileFromRow(profileRow as Record<string, unknown> | null);
  const allowed = new Set<string>(OPPORTUNITY_VERIFIED_FIELDS);

  const items = (rows ?? []).map((row) => {
    const verifiedFields = Array.isArray(row.verified_fields)
      ? row.verified_fields.filter(
          (field): field is string =>
            typeof field === "string" && allowed.has(field),
        )
      : [];
    const facts = scoringOpportunityFromRow(
      row as Record<string, unknown>,
      verifiedFields,
    );
    const conflicts = Array.isArray(row.eligibility_conflicts)
      ? row.eligibility_conflicts.filter(
          (value): value is string => typeof value === "string",
        )
      : [];
    const eligibility = evaluateEligibility(
      profile,
      facts,
      conflicts,
      verifiedFields,
    );
    const score = scoreOpportunity(profile, facts, {
      timezone,
      verifiedFields,
      eligibilityConflicts: conflicts,
    });

    return {
      id: row.id,
      title: row.title,
      organizer: row.organizer ?? null,
      category: row.category ?? null,
      subcategory: row.subcategory ?? null,
      domains: facts.primaryDomain
        ? [facts.primaryDomain, ...(facts.additionalDomains ?? [])]
        : facts.additionalDomains ?? [],
      verifiedFields,
      verificationStatus: row.verification_status ?? "unverified",
      lifecycleStatus: row.lifecycle_status ?? "unknown",
      deadline:
        verifiedFields.includes("registrationClosesOn")
          ? row.registration_closes_on ?? null
          : verifiedFields.includes("submissionDeadline")
            ? row.submission_deadline ?? null
            : null,
      applicationUrl: verifiedFields.includes("officialApplicationUrl")
        ? row.official_application_url ?? null
        : null,
      announcementUrl: row.canonical_url ?? null,
      eligibility,
      score,
      firstDiscoveredAt: row.first_discovered_at ?? null,
      lastCheckedAt: row.last_checked_at ?? null,
    };
  });

  return NextResponse.json(
    { count: items.length, items },
    { headers: { "Cache-Control": "no-store" } },
  );
}
