import { runOpportunityDiscoveryDryRun } from "@/lib/opportunities/discovery";
import type { FirebaseDataClient } from "@/lib/firebase/store";

function emptySourceQuery() {
  const query = {
    select: () => query,
    eq: () => query,
    order: () => query,
    limit: () => query,
    then: (resolve: (value: unknown) => unknown) =>
      Promise.resolve({ data: [], error: null }).then(resolve),
  };
  return query;
}

describe("opportunity discovery dry run", () => {
  test("normalizes real source content without any persistence calls", async () => {
    const writes: string[] = [];
    const admin = {
      from: (table: string) => {
        const query = emptySourceQuery();
        return {
          ...query,
          insert: () => {
            writes.push(table);
            return query;
          },
          update: () => {
            writes.push(table);
            return query;
          },
          upsert: () => {
            writes.push(table);
            return query;
          },
          delete: () => {
            writes.push(table);
            return query;
          },
        };
      },
    } as unknown as FirebaseDataClient;

    const fetcher: typeof fetch = async () =>
      new Response(
        `<rss><channel><item>
          <title>National AI hackathon applications open</title>
          <link>https://example.org/hackathon</link>
          <description>Hybrid event. Teams of 2-4. Free registration.</description>
        </item></channel></rss>`,
        { status: 200 },
      );

    const result = await runOpportunityDiscoveryDryRun(
      admin,
      new Date("2026-11-07T12:00:00Z"),
      fetcher,
      10,
    );

    expect(result.persisted).toBe(0);
    expect(result.sourcesAttempted).toBeGreaterThan(0);
    expect(result.candidates.length).toBeGreaterThan(0);
    expect(result.candidates[0]).toMatchObject({
      category: "hackathon",
      extractedFields: expect.arrayContaining([
        "participationFormat",
        "teamSize",
        "entryFee",
      ]),
    });
    expect(writes).toEqual([]);
  });
});
