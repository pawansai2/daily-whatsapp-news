import { parseVerifiedFieldValue } from "@/lib/opportunities/verification";

describe("Manual opportunity fact verification", () => {
  test("normalizes typed lists and team-size bounds", () => {
    expect(
      parseVerifiedFieldValue(
        "eligibleCountries",
        "India, Singapore, India",
      ).value,
    ).toEqual(["India", "Singapore"]);
    expect(
      parseVerifiedFieldValue("eligibleCountries", "none").value,
    ).toEqual([]);
    expect(
      parseVerifiedFieldValue("teamSize", "2,5").value,
    ).toEqual({
      minimumTeamSize: 2,
      maximumTeamSize: 5,
    });
    expect(
      parseVerifiedFieldValue("teamSize", "none").value,
    ).toEqual({
      minimumTeamSize: null,
      maximumTeamSize: null,
    });
  });

  test("allows an explicitly verified absence of experience restrictions", () => {
    expect(
      parseVerifiedFieldValue("experienceRestrictions", "None").value,
    ).toBe("");
  });

  test("rejects malformed deadlines, unsafe URLs, unsupported fields, and invalid team bounds", () => {
    expect(() =>
      parseVerifiedFieldValue("submissionDeadline", "2026-02-30"),
    ).toThrow();
    expect(() =>
      parseVerifiedFieldValue(
        "officialApplicationUrl",
        "http://example.org/apply",
      ),
    ).toThrow();
    expect(() =>
      parseVerifiedFieldValue("teamSize", "5,2"),
    ).toThrow();
    expect(() =>
      parseVerifiedFieldValue("unknownField", "value"),
    ).toThrow();
    expect(() =>
      parseVerifiedFieldValue("eligibleCountries", ""),
    ).toThrow();
    expect(() =>
      parseVerifiedFieldValue("entryFeeAmount", ""),
    ).toThrow();
  });
});
