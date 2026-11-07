import {
  categoryCounts,
  filterOpportunities,
  DEFAULT_BROWSE_FILTERS,
  isClosingSoon,
  isExpiredOrCancelled,
  isVerified,
  sortOpportunities,
  viewCounts,
  type BrowseOpportunity,
} from "@/lib/opportunities/browse";
import {
  canonicalCategory,
  canonicalDomain,
  categoryLabel,
  classifyOpportunity,
} from "@/lib/opportunities/taxonomy";

describe("Opportunity taxonomy classification", () => {
  test("classifies hackathons and technical domains without inventing facts", () => {
    const result = classifyOpportunity({
      title: "National AI hackathon for students",
      description: "Build machine-learning prototypes. Applications close soon.",
    });

    expect(result.category).toBe("hackathon");
    expect(result.subcategory).toBe("national_hackathon");
    expect(result.domains).toContain("ai_ml");
  });

  test("classifies ideathons separately from innovation challenges", () => {
    expect(
      classifyOpportunity({
        title: "Design thinking ideathon",
        description: "Pitch an idea to solve a campus problem.",
      }).category,
    ).toBe("ideathon");

    expect(
      classifyOpportunity({
        title: "Industry-sponsored prototype challenge",
        description: "Build an MVP for a real-world problem statement.",
      }).category,
    ).toBe("innovation_challenge");
  });

  test("classifies competitions, events, internships, jobs, research and startups", () => {
    expect(
      classifyOpportunity({
        title: "Capture the flag cybersecurity competition",
        description: "Online CTF with beginner and advanced tracks.",
      }).category,
    ).toBe("technical_competition");

    expect(
      classifyOpportunity({
        title: "Developer conference and workshop",
        description: "Three days of technical talks and networking.",
      }).category,
    ).toBe("technical_event");

    expect(
      classifyOpportunity({
        title: "Summer research internship applications open",
        description: "Work with a university laboratory for eight weeks.",
      }).category,
    ).toBe("internship");

    expect(
      classifyOpportunity({
        title: "Off-campus fresher hiring drive",
        description: "Entry-level software roles for 2027 graduates.",
      }).category,
    ).toBe("employment");

    expect(
      classifyOpportunity({
        title: "Research grant call for proposals",
        description: "Sponsored projects in semiconductor design.",
      }).category,
    ).toBe("research");

    expect(
      classifyOpportunity({
        title: "Startup accelerator programme",
        description: "Seed funding and mentorship for early-stage founders.",
      }).category,
    ).toBe("startup");
  });

  test("uses a single source hint as fallback and leaves unknown values null", () => {
    const hinted = classifyOpportunity({
      title: "Applications now open",
      description: "See the official page for details.",
      sourceCategoryHints: ["research"],
      sourceDomainHints: ["space", "engineering"],
    });

    expect(hinted.category).toBe("research");
    expect(hinted.domains).toContain("interdisciplinary");

    const unknown = classifyOpportunity({
      title: "Applications now open",
      description: "See the official page for details.",
    });
    expect(unknown.category).toBeNull();
    expect(unknown.subcategory).toBeNull();
    expect(unknown.domains).toEqual([]);
  });

  test("normalizes aliases to canonical labels", () => {
    expect(canonicalCategory("education")).toBe("research");
    expect(canonicalCategory("Jobs")).toBe("employment");
    expect(canonicalCategory("hackathon")).toBe("hackathon");
    expect(categoryLabel("technical_competition")).toBe(
      "Technical Competitions",
    );
    expect(canonicalDomain("AI/ML")).toBe("ai_ml");
    expect(canonicalDomain("computer science")).toBe("software");
  });
});

const baseItem: BrowseOpportunity = {
  id: "opportunity-1",
  title: "National AI hackathon",
  organizer: "Example Institute",
  company: null,
  institution: "Example University",
  description: "Build AI prototypes",
  category: "hackathon",
  subcategory: "national_hackathon",
  domains: ["AI / ML / GenAI / Data Science"],
  format: "Online",
  geography: "India",
  location: null,
  registrationOpensOn: null,
  registrationClosesOn: "2026-11-10",
  submissionDeadline: null,
  entryFeeAmount: 0,
  verificationStatus: "official_source_partial",
  lifecycleStatus: "closing_soon",
  eligibilityStatus: "eligible",
  score: 80,
  trackingStatus: null,
};

const now = { now: new Date("2026-11-07T12:00:00.000Z") };

describe("Opportunity browse filters", () => {
  test("derives closing, verified and expired views from the same record", () => {
    expect(isClosingSoon(baseItem, "2026-11-07")).toBe(true);
    expect(isVerified(baseItem)).toBe(true);
    expect(isExpiredOrCancelled(baseItem, "2026-11-07")).toBe(false);
    expect(
      isExpiredOrCancelled(
        { ...baseItem, registrationClosesOn: "2026-11-01" },
        "2026-11-07",
      ),
    ).toBe(true);

    const counts = viewCounts(
      [
        baseItem,
        {
          ...baseItem,
          id: "opportunity-2",
          trackingStatus: "saved",
          category: "internship",
          domains: ["Software / Web / Mobile / Systems"],
          lifecycleStatus: "active",
          registrationClosesOn: "2026-12-10",
        },
      ],
      now,
    );

    expect(counts.all).toBe(2);
    expect(counts.closing_soon).toBe(1);
    expect(counts.verified).toBe(2);
    expect(counts.saved).toBe(1);
    expect(counts.expired).toBe(0);
  });

  test("filters by category, domain, fee, format, geography and query", () => {
    const items = [
      baseItem,
      {
        ...baseItem,
        id: "opportunity-2",
        title: "Software internship",
        category: "internship",
        domains: ["Software / Web / Mobile / Systems"],
        format: "Hybrid",
        geography: "Germany",
        entryFeeAmount: 250,
        trackingStatus: "saved" as const,
      },
    ];

    expect(
      filterOpportunities(items, { ...DEFAULT_BROWSE_FILTERS, category: "internship" }, now)
        .map((item) => item.id),
    ).toEqual(["opportunity-2"]);

    expect(
      filterOpportunities(items, { ...DEFAULT_BROWSE_FILTERS, domain: "ai_ml" }, now)
        .map((item) => item.id),
    ).toEqual(["opportunity-1"]);

    expect(
      filterOpportunities(items, { ...DEFAULT_BROWSE_FILTERS, fee: "paid" }, now)
        .map((item) => item.id),
    ).toEqual(["opportunity-2"]);

    expect(
      filterOpportunities(items, { ...DEFAULT_BROWSE_FILTERS, format: "hybrid" }, now)
        .map((item) => item.id),
    ).toEqual(["opportunity-2"]);

    expect(
      filterOpportunities(items, { ...DEFAULT_BROWSE_FILTERS, geography: "India" }, now)
        .map((item) => item.id),
    ).toEqual(["opportunity-1"]);

    expect(
      filterOpportunities(items, { ...DEFAULT_BROWSE_FILTERS, query: "internship" }, now)
        .map((item) => item.id),
    ).toEqual(["opportunity-2"]);

    expect(
      filterOpportunities(items, { ...DEFAULT_BROWSE_FILTERS, view: "saved" }, now)
        .map((item) => item.id),
    ).toEqual(["opportunity-2"]);
  });

  test("sorts by score or earliest deadline and counts categories", () => {
    const items = [
      { ...baseItem, id: "a", score: 40, registrationClosesOn: "2026-11-20" },
      { ...baseItem, id: "b", score: 90, registrationClosesOn: "2026-11-09" },
      {
        ...baseItem,
        id: "c",
        category: null,
        score: 10,
        registrationClosesOn: null,
      },
    ];

    expect(sortOpportunities(items, "score").map((item) => item.id))
      .toEqual(["b", "a", "c"]);
    expect(sortOpportunities(items, "deadline").map((item) => item.id))
      .toEqual(["b", "a", "c"]);

    const counts = categoryCounts(items);
    expect(counts.hackathon).toBe(2);
    expect(counts.internship).toBe(0);
  });
});
