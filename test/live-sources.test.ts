import { fetchApiCandidates } from "@/lib/opportunities/api";
import {
  entryToCandidate,
  fetchRssSource,
  type OpportunitySource,
} from "@/lib/opportunities/rss";
import { DEFAULT_OPPORTUNITY_SOURCES } from "@/lib/opportunities/sources";

const runLive = process.env.RUN_LIVE_SOURCE_TEST === "1";
const liveTest = runLive ? test : test.skip;

describe("live source collection", () => {
  liveTest("fetches the reviewed official feeds and normalizes real candidates", async () => {
    const sources: OpportunitySource[] = DEFAULT_OPPORTUNITY_SOURCES.map(
      (source, index) => ({
        ...source,
        id: `live-${index + 1}`,
        supported_categories: [...source.supported_categories],
        supported_domains: [...source.supported_domains],
        last_succeeded_at: null,
        consecutive_failures: 0,
      }),
    );

    let totalEntries = 0;
    let totalCandidates = 0;

    for (const source of sources) {
      let seen = 0;
      let candidates;
      if (source.collection_method === "api") {
        candidates = await fetchApiCandidates(source);
        seen = candidates.length;
      } else {
        const entries = await fetchRssSource(source);
        seen = entries.length;
        candidates = entries.flatMap((entry) => {
          const candidate = entryToCandidate(source, entry);
          return candidate ? [candidate] : [];
        });
      }
      totalEntries += seen;
      totalCandidates += candidates.length;
      console.log(
        `live_source=${source.name}|entries=${seen}|candidates=${candidates.length}`,
      );
      expect(seen).toBeGreaterThan(0);
    }

    expect(totalEntries).toBeGreaterThan(0);
    expect(totalCandidates).toBeGreaterThan(0);
  }, 30_000);
});
