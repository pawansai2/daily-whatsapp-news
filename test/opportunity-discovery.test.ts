import {
  canonicalizeOpportunityUrl,
  entryToCandidate,
  fetchRssSource,
  isLikelySameOpportunity,
  parseOpportunityRss,
  type OpportunitySource,
} from "@/lib/opportunities/rss";
import {
  runSourceTasksIndependently,
} from "@/lib/opportunities/discovery";
import {
  evaluateEligibility,
  scoreOpportunity,
  type EligibilityProfile,
  type OpportunityForScoring,
} from "@/lib/opportunities/intelligence";
import { buildTelegramDigestDetailed } from "@/lib/news/digest";

const source: OpportunitySource = {
  id: "8a21591b-bbb6-4d27-9f31-c0e99fb17aaa",
  name: "Official Research Feed",
  category: "Research",
  base_url: "https://source.example.org/feed.xml",
  source_type: "official",
  collection_method: "rss",
  supported_categories: ["research"],
  supported_domains: ["engineering"],
  rate_limit_seconds: 600,
  last_succeeded_at: null,
  consecutive_failures: 0,
};

const profile: EligibilityProfile = {
  educationLevel: "Undergraduate",
  graduationYear: 2027,
  branchOrDiscipline: "Computer Science",
  countryOfEligibility: "India",
  availableTeamSize: 3,
  individualTeamPreference: "team",
  skills: ["TypeScript", "Python"],
  preferredDomains: ["Software Engineering"],
  budgetLimitAmount: 1000,
  budgetLimitCurrency: "INR",
};

const opportunity: OpportunityForScoring = {
  title: "Engineering fellowship",
  category: "Fellowship",
  primaryDomain: "Software Engineering",
  additionalDomains: [],
  requiredSkills: ["TypeScript"],
  eligibleEducationLevels: ["Undergraduate"],
  eligibleGraduationYears: [2027],
  eligibleBranches: ["Computer Science"],
  eligibleCountries: ["India"],
  experienceRestrictions: null,
  individualEligible: false,
  teamEligible: true,
  minimumTeamSize: 2,
  maximumTeamSize: 4,
  registrationClosesOn: "2026-11-15",
  submissionDeadline: null,
  entryFeeAmount: 0,
  entryFeeCurrency: "INR",
  participationFormat: "Online",
  internshipPathway: true,
  jobPathway: false,
  certificateAvailable: true,
  travelSupport: null,
  accommodation: null,
  foodProvided: null,
  mentorship: null,
  networking: null,
  verificationStatus: "pending_verification",
};

const verifiedEligibilityFields = [
  "eligibleEducationLevels",
  "eligibleGraduationYears",
  "eligibleBranches",
  "eligibleCountries",
  "teamSize",
  "individualEligible",
  "teamEligible",
  "requiredSkills",
  "experienceRestrictions",
];

describe("Opportunity RSS discovery", () => {
  test("parses Atom links and records source publication dates", () => {
    const entries = parseOpportunityRss(`<?xml version="1.0"?>
      <feed xmlns="http://www.w3.org/2005/Atom">
        <entry>
          <title>Engineering fellowship applications open</title>
          <link rel="alternate" href="https://example.org/fellowship?utm_source=feed" />
          <updated>2026-11-06T12:00:00Z</updated>
          <summary>Apply for the research fellowship.</summary>
          <id>entry-17</id>
        </entry>
      </feed>`);

    expect(entries).toHaveLength(1);
    expect(entries[0].url).toBe(
      "https://example.org/fellowship?utm_source=feed",
    );
    expect(entries[0].publishedAt).toBe("2026-11-06T12:00:00.000Z");
  });

  test("canonicalizes tracking URLs and only retains explicit opportunity leads", () => {
    const canonicalUrl = canonicalizeOpportunityUrl(
      "https://Example.org/path/?utm_source=mail&id=4#details",
    );
    expect(canonicalUrl).toBe("https://example.org/path?id=4");

    const candidate = entryToCandidate(source, {
      title: "Applications open for engineering fellowship",
      description: "Apply by the stated deadline.",
      url: "https://example.org/program",
      sourceRecordKey: null,
      publishedAt: null,
    });
    expect(candidate?.opportunity.verificationStatus).toBe(
      "pending_verification",
    );
    expect(candidate?.opportunity.submissionDeadline).toBeUndefined();
    expect(
      entryToCandidate(source, {
        title: "New satellite image released",
        description: "A new picture of a planet.",
        url: "https://example.org/news",
        sourceRecordKey: null,
        publishedAt: null,
      }),
    ).toBeNull();
  });

  test("does not merge similar titles without organizer agreement or across conflicting deadlines", () => {
    const candidate = {
      title: "National engineering fellowship 2027",
      organizer: "Example Institute",
      category: "Research",
      submissionDeadline: "2027-01-31T23:59:00Z",
      registrationClosesOn: null,
    };

    expect(isLikelySameOpportunity(candidate, {
      ...candidate,
      title: "Engineering fellowship 2027 National",
    })).toBe(true);

    expect(isLikelySameOpportunity(candidate, {
      ...candidate,
      organizer: "Different Institute",
    })).toBe(false);

    expect(isLikelySameOpportunity(candidate, {
      ...candidate,
      submissionDeadline: "2027-02-28T23:59:00Z",
    })).toBe(false);
  });

  test("rejects malformed or unrelated XML feeds", () => {
    expect(() => parseOpportunityRss("<feed><entry>"))
      .toThrow();
    expect(() => parseOpportunityRss("<html><body>No feed</body></html>"))
      .toThrow();
  });

  test("retries a transient source failure and then parses its feed", async () => {
    let attempts = 0;
    const fetcher: typeof fetch = async () => {
      attempts += 1;
      if (attempts === 1) {
        return new Response("temporary failure", { status: 503 });
      }

      return new Response(
        `<rss><channel><item>
          <title>Engineering challenge applications</title>
          <link>https://example.org/challenge</link>
        </item></channel></rss>`,
        { status: 200 },
      );
    };

    const entries = await fetchRssSource(source, fetcher);

    expect(attempts).toBe(2);
    expect(entries).toHaveLength(1);
  });

  test("continues independent source tasks after one source fails", async () => {
    const outcomes = await runSourceTasksIndependently(
      ["unavailable", "healthy"],
      async (name) => {
        if (name === "unavailable") {
          throw new Error("offline");
        }
        return "collected";
      },
    );

    expect(outcomes.map((outcome) => outcome.status))
      .toEqual(["failed", "succeeded"]);
    expect(outcomes[1]).toMatchObject({
      source: "healthy",
      status: "succeeded",
      value: "collected",
    });
  });

  test("requires profile evidence for restricted fields and keeps unknown eligibility unresolved", () => {
    const result = evaluateEligibility(
      {
        ...profile,
        countryOfEligibility: null,
        availableTeamSize: null,
      },
      opportunity,
      [],
      verifiedEligibilityFields,
    );

    expect(result.status).toBe("potentially_eligible");
    expect(result.missingInformation).toEqual(
      expect.arrayContaining([
        "Your country of eligibility is missing from your profile.",
        "Your available team size is needed to evaluate this requirement.",
      ]),
    );
  });

  test("flags known mismatches and source eligibility conflicts separately", () => {
    const result = evaluateEligibility(
      {
        ...profile,
        graduationYear: 2028,
      },
      opportunity,
      [],
      verifiedEligibilityFields,
    );
    expect(result.status).toBe("ineligible");

    const conflicting = evaluateEligibility(
      profile,
      opportunity,
      ["Official and third-party eligibility details disagree."],
      verifiedEligibilityFields,
    );
    expect(conflicting.status).toBe("eligibility_conflict");
  });

  test("returns explainable deterministic scores and keeps urgency separate", () => {
    const options = {
      now: new Date("2026-11-06T12:00:00.000Z"),
      timezone: "Asia/Kolkata",
      verifiedFields: [
        ...verifiedEligibilityFields,
        "primaryDomain",
        "additionalDomains",
        "internshipPathway",
        "certificateAvailable",
        "entryFeeAmount",
        "participationFormat",
        "registrationClosesOn",
      ],
    };

    const first = scoreOpportunity(profile, opportunity, options);
    const second = scoreOpportunity(profile, opportunity, options);
    expect(first).toEqual(second);
    expect(first.score).toBeGreaterThanOrEqual(0);
    expect(first.score).toBeLessThanOrEqual(100);
    expect(first.relevanceScore).toBeGreaterThan(0);
    expect(first.deadlineUrgency).toBe(25);
    expect(first.components).toHaveLength(6);

    const laterDeadline = scoreOpportunity(profile, {
      ...opportunity,
      registrationClosesOn: "2026-12-06",
    }, options);
    expect(laterDeadline.relevanceScore).toBe(first.relevanceScore);
    expect(laterDeadline.deadlineUrgency).toBe(10);
    expect(laterDeadline.score).not.toBe(first.score);
  });

  test("does not score unknown or unverified benefits and warns when fee is unknown", () => {
    const result = scoreOpportunity(
      profile,
      {
        ...opportunity,
        entryFeeAmount: null,
        entryFeeCurrency: null,
      },
      {
        now: new Date("2026-11-06T12:00:00.000Z"),
      },
    );

    expect(
      result.components.find(
        (component) => component.name === "documentedBenefits",
      )?.points,
    ).toBe(0);
    expect(
      result.components.find(
        (component) => component.name === "careerValue",
      )?.points,
    ).toBe(0);
    expect(result.deadlineUrgency).toBeNull();
    expect(result.warnings).toContain(
      "Entry fee is unknown or unverified; no affordability points were awarded.",
    );
  });

  test("marks a fully matched profile eligible only with verified criteria", () => {
    const result = evaluateEligibility(
      profile,
      {
        ...opportunity,
        experienceRestrictions: "",
        verificationStatus: "officially_verified",
      },
      [],
      verifiedEligibilityFields,
    );

    expect(result.status).toBe("eligible");
    expect(result.missingInformation).toHaveLength(0);
  });

  test("includes source-backed high-relevance matches in the daily digest, not a push message", () => {
    const digest = buildTelegramDigestDetailed({
      stories: [],
      opportunities: [{
        id: "00000000-0000-4000-8000-000000000001",
        title: "Verified engineering fellowship",
        deadline: "2026-12-01",
        score: 82,
        eligibilityStatus: "eligible",
        sourceUrl: "https://example.org/official",
      }],
      interests: [],
      timezone: "Asia/Kolkata",
      language: "en",
    });

    expect(digest.message).toContain(
      "Opportunity matches with official-source evidence",
    );
    expect(digest.message).toContain("Verified engineering fellowship");
    expect(digest.message).toContain("82/100");
    expect(digest.message).toContain("https://example.org/official");
    expect(digest.includedOpportunityIds).toEqual([
      "00000000-0000-4000-8000-000000000001",
    ]);
    expect(digest.message.length).toBeLessThanOrEqual(4096);
  });

  test("prioritizes verified opportunities within Telegram message limit", () => {
    const digest = buildTelegramDigestDetailed({
      stories: [],
      opportunities: Array.from({ length: 10 }, (_, index) => ({
        id: `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
        title: `Fellowship ${index}`,
        deadline: null,
        score: 80 - index,
        eligibilityStatus: "likely_eligible" as const,
        sourceUrl: "https://example.org/official",
      })),
      interests: [],
      timezone: "Asia/Kolkata",
      language: "en",
    });

    expect(digest.includedOpportunityIds.length).toBeGreaterThan(0);
    expect(digest.message.length).toBeLessThanOrEqual(4096);
  });
});
