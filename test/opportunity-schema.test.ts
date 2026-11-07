import { OpportunityDraftSchema } from "@/lib/opportunities/schema";
import { OpportunityProfileSchema } from "@/lib/opportunities/profile";

const baseOpportunity = {
  canonicalUrl: "https://example.org/program",
  canonicalUrlHash: "a".repeat(64),
  title: "Engineering program",
};

describe("OpportunityDraftSchema", () => {
  test("preserves unknown facts as null instead of converting them to false or zero", () => {
    const result = OpportunityDraftSchema.safeParse({
      ...baseOpportunity,
      entryFeeAmount: null,
      certificateAvailable: null,
      submissionDeadline: null,
    });

    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.data.entryFeeAmount).toBeNull();
      expect(result.data.certificateAvailable).toBeNull();
      expect(result.data.submissionDeadline).toBeNull();
      expect(result.data.verificationStatus).toBe("pending_verification");
      expect(result.data.lifecycleStatus).toBe("unknown");
      expect(result.data.eligibilityConflicts).toEqual([]);
      expect(result.data.verifiedFields).toEqual([]);
    }
  });

  test("accepts only recognized verified fact fields", () => {
    expect(
      OpportunityDraftSchema.safeParse({
        ...baseOpportunity,
        verifiedFields: ["entryFeeAmount"],
      }).success,
    ).toBe(true);

    expect(
      OpportunityDraftSchema.safeParse({
        ...baseOpportunity,
        verifiedFields: ["guess"],
      }).success,
    ).toBe(false);
  });

  test("accepts an explicitly documented free fee without treating unknown as free", () => {
    const result = OpportunityDraftSchema.safeParse({
      ...baseOpportunity,
      entryFeeAmount: 0,
      entryFeeCurrency: "INR",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.entryFeeAmount).toBe(0);
    }
  });

  test("rejects non-HTTPS links, invalid calendar dates, and inconsistent team limits", () => {
    expect(
      OpportunityDraftSchema.safeParse({
        ...baseOpportunity,
        officialApplicationUrl: "http://example.org/apply",
      }).success,
    ).toBe(false);

    expect(
      OpportunityDraftSchema.safeParse({
        ...baseOpportunity,
        eventStartsOn: "2026-02-30",
      }).success,
    ).toBe(false);

    expect(
      OpportunityDraftSchema.safeParse({
        ...baseOpportunity,
        minimumTeamSize: 5,
        maximumTeamSize: 2,
      }).success,
    ).toBe(false);
  });
});

describe("OpportunityProfileSchema", () => {
  const profile = {
    educationLevel: null,
    degree: null,
    branchOrDiscipline: null,
    graduationYear: null,
    countryOfEligibility: null,
    availableTeamSize: null,
    individualTeamPreference: null,
    skills: [],
    preferredDomains: [],
    budgetLimitAmount: null,
    budgetLimitCurrency: null,
    digestEnabled: true,
    minimumDigestScore: 60,
  };

  test("accepts missing profile details without converting unknowns", () => {
    expect(OpportunityProfileSchema.safeParse(profile).success).toBe(true);
  });

  test("requires budget amount and currency together", () => {
    expect(
      OpportunityProfileSchema.safeParse({
        ...profile,
        budgetLimitAmount: 500,
      }).success,
    ).toBe(false);
  });

  test("rejects invalid year, team size, and currency values", () => {
    expect(
      OpportunityProfileSchema.safeParse({
        ...profile,
        graduationYear: 1890,
      }).success,
    ).toBe(false);
    expect(
      OpportunityProfileSchema.safeParse({
        ...profile,
        availableTeamSize: 0,
      }).success,
    ).toBe(false);
    expect(
      OpportunityProfileSchema.safeParse({
        ...profile,
        budgetLimitAmount: 500,
        budgetLimitCurrency: "US",
      }).success,
    ).toBe(false);
  });
});
