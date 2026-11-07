import Link from "next/link";
import { redirect } from "next/navigation";

import { AppNav } from "@/components/AppNav";
import {
  OpportunityList,
  type OpportunityListItem,
} from "@/app/opportunities/OpportunityList";
import {
  evaluateEligibility,
  scoreOpportunity,
  type EligibilityProfile,
  type OpportunityForScoring,
} from "@/lib/opportunities/intelligence";
import { OPPORTUNITY_VERIFIED_FIELDS } from "@/lib/opportunities/schema";
import { createClient } from "@/lib/firebase/server";

export const dynamic = "force-dynamic";

const verificationStatuses = [
  "discovered",
  "extracted",
  "officially_verified",
  "official_source_partial",
  "partially_verified",
  "third_party_reported",
  "pending_verification",
  "unverified",
  "conflicting",
  "cancelled",
  "postponed",
  "expired",
] as const;

const lifecycleStatuses = [
  "unknown",
  "upcoming",
  "active",
  "closing_soon",
  "closed",
  "expired",
  "postponed",
  "cancelled",
] as const;

function nullableNumber(value: unknown): number | null {
  if (typeof value !== "number" && typeof value !== "string") {
    return null;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function nullableString(value: unknown): string | null {
  return typeof value === "string" && value.trim()
    ? value
    : null;
}

function stringArray(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null;
  return value.filter((item): item is string =>
    typeof item === "string"
  );
}

function safeHttpsUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

function verificationStatus(value: unknown): typeof verificationStatuses[number] {
  return verificationStatuses.includes(
    value as typeof verificationStatuses[number],
  )
    ? value as typeof verificationStatuses[number]
    : "unverified";
}

function lifecycleStatus(value: unknown): typeof lifecycleStatuses[number] {
  return lifecycleStatuses.includes(
    value as typeof lifecycleStatuses[number],
  )
    ? value as typeof lifecycleStatuses[number]
    : "unknown";
}

function verifiedFieldNames(value: unknown): string[] {
  const fields = stringArray(value) ?? [];
  const allowed = new Set<string>(OPPORTUNITY_VERIFIED_FIELDS);
  return fields.filter((field) => allowed.has(field));
}

function verifiedBoolean(
  row: Record<string, unknown>,
  field: string,
  column: string,
  verifiedFields: string[],
): boolean | null {
  const value = row[column];
  return verifiedFields.includes(field) && typeof value === "boolean"
    ? value
    : null;
}

function validTimezone(value: unknown): string {
  if (typeof value !== "string" || !value.trim()) {
    return "Asia/Kolkata";
  }
  try {
    new Intl.DateTimeFormat("en", { timeZone: value }).format();
    return value;
  } catch {
    return "Asia/Kolkata";
  }
}

function nullableDate(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function toScoringOpportunity(row: Record<string, unknown>): {
  opportunity: OpportunityForScoring;
  verifiedFields: string[];
} {
  const verifiedFields = verifiedFieldNames(row.verified_fields);
  return {
    opportunity: {
      title: String(row.title ?? ""),
      category: nullableString(row.category),
      primaryDomain: nullableString(row.primary_domain),
      additionalDomains: stringArray(row.additional_domains),
      requiredSkills: stringArray(row.required_skills),
      eligibleEducationLevels: stringArray(
        row.eligible_education_levels,
      ),
      eligibleGraduationYears: Array.isArray(row.eligible_graduation_years)
        ? row.eligible_graduation_years.filter(
            (year): year is number => Number.isInteger(year),
          )
        : row.eligible_graduation_years === null
          ? null
          : null,
      eligibleBranches: stringArray(row.eligible_branches),
      eligibleCountries: stringArray(row.eligible_countries),
      experienceRestrictions: nullableString(
        row.experience_restrictions,
      ) ?? (row.experience_restrictions === "" ? "" : null),
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
      registrationClosesOn: verifiedFields.includes(
        "registrationClosesOn",
      )
        ? nullableDate(row.registration_closes_on)
        : null,
      submissionDeadline: verifiedFields.includes("submissionDeadline")
        ? nullableDate(row.submission_deadline)
        : null,
      entryFeeAmount: verifiedFields.includes("entryFeeAmount")
        ? nullableNumber(row.entry_fee_amount)
        : null,
      entryFeeCurrency: verifiedFields.includes("entryFeeCurrency")
        ? nullableString(row.entry_fee_currency)?.trim() ?? null
        : null,
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
      verificationStatus: verificationStatus(row.verification_status),
    },
    verifiedFields,
  };
}

function getProfile(
  row: Record<string, unknown> | null,
): EligibilityProfile {
  return {
    educationLevel: nullableString(row?.education_level),
    graduationYear: nullableNumber(row?.graduation_year),
    branchOrDiscipline: nullableString(row?.branch_or_discipline),
    countryOfEligibility: nullableString(row?.eligibility_country),
    availableTeamSize: nullableNumber(row?.available_team_size),
    individualTeamPreference:
      row?.individual_team_preference === "individual" ||
      row?.individual_team_preference === "team" ||
      row?.individual_team_preference === "either"
        ? row.individual_team_preference
        : null,
    skills: stringArray(row?.technical_skills),
    preferredDomains: stringArray(row?.preferred_domains),
    budgetLimitAmount: nullableNumber(row?.budget_limit_amount),
    budgetLimitCurrency:
      nullableString(row?.budget_limit_currency)?.trim() ?? null,
  };
}

export default async function OpportunitiesPage() {
  const firebaseStore = await createClient();
  const { data: claimsData, error: claimsError } =
    await firebaseStore.auth.getClaims();
  const userId = claimsData?.claims?.sub;

  if (claimsError || !userId) {
    redirect("/login");
  }

  const [
    { data: opportunityRows, error: opportunitiesError },
    { data: profileRow, error: profileError },
    { data: trackingRows, error: trackingError },
    { data: settings, error: settingsError },
  ] = await Promise.all([
    firebaseStore
      .from("opportunities")
      .select(
        "id,canonical_url,title,organizer,short_description,category,primary_domain,additional_domains,required_skills,participation_format,individual_eligible,team_eligible,minimum_team_size,maximum_team_size,eligible_education_levels,eligible_graduation_years,eligible_branches,eligible_countries,experience_restrictions,registration_closes_on,submission_deadline,entry_fee_amount,entry_fee_currency,certificate_available,travel_support,accommodation,food_provided,mentorship,networking,internship_pathway,job_pathway,official_application_url,eligibility_conflicts,verified_fields,verification_status,lifecycle_status",
      )
      .order("registration_closes_on", {
        ascending: true,
        nullsFirst: false,
      })
      .limit(100),
    firebaseStore
      .from("opportunity_profiles")
      .select(
        "education_level, branch_or_discipline, graduation_year, eligibility_country, available_team_size, individual_team_preference, technical_skills, preferred_domains, budget_limit_amount, budget_limit_currency",
      )
      .eq("user_id", userId)
      .maybeSingle(),
    firebaseStore
      .from("user_opportunity_tracking")
      .select("opportunity_id,status")
      .eq("user_id", userId),
    firebaseStore
      .from("personal_settings")
      .select("timezone")
      .eq("owner_id", userId)
      .maybeSingle(),
  ]);

  const rows = opportunityRows ?? [];
  const opportunityIds = rows
    .map((row) => row.id)
    .filter((id): id is string => typeof id === "string");
  const { data: sourceRows, error: sourcesError } =
    opportunityIds.length > 0
      ? await firebaseStore
          .from("opportunity_source_records")
          .select(
            "opportunity_id,source_url,source_type,verification_status",
          )
          .in("opportunity_id", opportunityIds)
      : { data: [], error: null };
  const { data: changeRows, error: changesError } =
    opportunityIds.length > 0
      ? await firebaseStore
          .from("opportunity_changes")
          .select(
            "opportunity_id,field_name,previous_value,new_value,changed_at",
          )
          .in("opportunity_id", opportunityIds)
          .order("changed_at", { ascending: false })
      : { data: [], error: null };

  const tracking = new Map<
    string,
    OpportunityListItem["trackingStatus"]
  >();
  for (const row of trackingRows ?? []) {
    tracking.set(
      row.opportunity_id,
      row.status === "saved" || row.status === "applied"
        ? row.status
        : null,
    );
  }
  const profile = getProfile(profileRow);
  const savedTimezone = settings?.timezone;
  const timezone = validTimezone(savedTimezone);
  const timezoneIsFallback =
    Boolean(savedTimezone) && savedTimezone !== timezone;
  const now = new Date();

  const items: OpportunityListItem[] = rows.map((row) => {
    const { opportunity, verifiedFields } = toScoringOpportunity(row);
    const eligibilityConflicts =
      stringArray(row.eligibility_conflicts) ?? [];
    const eligibility = evaluateEligibility(
      profile,
      opportunity,
      eligibilityConflicts,
      verifiedFields,
    );
    const score = scoreOpportunity(profile, opportunity, {
      now,
      timezone,
      verifiedFields,
      eligibilityConflicts,
    });
    const sourceLinks = (sourceRows ?? [])
      .filter((source) => source.opportunity_id === row.id)
      .flatMap((source) => {
        const url = safeHttpsUrl(source.source_url);
        return url
          ? [{
              url,
              type: String(source.source_type ?? "unknown"),
              status: String(source.verification_status ?? "unverified"),
            }]
          : [];
      });
    const history = (changeRows ?? [])
      .filter((change) => change.opportunity_id === row.id)
      .map((change) => ({
        fieldName: String(change.field_name ?? "Unknown field"),
        previousValue: change.previous_value,
        newValue: change.new_value,
        changedAt: String(change.changed_at ?? ""),
      }));

    return {
      id: String(row.id),
      title: String(row.title ?? "Untitled opportunity"),
      organizer: nullableString(row.organizer),
      description: nullableString(row.short_description),
      category: nullableString(row.category),
      domains: [
        ...(verifiedFields.includes("primaryDomain") &&
        typeof row.primary_domain === "string"
          ? [row.primary_domain]
          : []),
        ...(verifiedFields.includes("additionalDomains")
          ? stringArray(row.additional_domains) ?? []
          : []),
      ],
      format: verifiedFields.includes("participationFormat")
        ? nullableString(row.participation_format)
        : null,
      benefits: [
        {
          label: "Certificate",
          value: verifiedBoolean(
            row,
            "certificateAvailable",
            "certificate_available",
            verifiedFields,
          ),
        },
        {
          label: "Travel support",
          value: verifiedBoolean(
            row,
            "travelSupport",
            "travel_support",
            verifiedFields,
          ),
        },
        {
          label: "Accommodation",
          value: verifiedBoolean(
            row,
            "accommodation",
            "accommodation",
            verifiedFields,
          ),
        },
        {
          label: "Food",
          value: verifiedBoolean(
            row,
            "foodProvided",
            "food_provided",
            verifiedFields,
          ),
        },
        {
          label: "Mentorship",
          value: verifiedBoolean(
            row,
            "mentorship",
            "mentorship",
            verifiedFields,
          ),
        },
        {
          label: "Networking",
          value: verifiedBoolean(
            row,
            "networking",
            "networking",
            verifiedFields,
          ),
        },
        {
          label: "Internship pathway",
          value: verifiedBoolean(
            row,
            "internshipPathway",
            "internship_pathway",
            verifiedFields,
          ),
        },
        {
          label: "Job pathway",
          value: verifiedBoolean(
            row,
            "jobPathway",
            "job_pathway",
            verifiedFields,
          ),
        },
      ],
      registrationClosesOn: verifiedFields.includes(
        "registrationClosesOn",
      )
        ? nullableDate(row.registration_closes_on)
        : null,
      submissionDeadline: verifiedFields.includes("submissionDeadline")
        ? nullableDate(row.submission_deadline)
        : null,
      entryFeeAmount: verifiedFields.includes("entryFeeAmount")
        ? nullableNumber(row.entry_fee_amount)
        : null,
      entryFeeCurrency: verifiedFields.includes("entryFeeCurrency")
        ? nullableString(row.entry_fee_currency)?.trim() ?? null
        : null,
      verificationStatus: verificationStatus(row.verification_status),
      lifecycleStatus: lifecycleStatus(row.lifecycle_status),
      score: score.score,
      relevanceScore: score.relevanceScore,
      deadlineUrgency: score.deadlineUrgency,
      eligibilityStatus: eligibility.status,
      reasons: Array.from(
        new Set([...eligibility.reasons, ...score.reasons]),
      ),
      warnings: Array.from(
        new Set([
          ...eligibility.missingInformation,
          ...score.warnings,
        ]),
      ),
      sourceLinks,
      history,
      trackingStatus:
        tracking.get(String(row.id)) ?? null,
      applicationUrl: verifiedFields.includes("officialApplicationUrl")
        ? safeHttpsUrl(row.official_application_url)
        : null,
    };
  });

  const loadError =
    opportunitiesError ||
    profileError ||
    trackingError ||
    sourcesError ||
    changesError ||
    settingsError;

  return (
    <>
      <AppNav />
      <main className="min-h-screen bg-gray-50 p-6 sm:p-8">
        <div className="mx-auto max-w-6xl">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wide text-blue-700">
                Opportunity Radar
              </p>
              <h1 className="mt-1 text-3xl font-bold text-gray-950">
                Opportunities for you
              </h1>
              <p className="mt-2 max-w-2xl text-gray-600">
                Matches are explainable and based only on verified facts.
                Unknown eligibility stays unresolved; verify source details
                before applying.
              </p>
            </div>
            <Link
              href="/settings/opportunities"
              className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50"
            >
              Edit eligibility profile
            </Link>
          </div>

          {loadError ? (
            <div role="alert" className="mt-6 rounded-md border border-red-200 bg-red-50 p-4 text-red-800">
              Opportunity data could not be loaded. Confirm the Opportunity
              Radar database migration is applied and retry.
            </div>
          ) : null}
          {!profileRow ? (
            <div className="mt-6 rounded-md border border-blue-200 bg-blue-50 p-4 text-blue-900">
              Add your eligibility profile for more useful matching. Without
              it, opportunities remain potentially eligible.
            </div>
          ) : null}
          {timezoneIsFallback ? (
            <p role="status" className="mt-4 text-sm text-amber-800">
              Your saved timezone is invalid. Deadline scoring uses
              Asia/Kolkata until you correct the timezone in Settings.
            </p>
          ) : null}

          {!loadError && items.length === 0 ? (
            <div className="mt-8 rounded-xl border bg-white p-8 text-center">
              <h2 className="text-xl font-semibold text-gray-900">
                No verified opportunity leads yet
              </h2>
              <p className="mt-2 text-gray-600">
                New source announcements appear here after collection and
                verification. No sample opportunities are shown as real data.
              </p>
            </div>
          ) : null}

          {!loadError && items.length > 0 ? (
            <OpportunityList items={items} />
          ) : null}
        </div>
      </main>
    </>
  );
}
