import type { OpportunityDraft } from "@/lib/opportunities/schema";

export type EligibilityProfile = {
  educationLevel: string | null;
  graduationYear: number | null;
  branchOrDiscipline: string | null;
  countryOfEligibility: string | null;
  availableTeamSize: number | null;
  individualTeamPreference: "individual" | "team" | "either" | null;
  skills: string[] | null;
  preferredDomains: string[] | null;
  budgetLimitAmount: number | null;
  budgetLimitCurrency: string | null;
};

export type EligibilityStatus =
  | "eligible"
  | "likely_eligible"
  | "potentially_eligible"
  | "ineligible"
  | "eligibility_conflict";

export type EligibilityResult = {
  status: EligibilityStatus;
  reasons: string[];
  missingInformation: string[];
  conflicts: string[];
};

export type OpportunityForScoring = Pick<
  OpportunityDraft,
  | "title"
  | "category"
  | "primaryDomain"
  | "additionalDomains"
  | "requiredSkills"
  | "eligibleEducationLevels"
  | "eligibleGraduationYears"
  | "eligibleBranches"
  | "eligibleCountries"
  | "experienceRestrictions"
  | "individualEligible"
  | "teamEligible"
  | "minimumTeamSize"
  | "maximumTeamSize"
  | "registrationClosesOn"
  | "submissionDeadline"
  | "entryFeeAmount"
  | "entryFeeCurrency"
  | "participationFormat"
  | "internshipPathway"
  | "jobPathway"
  | "verificationStatus"
  | "certificateAvailable"
  | "travelSupport"
  | "accommodation"
  | "foodProvided"
  | "mentorship"
  | "networking"
>;

export type ScoreComponent = {
  name:
    | "eligibilityMatch"
    | "technicalDomainRelevance"
    | "deadlineFeasibility"
    | "careerValue"
    | "documentedBenefits"
    | "accessibilityAndCost";
  points: number;
  maximum: number;
  explanation: string;
};

export type OpportunityScore = {
  score: number;
  relevanceScore: number;
  deadlineUrgency: number | null;
  components: ScoreComponent[];
  reasons: string[];
  warnings: string[];
};

export type ScoreOpportunityOptions = {
  now?: Date;
  timezone?: string;
  eligibilityConflicts?: string[];
  verifiedFields?: string[];
};

const SCORE_WEIGHTS = {
  eligibilityMatch: 25,
  technicalDomainRelevance: 25,
  deadlineFeasibility: 15,
  careerValue: 15,
  documentedBenefits: 10,
  accessibilityAndCost: 10,
} as const;

function normalized(value: string): string {
  return value
    .normalize("NFKC")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function matchesRestriction(
  value: string | null,
  restrictions: string[] | null | undefined,
  label: string,
  field: string,
  verifiedFields: Set<string>,
  reasons: string[],
  missing: string[],
  conflicts: string[],
): void {
  if (!verifiedFields.has(field)) {
    missing.push(`${label} restriction has not been verified.`);
    return;
  }

  if (restrictions == null) {
    missing.push(`${label} restriction is not known.`);
    return;
  }

  if (restrictions.length === 0) {
    reasons.push(`No ${label.toLowerCase()} restriction is recorded.`);
    return;
  }

  if (!value) {
    missing.push(`Your ${label.toLowerCase()} is missing from your profile.`);
    return;
  }

  const allowed = restrictions.map(normalized);
  if (!allowed.includes(normalized(value))) {
    conflicts.push(
      `${label} restriction does not match your profile (${value}).`,
    );
    return;
  }

  reasons.push(`${label} matches the published restriction.`);
}

function compareGraduationYear(
  year: number | null,
  allowedYears: number[] | null | undefined,
  verifiedFields: Set<string>,
  reasons: string[],
  missing: string[],
  conflicts: string[],
): void {
  if (!verifiedFields.has("eligibleGraduationYears")) {
    missing.push("Graduation-year restrictions have not been verified.");
    return;
  }

  if (!allowedYears) {
    missing.push("Eligible graduation years are not known.");
    return;
  }

  if (allowedYears.length === 0) {
    reasons.push("No graduation-year restriction is recorded.");
    return;
  }

  if (year == null) {
    missing.push("Your graduation year is missing from your profile.");
    return;
  }

  if (!allowedYears.includes(year)) {
    conflicts.push(
      `Graduation year ${year} does not match the published restriction.`,
    );
    return;
  }

  reasons.push(`Graduation year ${year} matches the published restriction.`);
}

export function evaluateEligibility(
  profile: EligibilityProfile,
  opportunity: OpportunityForScoring,
  eligibilityConflicts: string[] = [],
  verifiedFieldNames: string[] = [],
): EligibilityResult {
  const reasons: string[] = [];
  const missingInformation: string[] = [];
  const conflicts = [...eligibilityConflicts];
  const verifiedFields = new Set(verifiedFieldNames);

  matchesRestriction(
    profile.educationLevel,
    opportunity.eligibleEducationLevels,
    "Education",
    "eligibleEducationLevels",
    verifiedFields,
    reasons,
    missingInformation,
    conflicts,
  );
  compareGraduationYear(
    profile.graduationYear,
    opportunity.eligibleGraduationYears,
    verifiedFields,
    reasons,
    missingInformation,
    conflicts,
  );
  matchesRestriction(
    profile.branchOrDiscipline,
    opportunity.eligibleBranches,
    "Branch or discipline",
    "eligibleBranches",
    verifiedFields,
    reasons,
    missingInformation,
    conflicts,
  );
  matchesRestriction(
    profile.countryOfEligibility,
    opportunity.eligibleCountries,
    "Country of eligibility",
    "eligibleCountries",
    verifiedFields,
    reasons,
    missingInformation,
    conflicts,
  );

  const hasTeamSizeRestriction =
    opportunity.minimumTeamSize != null ||
    opportunity.maximumTeamSize != null;

  if (!verifiedFields.has("teamSize")) {
    missingInformation.push("Team-size requirements have not been verified.");
  } else if (hasTeamSizeRestriction) {
    if (profile.availableTeamSize == null) {
      missingInformation.push(
        "Your available team size is needed to evaluate this requirement.",
      );
    } else if (
      (opportunity.minimumTeamSize != null &&
        profile.availableTeamSize < opportunity.minimumTeamSize) ||
      (opportunity.maximumTeamSize != null &&
        profile.availableTeamSize > opportunity.maximumTeamSize)
    ) {
      conflicts.push(
        `Available team size ${profile.availableTeamSize} is outside the published team-size range.`,
      );
    } else {
      reasons.push("Available team size matches the published requirement.");
    }
  } else {
    reasons.push("No team-size restriction is recorded.");
  }

  if (
    !verifiedFields.has("individualEligible") ||
    !verifiedFields.has("teamEligible")
  ) {
    missingInformation.push("Individual/team eligibility has not been verified.");
  } else if (
    verifiedFields.has("individualEligible") &&
    verifiedFields.has("teamEligible") &&
    opportunity.individualEligible === false &&
    opportunity.teamEligible === false
  ) {
    conflicts.push("The opportunity lists no supported participation mode.");
  } else if (
    verifiedFields.has("individualEligible") &&
    profile.individualTeamPreference === "individual" &&
    opportunity.individualEligible === false &&
    verifiedFields.has("teamEligible") &&
    opportunity.teamEligible === true
  ) {
    reasons.push(
      "Team participation is required; this differs from your preference but is not treated as an eligibility failure.",
    );
  }

  if (!verifiedFields.has("requiredSkills")) {
    missingInformation.push("Required skills have not been verified.");
  } else if (opportunity.requiredSkills == null) {
    missingInformation.push("Required skills are not known.");
  } else if (opportunity.requiredSkills.length > 0) {
    if (profile.skills == null) {
      missingInformation.push(
        "Your skills are missing from your profile; required skills cannot be confirmed.",
      );
    } else {
      const skillSet = new Set(profile.skills.map(normalized));
      const unmatched = opportunity.requiredSkills.filter(
        (skill) => !skillSet.has(normalized(skill)),
      );

      if (unmatched.length > 0) {
        missingInformation.push(
          `Required skills are not established in your profile: ${unmatched.join(", ")}.`,
        );
      } else {
        reasons.push("Your profile includes all listed required skills.");
      }
    }
  } else {
    reasons.push("No required skills are recorded.");
  }

  if (!verifiedFields.has("experienceRestrictions")) {
    missingInformation.push("Experience restrictions have not been verified.");
  } else if (opportunity.experienceRestrictions == null) {
    missingInformation.push("Experience restrictions are not known.");
  } else if (opportunity.experienceRestrictions.trim()) {
    missingInformation.push(
      "Experience restrictions need review; they are not inferred from free text.",
    );
  }

  const status: EligibilityStatus =
    conflicts.length > 0
      ? eligibilityConflicts.length > 0
        ? "eligibility_conflict"
        : "ineligible"
      : missingInformation.length > 0
        ? "potentially_eligible"
        : opportunity.verificationStatus === "officially_verified" &&
            reasons.length > 0
          ? "eligible"
          : "likely_eligible";

  return {
    status,
    reasons,
    missingInformation,
    conflicts,
  };
}

function dateInTimezone(value: Date, timezone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(value);
  const get = (type: string) =>
    parts.find((part) => part.type === type)?.value ?? "";

  return `${get("year")}-${get("month")}-${get("day")}`;
}

function deadlineDate(
  opportunity: OpportunityForScoring,
  timezone: string,
  verifiedFields: Set<string>,
): string | null {
  const dates: string[] = [];

  if (
    verifiedFields.has("registrationClosesOn") &&
    opportunity.registrationClosesOn
  ) {
    dates.push(opportunity.registrationClosesOn);
  }

  if (
    verifiedFields.has("submissionDeadline") &&
    opportunity.submissionDeadline
  ) {
    const parsed = new Date(opportunity.submissionDeadline);
    if (!Number.isNaN(parsed.getTime())) {
      dates.push(dateInTimezone(parsed, timezone));
    }
  }

  return dates.sort()[0] ?? null;
}

function daysUntilDeadline(
  deadline: string,
  now: Date,
  timezone: string,
): number {
  const today = dateInTimezone(now, timezone);
  const todayMs = Date.parse(`${today}T00:00:00.000Z`);
  const deadlineMs = Date.parse(`${deadline}T00:00:00.000Z`);
  return Math.floor((deadlineMs - todayMs) / 86_400_000);
}

function urgencyForDays(days: number): number {
  if (days < 0) return 0;
  if (days === 0) return 90;
  if (days <= 2) return 75;
  if (days <= 7) return 50;
  if (days <= 14) return 25;
  return 10;
}

function deadlineFeasibilityForDays(days: number): number {
  if (days < 0) return 0;
  if (days === 0) return 1;
  if (days <= 2) return 4;
  if (days <= 6) return 8;
  if (days <= 13) return 12;
  return SCORE_WEIGHTS.deadlineFeasibility;
}

function matchingShare(
  profileValues: string[] | null,
  opportunityValues: string[] | null | undefined,
  maximum: number,
): number {
  if (
    !profileValues ||
    profileValues.length === 0 ||
    !opportunityValues ||
    opportunityValues.length === 0
  ) {
    return 0;
  }

  const profileSet = new Set(profileValues.map(normalized));
  const matches = opportunityValues
    .filter((value) => profileSet.has(normalized(value))).length;
  return Math.round(maximum * Math.min(1, matches / opportunityValues.length));
}

function isVerifiedField(
  field: string,
  verifiedFields: Set<string>,
): boolean {
  return verifiedFields.has(field);
}

export function scoreOpportunity(
  profile: EligibilityProfile,
  opportunity: OpportunityForScoring,
  options: ScoreOpportunityOptions = {},
): OpportunityScore {
  const now = options.now ?? new Date();
  const timezone = options.timezone ?? "Asia/Kolkata";
  const verifiedFields = new Set(options.verifiedFields ?? []);
  const eligibility = evaluateEligibility(
    profile,
    opportunity,
    options.eligibilityConflicts,
    options.verifiedFields,
  );
  const warnings: string[] = [...eligibility.conflicts];

  const eligibilityPoints: Record<EligibilityStatus, number> = {
    eligible: 25,
    likely_eligible: 18,
    potentially_eligible: 8,
    ineligible: 0,
    eligibility_conflict: 0,
  };

  const domains = [
    ...(verifiedFields.has("primaryDomain") && opportunity.primaryDomain
      ? [opportunity.primaryDomain]
      : []),
    ...(verifiedFields.has("additionalDomains")
      ? opportunity.additionalDomains ?? []
      : []),
  ];
  const domainPoints = verifiedFields.has("primaryDomain") ||
    verifiedFields.has("additionalDomains")
    ? matchingShare(
    profile.preferredDomains,
    domains,
    15,
    )
    : 0;
  const skillPoints = verifiedFields.has("requiredSkills")
    ? matchingShare(
    profile.skills,
    opportunity.requiredSkills,
    10,
    )
    : 0;

  const deadline = deadlineDate(opportunity, timezone, verifiedFields);
  const days = deadline
    ? daysUntilDeadline(deadline, now, timezone)
    : null;
  const deadlinePoints = days == null
    ? 0
    : deadlineFeasibilityForDays(days);
  if (days != null && days < 0) {
    warnings.push("The earliest known deadline has passed.");
  }

  const careerFields = [
    ...(opportunity.internshipPathway === true &&
    isVerifiedField("internshipPathway", verifiedFields)
      ? ["Internship pathway"]
      : []),
    ...(opportunity.jobPathway === true &&
    isVerifiedField("jobPathway", verifiedFields)
      ? ["Job pathway"]
      : []),
  ];
  const careerPoints =
    (careerFields.includes("Internship pathway") ? 8 : 0) +
    (careerFields.includes("Job pathway") ? 7 : 0);

  const documentedBenefitFields = [
    ["certificateAvailable", opportunity.certificateAvailable],
    ["travelSupport", opportunity.travelSupport],
    ["accommodation", opportunity.accommodation],
    ["foodProvided", opportunity.foodProvided],
    ["mentorship", opportunity.mentorship],
    ["networking", opportunity.networking],
  ] as const;
  const documentedBenefits = documentedBenefitFields.filter(
    ([field, value]) => value === true &&
      isVerifiedField(field, verifiedFields),
  );
  const benefitPoints = Math.round(
    SCORE_WEIGHTS.documentedBenefits *
      documentedBenefits.length /
      documentedBenefitFields.length,
  );

  let accessibilityPoints = 0;
  if (
    opportunity.entryFeeAmount == null ||
    !verifiedFields.has("entryFeeAmount")
  ) {
    warnings.push(
      "Entry fee is unknown or unverified; no affordability points were awarded.",
    );
  } else if (opportunity.entryFeeAmount === 0) {
    accessibilityPoints += 6;
  } else {
    warnings.push(
      `Entry fee is ${opportunity.entryFeeAmount} ${opportunity.entryFeeCurrency ?? "(currency unknown)"}; confirm affordability.`,
    );

    if (
      profile.budgetLimitAmount != null &&
      profile.budgetLimitCurrency &&
      opportunity.entryFeeCurrency &&
      verifiedFields.has("entryFeeCurrency") &&
      profile.budgetLimitCurrency.toUpperCase() ===
        opportunity.entryFeeCurrency.toUpperCase() &&
      opportunity.entryFeeAmount <= profile.budgetLimitAmount
    ) {
      accessibilityPoints += 2;
    }
  }

  const format = verifiedFields.has("participationFormat") &&
    opportunity.participationFormat
    ? normalized(opportunity.participationFormat)
    : "";
  if (["online", "virtual", "remote", "hybrid"].includes(format)) {
    accessibilityPoints += 4;
  } else if (!format) {
    warnings.push("Participation format is unknown or unverified.");
  }

  const components: ScoreComponent[] = [
    {
      name: "eligibilityMatch",
      points: eligibilityPoints[eligibility.status],
      maximum: SCORE_WEIGHTS.eligibilityMatch,
      explanation: `Eligibility is ${eligibility.status.replaceAll("_", " ")}.`,
    },
    {
      name: "technicalDomainRelevance",
      points: domainPoints + skillPoints,
      maximum: SCORE_WEIGHTS.technicalDomainRelevance,
      explanation:
        `${domainPoints}/15 domain points and ${skillPoints}/10 skill points from explicit profile matches.`,
    },
    {
      name: "deadlineFeasibility",
      points: deadlinePoints,
      maximum: SCORE_WEIGHTS.deadlineFeasibility,
      explanation: days == null
        ? "Deadline is unknown; no feasibility points were awarded."
        : days < 0
          ? "The earliest known deadline has passed."
          : `${days} day(s) remain until the earliest known deadline.`,
    },
    {
      name: "careerValue",
      points: careerPoints,
      maximum: SCORE_WEIGHTS.careerValue,
      explanation: careerFields.length > 0
        ? `Verified: ${careerFields.join(", ")}.`
        : "No verified internship or job pathway is documented.",
    },
    {
      name: "documentedBenefits",
      points: benefitPoints,
      maximum: SCORE_WEIGHTS.documentedBenefits,
      explanation: documentedBenefits.length > 0
        ? `${documentedBenefits.length} explicitly verified benefit(s) are documented.`
        : "No explicitly verified benefits are documented.",
    },
    {
      name: "accessibilityAndCost",
      points: Math.min(
        SCORE_WEIGHTS.accessibilityAndCost,
        accessibilityPoints,
      ),
      maximum: SCORE_WEIGHTS.accessibilityAndCost,
      explanation: `${Math.min(
        SCORE_WEIGHTS.accessibilityAndCost,
        accessibilityPoints,
      )}/10 points from known cost and format information.`,
    },
  ];

  const score = components.reduce(
    (total, component) => total + component.points,
    0,
  );
  const relevanceScore = Math.round(
    (score - deadlinePoints) /
      (100 - SCORE_WEIGHTS.deadlineFeasibility) *
      100,
  );

  const reasons = [
    ...eligibility.reasons,
    ...components
      .filter((component) => component.points > 0)
      .map((component) => component.explanation),
  ];

  return {
    score,
    relevanceScore,
    deadlineUrgency: days == null ? null : urgencyForDays(days),
    components,
    reasons,
    warnings: Array.from(new Set(warnings)),
  };
}
