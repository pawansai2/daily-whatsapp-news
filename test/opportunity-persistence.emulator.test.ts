jest.mock("server-only", () => ({}));

const runEmulator = process.env.RUN_FIRESTORE_EMULATOR_TEST === "1";
const emulatorTest = runEmulator ? test : test.skip;

describe("opportunity persistence against the Firestore emulator", () => {
  emulatorTest(
    "persists real feed candidates, is idempotent, and records provenance and runs",
    async () => {
      process.env.FIRESTORE_EMULATOR_HOST = "127.0.0.1:8080";

      const clearResponse = await fetch(
        "http://127.0.0.1:8080/emulator/v1/projects/demo-opportunity-radar/databases/(default)/documents",
        { method: "DELETE" },
      );
      expect(clearResponse.ok).toBe(true);

      const { initializeApp } = await import("firebase-admin/app");
      const { getFirestore } = await import("firebase-admin/firestore");
      const { FirebaseDataClient } = await import("@/lib/firebase/store");
      const { runOpportunityDiscovery } = await import(
        "@/lib/opportunities/discovery"
      );

      const app = initializeApp(
        { projectId: "demo-opportunity-radar" },
        `emulator-test-${Date.now()}`,
      );
      const firestore = getFirestore(app);
      const client = new FirebaseDataClient(firestore);

      const first = await runOpportunityDiscovery(
        client,
        new Date("2026-11-07T12:00:00.000Z"),
      );

      expect(first.status).not.toBe("failed");
      expect(first.sourcesAttempted).toBeGreaterThan(0);
      expect(first.recordsAdded).toBeGreaterThan(0);
      expect(first.recordsSeen).toBeGreaterThan(0);

      const opportunitiesAfterFirst = await firestore
        .collection("opportunities")
        .get();
      expect(opportunitiesAfterFirst.size).toBe(first.recordsAdded);

      const firstOpportunity = opportunitiesAfterFirst.docs[0].data();
      expect(firstOpportunity.canonical_url).toMatch(/^https:\/\//);
      expect(firstOpportunity.first_discovered_at).toBe(
        "2026-11-07T12:00:00.000Z",
      );
      expect(firstOpportunity.last_checked_at).toBe(
        "2026-11-07T12:00:00.000Z",
      );
      expect(firstOpportunity.verification_status).toBe(
        "pending_verification",
      );
      expect(["unknown", "upcoming"]).toContain(
        firstOpportunity.lifecycle_status,
      );

      const sourceRecords = await firestore
        .collection("opportunity_source_records")
        .get();
      expect(sourceRecords.size).toBeGreaterThanOrEqual(first.recordsAdded);

      const runs = await firestore.collection("collection_runs").get();
      expect(runs.size).toBe(1);
      expect(runs.docs[0].get("status")).toBe(first.status);

      const second = await runOpportunityDiscovery(
        client,
        new Date("2026-11-07T19:00:00.000Z"),
      );

      expect(second.recordsAdded).toBe(0);
      const opportunitiesAfterSecond = await firestore
        .collection("opportunities")
        .get();
      expect(opportunitiesAfterSecond.size).toBe(first.recordsAdded);

      const runsAfterSecond = await firestore.collection("collection_runs").get();
      expect(runsAfterSecond.size).toBe(2);

      const sampleId = opportunitiesAfterSecond.docs[0].id;
      const { loadOpportunityDetail } = await import(
        "@/lib/opportunities/detail"
      );
      const detail = await loadOpportunityDetail(
        client,
        "emulator-user",
        sampleId,
        "Asia/Kolkata",
        new Date("2026-11-07T19:00:00.000Z"),
      );
      expect(detail).not.toBeNull();
      expect(detail?.announcementUrl).toMatch(/^https:\/\//);
      expect(detail?.sourceLinks.length).toBeGreaterThan(0);
      expect(detail?.verificationStatus).toBe("pending_verification");
      expect(detail?.eligibility.status).toBe("potentially_eligible");
      expect(detail?.score.score).toBeGreaterThanOrEqual(0);
      expect(detail?.score.score).toBeLessThanOrEqual(100);

      const profile = await client
        .from("opportunity_profiles")
        .upsert(
          {
            user_id: "emulator-user",
            education_level: "Undergraduate",
            graduation_year: 2027,
            branch_or_discipline: "Computer Science",
            eligibility_country: "India",
            technical_skills: ["Python"],
            preferred_domains: ["software"],
            updated_at: "2026-11-07T19:00:00.000Z",
          },
          { onConflict: "user_id" },
        );
      expect(profile.error).toBeNull();

      const tracking = await client
        .from("user_opportunity_tracking")
        .upsert(
          {
            user_id: "emulator-user",
            opportunity_id: sampleId,
            status: "saved",
            applied_at: null,
            updated_at: "2026-11-07T19:05:00.000Z",
          },
          { onConflict: "user_id,opportunity_id" },
        );
      expect(tracking.error).toBeNull();

      const detailWithTracking = await loadOpportunityDetail(
        client,
        "emulator-user",
        sampleId,
        "Asia/Kolkata",
        new Date("2026-11-07T19:05:00.000Z"),
      );
      expect(detailWithTracking?.trackingStatus).toBe("saved");
    },
    60_000,
  );
});

export {};
