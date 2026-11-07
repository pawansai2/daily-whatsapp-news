import { extractOpportunityFacts } from "@/lib/opportunities/extraction";
import {
  entryToCandidate,
  isLikelySameOpportunity,
  type OpportunitySource,
} from "@/lib/opportunities/rss";

const source: OpportunitySource = {
  id: "source-1",
  name: "Example",
  category: "research",
  base_url: "https://example.org/feed",
  source_type: "official",
  collection_method: "rss",
  supported_categories: ["research"],
  supported_domains: ["software"],
  rate_limit_seconds: 0,
  last_succeeded_at: null,
  consecutive_failures: 0,
};

describe("conservative opportunity extraction", () => {
  test("extracts only explicitly stated format, team size, participation and fee", () => {
    const facts = extractOpportunityFacts({
      title: "National AI hackathon",
      description:
        "Hybrid event. Teams of 2-4. Individual participation allowed. Free registration.",
    });

    expect(facts).toMatchObject({
      participationFormat: "hybrid",
      minimumTeamSize: 2,
      maximumTeamSize: 4,
      individualEligible: true,
      teamEligible: true,
      entryFeeAmount: 0,
    });
  });

  test("keeps unknown facts null instead of guessing", () => {
    expect(extractOpportunityFacts({
      title: "Research call",
      description: "Applications are invited from researchers.",
    })).toEqual({});
  });

  test("extracts an explicit currency amount without treating it as verified", () => {
    const candidate = entryToCandidate(source, {
      title: "Innovation challenge applications open",
      description: "Registration fee INR 500. Online event.",
      url: "https://example.org/challenge",
      sourceRecordKey: null,
      publishedAt: null,
    });

    expect(candidate?.opportunity.entryFeeAmount).toBe(500);
    expect(candidate?.opportunity.entryFeeCurrency).toBe("INR");
    expect(candidate?.opportunity.participationFormat).toBe("online");
    expect(candidate?.opportunity.verifiedFields).toEqual([]);
    expect(candidate?.opportunity.verificationStatus).toBe("pending_verification");
  });

  test("deduplicates cross-source titles without organizer only at a high threshold", () => {
    const a = {
      title: "National engineering fellowship 2027",
      organizer: null,
      category: "research",
      submissionDeadline: null,
      registrationClosesOn: null,
    };
    expect(isLikelySameOpportunity(a, { ...a })).toBe(true);
    expect(isLikelySameOpportunity(a, {
      ...a,
      title: "Engineering fellowship 2027",
    })).toBe(true);
    expect(isLikelySameOpportunity(a, {
      ...a,
      title: "National design fellowship 2027",
    })).toBe(false);
  });
});
