import { createHash, randomUUID } from "node:crypto";

export function deterministicId(
  table: string,
  row: Record<string, unknown>,
  conflictFields?: string[],
): string {
  const fields = conflictFields?.length
    ? conflictFields
    : table === "deliveries" &&
        typeof row.owner_id === "string" &&
        typeof row.idempotency_key === "string"
      ? ["owner_id", "idempotency_key"]
      : typeof row.id === "string"
        ? ["id"]
        : [];

  if (fields.length === 0) return randomUUID();

  const key = fields.map((field) => {
    const value = row[field];
    if (value === undefined || value === null) {
      throw new Error(`Missing Firestore conflict field: ${field}`);
    }
    return `${field}:${typeof value === "string" ? value : JSON.stringify(value)}`;
  }).join("|");

  if (fields.length === 1 && fields[0] === "id") {
    return String(row.id);
  }

  return createHash("sha256").update(`${table}:${key}`).digest("hex");
}
