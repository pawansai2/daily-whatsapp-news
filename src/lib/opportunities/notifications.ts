import type { FirebaseDataClient } from "@/lib/firebase/store";

import {
  evaluateEligibility,
  scoreOpportunity,
  type EligibilityProfile,
  type OpportunityForScoring,
} from "@/lib/opportunities/intelligence";
import {
  OPPORTUNITY_VERIFIED_FIELDS,
  type OpportunityDigestItem,
} from "@/lib/opportunities/schema";

function strings(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null;
  return value.filter((item): item is string =>
    typeof item === "string"
  );
}

function nullableString(value: unknown): string | null {
  return typeof value === "string" && value.trim()
    ? value.trim()
    : null;
}

function nullableNumber(value: unknown): number | null {
  if (typeof value !== "number" && typeof value !== "string") {
    return null;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function verifiedFields(value: unknown): string[] {
  const allowed = new Set<string>(OPPORTUNITY_VERIFIED_FIELDS);
  return (strings(value) ?? []).filter((field) => allowed.has(field));
}

function profileFromRow(row: Record<string, unknown>): EligibilityProfile {
  const preference = row.individual_team_preference;
  return {
    educationLevel: nullableString(row.education_level),
    graduationYear: nullableNumber(row.graduation_year),
    branchOrDiscipline: nullableString(row.branch_or_discipline),
    countryOfEligibility: nullableString(row.eligibility_country),
    availableTeamSize: nullableNumber(row.available_team_size),
    individualTeamPreference:
      preference === "individual" ||
      preference === "team" ||
      preference === "either"
        ? preference
        : null,
    skills: strings(row.technical_skills),
    preferredDomains: strings(row.preferred_domains),
    budgetLimitAmount: nullableNumber(row.budget_limit_amount),
    budgetLimitCurrency:
      nullableString(row.budget_limit_currency)?.toUpperCase() ?? null,
  };
}

function opportunityFromRow(
  row: Record<string, unknown>,
): OpportunityForScoring {
  const status = row.verification_status;
  const verificationStatus =
    status === "officially_verified" ||
    status === "official_source_partial" ||
    status === "partially_verified" ||
    status === "third_party_reported" ||
    status === "pending_verification" ||
    status === "conflicting"
      ? status
      : "unverified";

  return {
    title: String(row.title ?? ""),
    category: nullableString(row.category),
    primaryDomain: nullableString(row.primary_domain),
    additionalDomains: strings(row.additional_domains),
    requiredSkills: strings(row.required_skills),
    eligibleEducationLevels: strings(row.eligible_education_levels),
    eligibleGraduationYears: Array.isArray(row.eligible_graduation_years)
      ? row.eligible_graduation_years.filter(
          (year): year is number => Number.isInteger(year),
        )
      : null,
    eligibleBranches: strings(row.eligible_branches),
    eligibleCountries: strings(row.eligible_countries),
    experienceRestrictions:
      typeof row.experience_restrictions === "string"
        ? row.experience_restrictions
        : null,
    individualEligible:
      typeof row.individual_eligible === "boolean"
        ? row.individual_eligible
        : null,
    teamEligible:
      typeof row.team_eligible === "boolean"
        ? row.team_eligible
        : null,
    minimumTeamSize: nullableNumber(row.minimum_team_size),
    maximumTeamSize: nullableNumber(row.maximum_team_size),
    registrationClosesOn: nullableString(row.registration_closes_on),
    submissionDeadline: nullableString(row.submission_deadline),
    entryFeeAmount: nullableNumber(row.entry_fee_amount),
    entryFeeCurrency: nullableString(row.entry_fee_currency),
    participationFormat: nullableString(row.participation_format),
    internshipPathway:
      typeof row.internship_pathway === "boolean"
        ? row.internship_pathway
        : null,
    jobPathway:
      typeof row.job_pathway === "boolean" ? row.job_pathway : null,
    certificateAvailable:
      typeof row.certificate_available === "boolean"
        ? row.certificate_available
        : null,
    travelSupport:
      typeof row.travel_support === "boolean"
        ? row.travel_support
        : null,
    accommodation:
      typeof row.accommodation === "boolean"
        ? row.accommodation
        : null,
    foodProvided:
      typeof row.food_provided === "boolean"
        ? row.food_provided
        : null,
    mentorship:
      typeof row.mentorship === "boolean" ? row.mentorship : null,
    networking:
      typeof row.networking === "boolean" ? row.networking : null,
    verificationStatus,
  };
}

function validTimezone(value: string): string {
  try {
    new Intl.DateTimeFormat("en", { timeZone: value }).format();
    return value;
  } catch {
    return "Asia/Kolkata";
  }
}

export async function getOpportunityDigestItems(
  admin: FirebaseDataClient,
  userId: string,
  now: Date,
  timezone: string,
): Promise<OpportunityDigestItem[]> {
  const { data: rawProfile, error: profileError } = await admin
    .from("opportunity_profiles")
    .select(
      "user_id,education_level,graduation_year,branch_or_discipline,eligibility_country,available_team_size,individual_team_preference,technical_skills,preferred_domains,budget_limit_amount,budget_limit_currency,opportunity_digest_enabled,opportunity_digest_minimum_score",
    )
    .eq("user_id", userId)
    .maybeSingle();

  if (profileError) {
    throw new Error(
      `Opportunity digest profile query failed: ${profileError.code}`,
    );
  }
  if (!rawProfile || rawProfile.opportunity_digest_enabled !== true) {
    return [];
  }

  const profile = profileFromRow(
    rawProfile as unknown as Record<string, unknown>,
  );
  const { data: rawOpportunities, error: opportunityError } = await admin
    .from("opportunities")
    .select(
      "id,title,organizer,category,primary_domain,additional_domains,required_skills,participation_format,individual_eligible,team_eligible,minimum_team_size,maximum_team_size,eligible_education_levels,eligible_graduation_years,eligible_branches,eligible_countries,experience_restrictions,registration_closes_on,submission_deadline,entry_fee_amount,entry_fee_currency,certificate_available,travel_support,accommodation,food_provided,mentorship,networking,internship_pathway,job_pathway,eligibility_conflicts,verified_fields,verification_status,lifecycle_status",
    )
    .in("verification_status", [
      "officially_verified",
      "official_source_partial",
      "partially_verified",
    ])
    .in("lifecycle_status", ["upcoming", "active", "closing_soon"])
    .limit(500);
  if (opportunityError) {
    throw new Error(
      `Opportunity digest query failed: ${opportunityError.code}`,
    );
  }

  const rows = (rawOpportunities ?? []) as unknown as Record<
    string,
    unknown
  >[];
  const ids = rows
    .map((row) => row.id)
    .filter((id): id is string => typeof id === "string");
  if (ids.length === 0) return [];

  const { data: sources, error: sourceError } = await admin
    .from("opportunity_source_records")
    .select("opportunity_id,source_url")
    .in("opportunity_id", ids)
    .eq("source_type", "official")
    .in("verification_status", [
      "officially_verified",
      "official_source_partial",
    ]);
  if (sourceError) {
    throw new Error(
      `Opportunity digest source query failed: ${sourceError.code}`,
    );
  }

  const sourceByOpportunity = new Map<string, string>();
  for (const source of sources ?? []) {
    if (
      typeof source.opportunity_id === "string" &&
      typeof source.source_url === "string" &&
      /^https:\/\//i.test(source.source_url)
    ) {
      sourceByOpportunity.set(source.opportunity_id, source.source_url);
    }
  }

  const minimumScore =
    nullableNumber(rawProfile.opportunity_digest_minimum_score) ?? 60;
  const results: OpportunityDigestItem[] = [];
  for (const row of rows) {
    const id = typeof row.id === "string" ? row.id : "";
    const sourceUrl = sourceByOpportunity.get(id);
    const verified = verifiedFields(row.verified_fields);
    if (!id || !sourceUrl) continue;

    const facts = opportunityFromRow(row);
    const conflicts = strings(row.eligibility_conflicts) ?? [];
    const eligibility = evaluateEligibility(
      profile,
      facts,
      conflicts,
      verified,
    );
    const score = scoreOpportunity(profile, facts, {
      now,
      timezone: validTimezone(timezone),
      verifiedFields: verified,
      eligibilityConflicts: conflicts,
    });
    if (
      score.score < minimumScore ||
      (eligibility.status !== "eligible" &&
        eligibility.status !== "likely_eligible")
    ) {
      continue;
    }

    const deadline = verified.includes("registrationClosesOn")
      ? facts.registrationClosesOn ?? null
      : verified.includes("submissionDeadline")
        ? facts.submissionDeadline ?? null
        : null;
    const fee = verified.includes("entryFeeAmount") &&
      facts.entryFeeAmount != null
      ? `${facts.entryFeeAmount} ${facts.entryFeeCurrency ?? "(currency unknown)"}`
      : null;
    const participation = verified.includes("individualEligible") &&
      verified.includes("teamEligible")
      ? facts.individualEligible && facts.teamEligible
        ? "Individual or team"
        : facts.individualEligible
          ? "Individual"
          : facts.teamEligible
            ? "Team"
            : "Not specified"
      : null;
    const benefits = [
      facts.certificateAvailable ? "certificate" : null,
      facts.mentorship ? "mentorship" : null,
      facts.networking ? "networking" : null,
      facts.travelSupport ? "travel support" : null,
    ].filter((value): value is string => value !== null);

    results.push({
      id,
      title: facts.title,
      sourceUrl,
      deadline,
      score: score.score,
      eligibilityStatus: eligibility.status,
      organizer: nullableString(row.organizer),
      category: facts.category,
      domain: facts.primaryDomain,
      verificationStatus: facts.verificationStatus,
      format: verified.includes("participationFormat")
        ? facts.participationFormat
        : null,
      fee,
      participation,
      benefits,
      reasons: score.reasons.slice(0, 2),
    });
  }

  return results
    .sort((left, right) => right.score - left.score)
    .slice(0, 3);
}
