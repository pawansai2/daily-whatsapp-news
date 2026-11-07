import { z } from "zod";

const fieldColumn = {
  eligibleEducationLevels: "eligible_education_levels",
  eligibleGraduationYears: "eligible_graduation_years",
  eligibleBranches: "eligible_branches",
  eligibleCountries: "eligible_countries",
  teamSize: null,
  requiredSkills: "required_skills",
  individualEligible: "individual_eligible",
  teamEligible: "team_eligible",
  experienceRestrictions: "experience_restrictions",
  primaryDomain: "primary_domain",
  additionalDomains: "additional_domains",
  internshipPathway: "internship_pathway",
  jobPathway: "job_pathway",
  certificateAvailable: "certificate_available",
  travelSupport: "travel_support",
  accommodation: "accommodation",
  foodProvided: "food_provided",
  mentorship: "mentorship",
  networking: "networking",
  entryFeeAmount: "entry_fee_amount",
  entryFeeCurrency: "entry_fee_currency",
  participationFormat: "participation_format",
  registrationOpensOn: "registration_opens_on",
  registrationClosesOn: "registration_closes_on",
  submissionDeadline: "submission_deadline",
  officialApplicationUrl: "official_application_url",
} as const;

export type VerifiableField = keyof typeof fieldColumn;

export const VERIFIABLE_FIELDS = Object.keys(
  fieldColumn,
) as VerifiableField[];

const textList = z.array(z.string().trim().min(1).max(100)).max(30);
const httpsUrl = z.string().url().refine(
  (value) => new URL(value).protocol === "https:",
);
const dateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(
  (value) => {
    const date = new Date(`${value}T00:00:00.000Z`);
    return !Number.isNaN(date.getTime()) &&
      date.toISOString().slice(0, 10) === value;
  },
);

function parseList(raw: string): string[] {
  const normalized = raw.trim().toLowerCase();
  if (
    normalized === "none" ||
    normalized === "no restrictions" ||
    normalized === "no required skills" ||
    normalized === "not applicable"
  ) {
    return [];
  }
  if (!raw.trim()) {
    throw new Error("Enter a value or explicitly confirm none.");
  }
  return Array.from(new Set(
    raw.split(",").map((item) => item.trim()).filter(Boolean),
  ));
}

function parseValue(field: VerifiableField, raw: string): unknown {
  switch (field) {
    case "teamSize": {
      if (raw.trim().toLowerCase() === "none") {
        return { minimumTeamSize: null, maximumTeamSize: null };
      }
      const [minimumText, maximumText, ...extra] = raw.split(",");
      if (extra.length > 0) {
        throw new Error("Enter team-size limits as min,max or none.");
      }
      const minimum = minimumText?.trim()
        ? Number(minimumText)
        : null;
      const maximum = maximumText?.trim()
        ? Number(maximumText)
        : null;
      if (
        (minimum == null && maximum == null) ||
        (minimum != null && (!Number.isInteger(minimum) || minimum < 1)) ||
        (maximum != null && (!Number.isInteger(maximum) || maximum < 1)) ||
        (minimum != null && maximum != null && minimum > maximum)
      ) {
        throw new Error("Enter valid positive team-size limits.");
      }
      return {
        minimumTeamSize: minimum,
        maximumTeamSize: maximum,
      };
    }
    case "eligibleEducationLevels":
    case "eligibleBranches":
    case "eligibleCountries":
    case "requiredSkills":
    case "additionalDomains":
      return textList.parse(parseList(raw));
    case "eligibleGraduationYears":
      return z.array(z.number().int().min(1950).max(2100)).max(30)
        .parse(parseList(raw).map(Number));
    case "individualEligible":
    case "teamEligible":
    case "internshipPathway":
    case "jobPathway":
    case "certificateAvailable":
    case "travelSupport":
    case "accommodation":
    case "foodProvided":
    case "mentorship":
    case "networking":
      if (raw !== "true" && raw !== "false") {
        throw new Error("Choose a confirmed Yes or No value.");
      }
      return raw === "true";
    case "entryFeeAmount":
      if (!raw.trim()) {
        throw new Error("Enter the confirmed amount, including zero if free.");
      }
      return z.number().nonnegative().max(100_000_000)
        .parse(Number(raw));
    case "entryFeeCurrency":
      return z.string().regex(/^[A-Z]{3}$/)
        .parse(raw.trim().toUpperCase());
    case "registrationOpensOn":
    case "registrationClosesOn":
      return dateOnly.parse(raw);
    case "submissionDeadline":
      return z.string().datetime({ offset: true }).parse(raw);
    case "officialApplicationUrl":
      return httpsUrl.parse(raw);
    case "experienceRestrictions":
      if (["none", "no restrictions", "not applicable"].includes(
        raw.trim().toLowerCase(),
      )) {
        return "";
      }
      return z.string().trim().min(1).max(2000).parse(raw);
    case "primaryDomain":
    case "participationFormat":
      return z.string().trim().min(1).max(100).parse(raw);
  }
}

export function parseVerifiedFieldValue(
  field: string,
  raw: string,
): {
  field: VerifiableField;
  column: string | null;
  value: unknown;
} {
  if (!Object.hasOwn(fieldColumn, field)) {
    throw new Error("Unsupported evidence field.");
  }
  const typedField = field as VerifiableField;
  return {
    field: typedField,
    column: fieldColumn[typedField],
    value: parseValue(typedField, raw),
  };
}
