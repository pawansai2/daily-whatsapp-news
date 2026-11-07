import { z } from "zod";

const textList = z.array(z.string().trim().min(1).max(80)).max(30);

export const OpportunityProfileSchema = z.object({
  educationLevel: z.string().trim().max(100).nullable(),
  degree: z.string().trim().max(100).nullable(),
  branchOrDiscipline: z.string().trim().max(150).nullable(),
  graduationYear: z.number().int().min(1950).max(2100).nullable(),
  countryOfEligibility: z.string().trim().max(100).nullable(),
  currentStatus: z.string().trim().max(100).nullable().optional(),
  availableTeamSize: z.number().int().min(1).max(100).nullable(),
  individualTeamPreference: z.enum(["individual", "team", "either"])
    .nullable(),
  skills: textList,
  skillProficiency: z.string().trim().max(2000).nullable().optional(),
  projects: z.string().trim().max(5000).nullable().optional(),
  experience: z.string().trim().max(5000).nullable().optional(),
  certifications: z.string().trim().max(3000).nullable().optional(),
  preferredDomains: textList,
  preferredFormats: z.array(z.enum(["online", "offline", "hybrid"]))
    .max(3)
    .optional()
    .default([]),
  preferredLocations: textList.optional().default([]),
  travelAvailable: z.boolean().nullable().optional(),
  internshipEligible: z.boolean().nullable().optional(),
  employmentEligible: z.boolean().nullable().optional(),
  budgetLimitAmount: z.number().nonnegative().max(100_000_000).nullable(),
  budgetLimitCurrency: z.string().regex(/^[A-Z]{3}$/).nullable(),
  digestEnabled: z.boolean(),
  minimumDigestScore: z.number().int().min(0).max(100),
}).strict().superRefine((profile, context) => {
  if (
    (profile.budgetLimitAmount == null) !==
    (profile.budgetLimitCurrency == null)
  ) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["budgetLimitCurrency"],
      message: "Enter both a budget amount and its currency.",
    });
  }
});

export type OpportunityProfile = z.infer<typeof OpportunityProfileSchema>;
