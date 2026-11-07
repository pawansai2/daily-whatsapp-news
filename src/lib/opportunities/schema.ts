import { z } from "zod";

export const OPPORTUNITY_VERIFICATION_STATUSES = [
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

export const OPPORTUNITY_LIFECYCLE_STATUSES = [
  "unknown",
  "upcoming",
  "active",
  "closing_soon",
  "closed",
  "expired",
  "postponed",
  "cancelled",
] as const;

export const OPPORTUNITY_VERIFIED_FIELDS = [
  "eligibleEducationLevels",
  "eligibleGraduationYears",
  "eligibleBranches",
  "eligibleCountries",
  "teamSize",
  "individualEligible",
  "teamEligible",
  "requiredSkills",
  "experienceRestrictions",
  "primaryDomain",
  "additionalDomains",
  "internshipPathway",
  "jobPathway",
  "certificateAvailable",
  "travelSupport",
  "accommodation",
  "foodProvided",
  "mentorship",
  "networking",
  "entryFeeAmount",
  "entryFeeCurrency",
  "participationFormat",
  "registrationOpensOn",
  "registrationClosesOn",
  "submissionDeadline",
  "officialApplicationUrl",
] as const;

export type OpportunityDigestItem = {
  id: string;
  title: string;
  sourceUrl: string;
  deadline: string | null;
  score: number;
  eligibilityStatus: "eligible" | "likely_eligible";
};

const httpsUrl = z
  .string()
  .url()
  .refine((value) => new URL(value).protocol === "https:", {
    message: "URL must use HTTPS.",
  });

const dateOnly = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => {
    const date = new Date(`${value}T00:00:00.000Z`);
    return !Number.isNaN(date.getTime()) &&
      date.toISOString().slice(0, 10) === value;
  }, {
    message: "Date must be a valid calendar date.",
  });

const nullableTextList = z.array(z.string().trim().min(1)).nullable().optional();

export const OpportunityDraftSchema = z.object({
  canonicalUrl: httpsUrl,
  canonicalUrlHash: z.string().regex(/^[0-9a-f]{64}$/),
  title: z.string().trim().min(1).max(500),
  organizer: z.string().trim().max(300).nullable().optional(),
  shortDescription: z.string().max(2000).nullable().optional(),
  fullDescription: z.string().max(50000).nullable().optional(),
  category: z.string().trim().max(100).nullable().optional(),
  primaryDomain: z.string().trim().max(100).nullable().optional(),
  additionalDomains: nullableTextList,
  requiredSkills: nullableTextList,
  difficultyLevel: z.string().trim().max(50).nullable().optional(),
  geography: z.string().trim().max(100).nullable().optional(),
  location: z.string().trim().max(300).nullable().optional(),
  participationFormat: z.string().trim().max(100).nullable().optional(),
  individualEligible: z.boolean().nullable().optional(),
  teamEligible: z.boolean().nullable().optional(),
  minimumTeamSize: z.number().int().positive().nullable().optional(),
  maximumTeamSize: z.number().int().positive().nullable().optional(),
  eligibleEducationLevels: nullableTextList,
  eligibleGraduationYears: z.array(z.number().int()).nullable().optional(),
  eligibleBranches: nullableTextList,
  eligibleCountries: nullableTextList,
  experienceRestrictions: z.string().max(2000).nullable().optional(),
  registrationOpensOn: dateOnly.nullable().optional(),
  registrationClosesOn: dateOnly.nullable().optional(),
  submissionDeadline: z.string().datetime({ offset: true }).nullable().optional(),
  eventStartsOn: dateOnly.nullable().optional(),
  eventEndsOn: dateOnly.nullable().optional(),
  entryFeeAmount: z.number().nonnegative().nullable().optional(),
  entryFeeCurrency: z.string().regex(/^[A-Z]{3}$/).nullable().optional(),
  prizeDetails: z.string().max(5000).nullable().optional(),
  certificateAvailable: z.boolean().nullable().optional(),
  travelSupport: z.boolean().nullable().optional(),
  accommodation: z.boolean().nullable().optional(),
  foodProvided: z.boolean().nullable().optional(),
  mentorship: z.boolean().nullable().optional(),
  networking: z.boolean().nullable().optional(),
  internshipPathway: z.boolean().nullable().optional(),
  jobPathway: z.boolean().nullable().optional(),
  officialApplicationUrl: httpsUrl.nullable().optional(),
  eligibilityConflicts: z.array(z.string().trim().min(1).max(500))
    .max(20)
    .default([]),
  verificationStatus: z.enum(OPPORTUNITY_VERIFICATION_STATUSES)
    .default("pending_verification"),
  verifiedFields: z.array(z.enum(OPPORTUNITY_VERIFIED_FIELDS)).default([]),
  lifecycleStatus: z.enum(OPPORTUNITY_LIFECYCLE_STATUSES)
    .default("unknown"),
  dataCompleteness: z.number().int().min(0).max(100).nullable().optional(),
}).strict().superRefine((opportunity, context) => {
  if (
    opportunity.minimumTeamSize != null &&
    opportunity.maximumTeamSize != null &&
    opportunity.minimumTeamSize > opportunity.maximumTeamSize
  ) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["maximumTeamSize"],
      message: "Maximum team size must not be smaller than minimum team size.",
    });
  }

  if (
    opportunity.registrationOpensOn &&
    opportunity.registrationClosesOn &&
    opportunity.registrationOpensOn > opportunity.registrationClosesOn
  ) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["registrationClosesOn"],
      message: "Registration closing date must not precede its opening date.",
    });
  }

  if (
    opportunity.eventStartsOn &&
    opportunity.eventEndsOn &&
    opportunity.eventStartsOn > opportunity.eventEndsOn
  ) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["eventEndsOn"],
      message: "Event end date must not precede its start date.",
    });
  }
});

export type OpportunityDraft = z.infer<typeof OpportunityDraftSchema>;
