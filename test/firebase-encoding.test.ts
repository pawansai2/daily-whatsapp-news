import { deterministicId } from "@/lib/firebase/encoding";

describe("deterministic Firestore document IDs", () => {
  it("uses the source row ID when present", () => {
    expect(deterministicId("opportunities", { id: "opportunity-1" }))
      .toBe("opportunity-1");
  });

  it("uses the delivery owner and occurrence key for retry-safe IDs", () => {
    const first = deterministicId("deliveries", {
      owner_id: "firebase-user-1",
      idempotency_key: "news-digest:2026-11-07:08:00",
    });

    expect(
      deterministicId("deliveries", {
        owner_id: "firebase-user-1",
        idempotency_key: "news-digest:2026-11-07:08:00",
      }),
    ).toBe(first);
    expect(
      deterministicId("deliveries", {
        owner_id: "firebase-user-2",
        idempotency_key: "news-digest:2026-11-07:08:00",
      }),
    ).not.toBe(first);
  });

  it("generates stable IDs for composite user-owned records", () => {
    const row = {
      user_id: "firebase-user-1",
      opportunity_id: "opportunity-1",
    };

    expect(
      deterministicId(
        "user_opportunity_tracking",
        row,
        ["user_id", "opportunity_id"],
      ),
    ).toBe(
      deterministicId(
        "user_opportunity_tracking",
        row,
        ["user_id", "opportunity_id"],
      ),
    );
    expect(() =>
      deterministicId("personal_settings", {}, ["owner_id"]),
    ).toThrow("Missing Firestore conflict field: owner_id");
  });
});
