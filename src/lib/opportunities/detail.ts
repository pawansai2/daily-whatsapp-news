import type { FirebaseDataClient } from "@/lib/firebase/store";
import {
  evaluateEligibility,
  scoreOpportunity,
  type EligibilityProfile,
  type EligibilityResult,
  type OpportunityForScoring,
  type OpportunityScore,
} from "@/lib/opportunities/intelligence";
import { OPPORTUNITY_VERIFIED_FIELDS } from "@/lib/opportunities/schema";

type Row = Record<string, unknown>;

function str(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function num(value: unknown): number | null {
  if (typeof value !== "number" && typeof value !== "string") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function list(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null;
  return value.filter((item): item is string => typeof item === "string");
}

function safeUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

function verifiedFields(row: Row): string[] {
  const allowed = new Set<string>(OPPORTUNITY_VERIFIED_FIELDS);
  return (list(row.verified_fields) ?? []).filter((field) => allowed.has(field));
}

export function profileFromRow(row: Row | null): EligibilityProfile {
  return {
    educationLevel: str(row?.education_level),
    graduationYear: num(row?.graduation_year),
    branchOrDiscipline: str(row?.branch_or_discipline),
    countryOfEligibility: str(row?.eligibility_country),
    availableTeamSize: num(row?.available_team_size),
    individualTeamPreference:
      row?.individual_team_preference === "individual" ||
      row?.individual_team_preference === "team" ||
      row?.individual_team_preference === "either"
        ? row.individual_team_preference
        : null,
    skills: list(row?.technical_skills),
    preferredDomains: list(row?.preferred_domains),
    budgetLimitAmount: num(row?.budget_limit_amount),
    budgetLimitCurrency: str(row?.budget_limit_currency)?.toUpperCase() ?? null,
  };
}

export function scoringOpportunityFromRow(
  row: Row,
  verified: string[],
): OpportunityForScoring {
  return {
    title: String(row.title ?? ""),
    category: str(row.category),
    primaryDomain: str(row.primary_domain),
    additionalDomains: list(row.additional_domains),
    requiredSkills: list(row.required_skills),
    eligibleEducationLevels: list(row.eligible_education_levels),
    eligibleGraduationYears: Array.isArray(row.eligible_graduation_years)
      ? row.eligible_graduation_years.filter(
          (year): year is number => Number.isInteger(year),
        )
      : null,
    eligibleBranches: list(row.eligible_branches),
    eligibleCountries: list(row.eligible_countries),
    experienceRestrictions: str(row.experience_restrictions),
    individualEligible:
      typeof row.individual_eligible === "boolean"
        ? row.individual_eligible
        : null,
    teamEligible:
      typeof row.team_eligible === "boolean" ? row.team_eligible : null,
    minimumTeamSize: num(row.minimum_team_size),
    maximumTeamSize: num(row.maximum_team_size),
    registrationClosesOn: verified.includes("registrationClosesOn")
      ? str(row.registration_closes_on)
      : null,
    submissionDeadline: verified.includes("submissionDeadline")
      ? str(row.submission_deadline)
      : null,
    entryFeeAmount: verified.includes("entryFeeAmount")
      ? num(row.entry_fee_amount)
      : null,
    entryFeeCurrency: verified.includes("entryFeeCurrency")
      ? str(row.entry_fee_currency)
      : null,
    participationFormat: verified.includes("participationFormat")
      ? str(row.participation_format)
      : null,
    internshipPathway:
      typeof row.internship_pathway === "boolean"
        ? row.internship_pathway
        : null,
    jobPathway: typeof row.job_pathway === "boolean" ? row.job_pathway : null,
    certificateAvailable:
      typeof row.certificate_available === "boolean"
        ? row.certificate_available
        : null,
    travelSupport:
      typeof row.travel_support === "boolean" ? row.travel_support : null,
    accommodation:
      typeof row.accommodation === "boolean" ? row.accommodation : null,
    foodProvided:
      typeof row.food_provided === "boolean" ? row.food_provided : null,
    mentorship: typeof row.mentorship === "boolean" ? row.mentorship : null,
    networking: typeof row.networking === "boolean" ? row.networking : null,
    verificationStatus:
      row.verification_status === "officially_verified" ||
      row.verification_status === "official_source_partial" ||
      row.verification_status === "partially_verified" ||
      row.verification_status === "third_party_reported" ||
      row.verification_status === "pending_verification" ||
      row.verification_status === "conflicting"
        ? row.verification_status
        : "unverified",
  };
}

export type OpportunityDetail = {
  id: string;
  title: string;
  organizer: string | null;
  company: string | null;
  institution: string | null;
  description: string | null;
  category: string | null;
  subcategory: string | null;
  domains: string[];
  requiredSkills: string[];
  eligibility: EligibilityResult;
  score: OpportunityScore;
  verifiedFields: string[];
  verificationStatus: string;
  lifecycleStatus: string;
  firstDiscoveredAt: string | null;
  lastCheckedAt: string | null;
  lastVerifiedAt: string | null;
  registrationOpensOn: string | null;
  registrationClosesOn: string | null;
  submissionDeadline: string | null;
  eventStartsOn: string | null;
  eventEndsOn: string | null;
  location: string | null;
  geography: string | null;
  format: string | null;
  entryFeeAmount: number | null;
  entryFeeCurrency: string | null;
  prizeDetails: string | null;
  applicationUrl: string | null;
  announcementUrl: string;
  sourceLinks: Array<{ url: string; type: string; status: string }>;
  changes: Array<{
    fieldName: string;
    previousValue: unknown;
    newValue: unknown;
    changedAt: string;
  }>;
  trackingStatus: "saved" | "applied" | null;
};

export async function loadOpportunityDetail(
  store: Pick<FirebaseDataClient, "from">,
  userId: string,
  opportunityId: string,
  timezone = "Asia/Kolkata",
  now = new Date(),
): Promise<OpportunityDetail | null> {
  const { data: row, error } = await store
    .from("opportunities")
    .select("*")
    .eq("id", opportunityId)
    .maybeSingle();

  if (error) throw new Error(`Opportunity lookup failed: ${error.code}`);
  if (!row) return null;

  const [profileResult, trackingResult, sourcesResult, changesResult] =
    await Promise.all([
      store
        .from("opportunity_profiles")
        .select(
          "education_level,graduation_year,branch_or_discipline,eligibility_country,available_team_size,individual_team_preference,technical_skills,preferred_domains,budget_limit_amount,budget_limit_currency",
        )
        .eq("user_id", userId)
        .maybeSingle(),
      store
        .from("user_opportunity_tracking")
        .select("status")
        .eq("user_id", userId)
        .eq("opportunity_id", opportunityId)
        .maybeSingle(),
      store
        .from("opportunity_source_records")
        .select("source_url,source_type,verification_status")
        .eq("opportunity_id", opportunityId),
      store
        .from("opportunity_changes")
        .select("field_name,previous_value,new_value,changed_at")
        .eq("opportunity_id", opportunityId)
        .order("changed_at", { ascending: false }),
    ]);

  if (profileResult.error) {
    throw new Error(`Profile lookup failed: ${profileResult.error.code}`);
  }
  if (trackingResult.error) {
    throw new Error(`Tracking lookup failed: ${trackingResult.error.code}`);
  }
  if (sourcesResult.error) {
    throw new Error(`Provenance lookup failed: ${sourcesResult.error.code}`);
  }
  if (changesResult.error) {
    throw new Error(`Change history lookup failed: ${changesResult.error.code}`);
  }

  const verified = verifiedFields(row);
  const facts = scoringOpportunityFromRow(row, verified);
  const conflicts = list(row.eligibility_conflicts) ?? [];
  const eligibility = evaluateEligibility(
    profileFromRow(profileResult.data),
    facts,
    conflicts,
    verified,
  );
  const score = scoreOpportunity(profileFromRow(profileResult.data), facts, {
    now,
    timezone,
    verifiedFields: verified,
    eligibilityConflicts: conflicts,
  });

  return {
    id: String(row.id),
    title: String(row.title ?? "Untitled opportunity"),
    organizer: str(row.organizer),
    company: str(row.company),
    institution: str(row.institution),
    description: str(row.full_description) ?? str(row.short_description),
    category: str(row.category),
    subcategory: str(row.subcategory),
    domains: [
      ...(verified.includes("primaryDomain") && str(row.primary_domain)
        ? [String(row.primary_domain)]
        : []),
      ...(verified.includes("additionalDomains")
        ? list(row.additional_domains) ?? []
        : []),
    ],
    requiredSkills: verified.includes("requiredSkills")
      ? list(row.required_skills) ?? []
      : [],
    eligibility,
    score,
    verifiedFields: verified,
    verificationStatus: String(row.verification_status ?? "unverified"),
    lifecycleStatus: String(row.lifecycle_status ?? "unknown"),
    firstDiscoveredAt: str(row.first_discovered_at),
    lastCheckedAt: str(row.last_checked_at),
    lastVerifiedAt: str(row.last_verified_at),
    registrationOpensOn: verified.includes("registrationOpensOn")
      ? str(row.registration_opens_on)
      : null,
    registrationClosesOn: verified.includes("registrationClosesOn")
      ? str(row.registration_closes_on)
      : null,
    submissionDeadline: verified.includes("submissionDeadline")
      ? str(row.submission_deadline)
      : null,
    eventStartsOn: str(row.event_starts_on),
    eventEndsOn: str(row.event_ends_on),
    location: str(row.location),
    geography: str(row.geography),
    format: verified.includes("participationFormat")
      ? str(row.participation_format)
      : null,
    entryFeeAmount: verified.includes("entryFeeAmount")
      ? num(row.entry_fee_amount)
      : null,
    entryFeeCurrency: verified.includes("entryFeeCurrency")
      ? str(row.entry_fee_currency)
      : null,
    prizeDetails: str(row.prize_details),
    applicationUrl: verified.includes("officialApplicationUrl")
      ? safeUrl(row.official_application_url)
      : null,
    announcementUrl: safeUrl(row.canonical_url) ?? "",
    sourceLinks: (sourcesResult.data ?? []).flatMap((source) => {
      const url = safeUrl(source.source_url);
      return url
        ? [{
            url,
            type: String(source.source_type ?? "unknown"),
            status: String(source.verification_status ?? "unverified"),
          }]
        : [];
    }),
    changes: (changesResult.data ?? []).map((change) => ({
      fieldName: String(change.field_name ?? "Unknown field"),
      previousValue: change.previous_value,
      newValue: change.new_value,
      changedAt: String(change.changed_at ?? ""),
    })),
    trackingStatus:
      trackingResult.data?.status === "saved" ||
      trackingResult.data?.status === "applied"
        ? trackingResult.data.status
        : null,
  };
}
