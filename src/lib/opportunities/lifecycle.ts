import { randomUUID } from "node:crypto";

import { getFirebaseAdminFirestore } from "@/lib/firebase/admin";

type OpportunityLifecycleRow = {
  id: string;
  lifecycle_status: string;
  registration_opens_on?: string | null;
  registration_closes_on?: string | null;
  submission_deadline?: string | null;
  verified_fields?: string[] | null;
};

const terminalStatuses = new Set([
  "closed",
  "expired",
  "cancelled",
  "postponed",
]);

function utcDate(value: string | null | undefined): string | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? null
    : date.toISOString().slice(0, 10);
}

export async function refreshOpportunityLifecycle(
  asOfDate: string,
): Promise<number> {
  const asOfTime = Date.parse(`${asOfDate}T00:00:00.000Z`);
  if (!Number.isFinite(asOfTime)) {
    throw new Error("Opportunity lifecycle refresh requires a valid date.");
  }
  const closingSoonCutoff = new Date(
    asOfTime + 7 * 24 * 60 * 60 * 1000,
  )
    .toISOString()
    .slice(0, 10);
  const firestore = getFirebaseAdminFirestore();
  const opportunitySnapshots = await firestore
    .collection("opportunities")
    .get();
  let updatedCount = 0;

  for (const snapshot of opportunitySnapshots.docs) {
    const changed = await firestore.runTransaction(async (transaction) => {
      const currentSnapshot = await transaction.get(snapshot.ref);
      if (!currentSnapshot.exists) return false;

      const row = {
        ...currentSnapshot.data(),
        id: currentSnapshot.id,
      } as OpportunityLifecycleRow;
      if (terminalStatuses.has(row.lifecycle_status)) return false;

      const verified = new Set(row.verified_fields ?? []);
      const registrationDeadline = verified.has("registrationClosesOn")
        ? utcDate(row.registration_closes_on)
        : null;
      const submissionDeadline = verified.has("submissionDeadline")
        ? utcDate(row.submission_deadline)
        : null;
      const deadlines = [registrationDeadline, submissionDeadline]
        .filter((date): date is string => date !== null)
        .sort();
      const earliestDeadline = deadlines[0] ?? null;
      const openingDate = verified.has("registrationOpensOn")
        ? utcDate(row.registration_opens_on)
        : null;

      let nextStatus = row.lifecycle_status;
      if (earliestDeadline && earliestDeadline < asOfDate) {
        nextStatus = "expired";
      } else if (
        earliestDeadline &&
        earliestDeadline <= closingSoonCutoff
      ) {
        nextStatus = "closing_soon";
      } else if (openingDate && openingDate > asOfDate) {
        nextStatus = "upcoming";
      } else if (earliestDeadline) {
        nextStatus = "active";
      }

      if (nextStatus === row.lifecycle_status) return false;

      const updatedAt = new Date().toISOString();
      const changeReference = firestore
        .collection("opportunity_changes")
        .doc(randomUUID());
      transaction.update(snapshot.ref, {
        lifecycle_status: nextStatus,
        updated_at: updatedAt,
      });
      transaction.create(changeReference, {
        opportunity_id: row.id,
        field_name: "lifecycle_status",
        previous_value: row.lifecycle_status,
        new_value: nextStatus,
        change_reason:
          "Automated lifecycle refresh using verified dates.",
        changed_at: updatedAt,
      });
      return true;
    });

    if (changed) updatedCount += 1;
  }

  return updatedCount;
}
