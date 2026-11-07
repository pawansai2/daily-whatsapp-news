"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { OpportunityProfileSchema } from "@/lib/opportunities/profile";
import { createClient } from "@/lib/firebase/server";

function readString(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
}

function nullableNumber(value: string): number | null {
  return value === "" ? null : Number(value);
}

function nullableBoolean(value: string): boolean | null {
  if (value === "true") return true;
  if (value === "false") return false;
  return null;
}

function parseList(value: string): string[] {
  const unique = new Map<string, string>();
  for (const item of value.split(",")) {
    const text = item.trim();
    if (text && !unique.has(text.toLowerCase())) {
      unique.set(text.toLowerCase(), text);
    }
  }
  return Array.from(unique.values());
}

function returnToProfile(query: string): never {
  redirect(`/settings/opportunities?${query}`);
}

export async function saveOpportunityProfile(formData: FormData) {
  const firebaseStore = await createClient();
  const { data: claimsData, error: claimsError } =
    await firebaseStore.auth.getClaims();
  const userId = claimsData?.claims?.sub;

  if (claimsError || !userId) {
    redirect("/login");
  }

  const rawCurrency = readString(formData, "budgetLimitCurrency");
  const validation = OpportunityProfileSchema.safeParse({
    educationLevel: readString(formData, "educationLevel") || null,
    degree: readString(formData, "degree") || null,
    branchOrDiscipline:
      readString(formData, "branchOrDiscipline") || null,
    graduationYear: nullableNumber(
      readString(formData, "graduationYear"),
    ),
    countryOfEligibility:
      readString(formData, "countryOfEligibility") || null,
    currentStatus: readString(formData, "currentStatus") || null,
    availableTeamSize: nullableNumber(
      readString(formData, "availableTeamSize"),
    ),
    individualTeamPreference:
      readString(formData, "individualTeamPreference") || null,
    skills: parseList(readString(formData, "skills")),
    skillProficiency: readString(formData, "skillProficiency") || null,
    projects: readString(formData, "projects") || null,
    experience: readString(formData, "experience") || null,
    certifications: readString(formData, "certifications") || null,
    preferredDomains: parseList(
      readString(formData, "preferredDomains"),
    ),
    preferredFormats: (["online", "offline", "hybrid"] as const).filter(
      (format) => formData.get(`format_${format}`) === "on",
    ),
    preferredLocations: parseList(
      readString(formData, "preferredLocations"),
    ),
    travelAvailable: nullableBoolean(readString(formData, "travelAvailable")),
    internshipEligible: nullableBoolean(
      readString(formData, "internshipEligible"),
    ),
    employmentEligible: nullableBoolean(
      readString(formData, "employmentEligible"),
    ),
    budgetLimitAmount: nullableNumber(
      readString(formData, "budgetLimitAmount"),
    ),
    budgetLimitCurrency: rawCurrency
      ? rawCurrency.toUpperCase()
      : null,
    digestEnabled: formData.get("digestEnabled") === "on",
    minimumDigestScore: nullableNumber(
      readString(formData, "minimumDigestScore"),
    ),
  });

  if (!validation.success) {
    console.error("opportunity_profile_validation_failed", {
      issues: validation.error.issues.map((issue) =>
        issue.path.join("."),
      ),
    });
    returnToProfile("error=invalid_profile");
  }

  const profile = validation.data;
  const { error } = await firebaseStore
    .from("opportunity_profiles")
    .upsert(
      {
        user_id: userId,
        education_level: profile.educationLevel,
        degree: profile.degree,
        branch_or_discipline: profile.branchOrDiscipline,
        graduation_year: profile.graduationYear,
        eligibility_country: profile.countryOfEligibility,
        current_status: profile.currentStatus,
        available_team_size: profile.availableTeamSize,
        individual_team_preference:
          profile.individualTeamPreference,
        technical_skills: profile.skills,
        skill_proficiency: profile.skillProficiency,
        projects: profile.projects,
        experience: profile.experience,
        certifications: profile.certifications,
        preferred_domains: profile.preferredDomains,
        preferred_formats: profile.preferredFormats,
        preferred_locations: profile.preferredLocations,
        travel_available: profile.travelAvailable,
        internship_eligible: profile.internshipEligible,
        employment_eligible: profile.employmentEligible,
        budget_limit_amount: profile.budgetLimitAmount,
        budget_limit_currency: profile.budgetLimitCurrency,
        opportunity_digest_enabled: profile.digestEnabled,
        opportunity_digest_minimum_score:
          profile.minimumDigestScore,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    );

  if (error) {
    console.error("opportunity_profile_upsert_failed", {
      code: error.code,
    });
    returnToProfile("error=save_failed");
  }

  revalidatePath("/opportunities");
  revalidatePath("/settings/opportunities");
  returnToProfile("saved=1");
}
