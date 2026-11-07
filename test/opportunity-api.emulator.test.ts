jest.mock("server-only", () => ({}));

const runEmulator = process.env.RUN_FIRESTORE_EMULATOR_TEST === "1";
const emulatorTest = runEmulator ? test : test.skip;
const opportunityId = "00000000-0000-4000-8000-000000000001";

describe("opportunity APIs against the Firestore emulator", () => {
  emulatorTest("returns persisted opportunities and enforces authentication", async () => {
    process.env.FIRESTORE_EMULATOR_HOST = "127.0.0.1:8080";

    const clearResponse = await fetch(
      "http://127.0.0.1:8080/emulator/v1/projects/demo-opportunity-radar/databases/(default)/documents",
      { method: "DELETE" },
    );
    expect(clearResponse.ok).toBe(true);

    const { initializeApp } = await import("firebase-admin/app");
    const { getFirestore } = await import("firebase-admin/firestore");
    const { FirebaseDataClient } = await import("@/lib/firebase/store");
    const app = initializeApp(
      { projectId: "demo-opportunity-radar" },
      `api-test-${Date.now()}`,
    );
    const dbClient = new FirebaseDataClient(getFirestore(app));

    const inserted = await dbClient.from("opportunities").insert({
      id: opportunityId,
      canonical_url: "https://example.org/official-opportunity",
      canonical_url_hash: "a".repeat(64),
      title: "Verified engineering challenge",
      organizer: "Example Institute",
      category: "technical_competition",
      primary_domain: "software",
      short_description: "Build a real system.",
      first_discovered_at: "2026-11-07T12:00:00.000Z",
      last_checked_at: "2026-11-07T12:00:00.000Z",
      verification_status: "official_source_partial",
      lifecycle_status: "active",
      verified_fields: ["primaryDomain", "registrationClosesOn"],
      registration_closes_on: "2026-12-01",
      eligibility_conflicts: [],
    });
    expect(inserted.error).toBeNull();

    await dbClient.from("opportunity_source_records").insert({
      opportunity_id: opportunityId,
      source_id: "source-test",
      source_url: "https://example.org/official-opportunity",
      source_type: "official",
      verification_status: "official_source_partial",
    });

    const apiStore = {
      from: (table: string) => dbClient.from(table),
      auth: {
        getClaims: async (): Promise<{
          data: { claims: unknown };
          error: unknown;
        }> => ({
          data: { claims: { sub: "emulator-owner", email: "owner@example.com" } },
          error: null,
        }),
      },
    };

    jest.doMock("@/lib/firebase/server", () => ({
      createClient: async () => apiStore,
    }));

    const detailRoute = await import("@/app/api/opportunities/[id]/route");
    const listRoute = await import("@/app/api/opportunities/route");

    const detailResponse = await detailRoute.GET(
      new Request(`http://localhost/api/opportunities/${opportunityId}`),
      { params: Promise.resolve({ id: opportunityId }) },
    );
    expect(detailResponse.status).toBe(200);
    const detail = await detailResponse.json();
    expect(detail.id).toBe(opportunityId);
    expect(detail.announcementUrl).toBe(
      "https://example.org/official-opportunity",
    );
    expect(detail.sourceLinks).toHaveLength(1);
    expect(detail.score.score).toBeGreaterThanOrEqual(0);

    const listResponse = await listRoute.GET(
      new Request("http://localhost/api/opportunities"),
    );
    expect(listResponse.status).toBe(200);
    const list = await listResponse.json();
    expect(list.count).toBe(1);
    expect(list.items[0].id).toBe(opportunityId);

    apiStore.auth.getClaims = async () => ({
      data: { claims: null },
      error: { code: "NOT_AUTHORIZED", message: "Not authorized" },
    });
    const unauthorized = await listRoute.GET(
      new Request("http://localhost/api/opportunities"),
    );
    expect(unauthorized.status).toBe(401);
  }, 30_000);
});

export {};
