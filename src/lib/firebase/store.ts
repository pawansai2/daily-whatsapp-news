import "server-only";

import {
  type DocumentData,
  type Firestore,
  type Query,
  type QueryDocumentSnapshot,
} from "firebase-admin/firestore";

import { getFirebaseAdminFirestore } from "./admin";
import { deterministicId } from "./encoding";

export { hasFirebaseAdminConfiguration } from "./admin";

type StoreError = {
  code: string;
  message: string;
};

type StoreResult<T> = {
  data: T | null;
  error: StoreError | null;
};

type Filter = {
  field: string;
  operator:
    | "=="
    | "!="
    | ">="
    | "<="
    | ">"
    | "<"
    | "in"
    | "like"
    | "is"
    | "not-null";
  value: unknown;
};

type QueryOperation = "select" | "insert" | "upsert" | "update" | "delete";

// Firestore documents have no generated schema in this repository.
// The data client preserves the application's existing dynamic row access.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any> & { id: string };
type QueryData<Single extends boolean> = Single extends true
  ? Row | null
  : Row[];

function cleanValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(cleanValue);
  }

  if (value && typeof value === "object" && !(value instanceof Date)) {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, child]) => child !== undefined)
        .map(([key, child]) => [key, cleanValue(child)]),
    );
  }

  return value;
}

function errorFor(error: unknown): StoreError {
  const message =
    error instanceof Error ? error.message : "Unknown Firestore error.";
  const code =
    error && typeof error === "object" && "code" in error
      ? String(error.code)
      : "FIRESTORE_ERROR";

  if (
    code.includes("already-exists") ||
    message.includes("ALREADY_EXISTS")
  ) {
    return { code: "23505", message };
  }

  return { code, message };
}

function matches(row: Row, filters: Filter[]): boolean {
  return filters.every(({ field, operator, value }) => {
    const actual = row[field];

    switch (operator) {
      case "==":
        return actual === value;
      case "!=":
        return actual !== value;
      case ">":
        return actual != null && value != null && compareValues(actual, value) > 0;
      case ">=":
        return actual != null && value != null && compareValues(actual, value) >= 0;
      case "<":
        return actual != null && value != null && compareValues(actual, value) < 0;
      case "<=":
        return actual != null && value != null && compareValues(actual, value) <= 0;
      case "in":
        return Array.isArray(value) && value.includes(actual);
      case "like":
        return (
          typeof actual === "string" &&
          typeof value === "string" &&
          actual.startsWith(value.replace(/%+$/, ""))
        );
      case "is":
        return value === null ? actual == null : actual === value;
      case "not-null":
        return actual != null;
    }
  });
}

function compareValues(left: unknown, right: unknown): number {
  if (left == null || right == null) return 0;
  if (typeof left === "number" && typeof right === "number") {
    return left - right;
  }
  if (typeof left === "string" && typeof right === "string") {
    return left.localeCompare(right);
  }
  return 0;
}

function rowFromSnapshot(snapshot: QueryDocumentSnapshot<DocumentData>): Row {
  return {
    ...snapshot.data(),
    id: typeof snapshot.data().id === "string"
      ? snapshot.data().id
      : snapshot.id,
  };
}

export { deterministicId } from "./encoding";

function firestoreQuery(
  firestore: Firestore,
  table: string,
  filters: Filter[],
): Query<DocumentData> {
  let query: Query<DocumentData> = firestore.collection(table);
  const primaryFilter = filters.find(
    (filter) =>
      filter.operator === "==" ||
      (filter.operator === "in" &&
        Array.isArray(filter.value) &&
        filter.value.length <= 30),
  );

  if (primaryFilter) {
    if (primaryFilter.operator === "==") {
      query = query.where(
        primaryFilter.field,
        "==",
        toQueryValue(primaryFilter.value),
      );
    } else if (primaryFilter.operator === "in") {
      if (!Array.isArray(primaryFilter.value)) {
        throw new Error("Firestore 'in' queries require an array value.");
      }
      query = query.where(
        primaryFilter.field,
        "in",
        primaryFilter.value.map(toQueryValue),
      );
    }
  }

  return query;
}

type QueryScalar = string | number | boolean | null | Date;

function isQueryScalar(value: unknown): value is QueryScalar {
  return (
    value === null ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean" ||
    value instanceof Date
  );
}

function toQueryValue(
  value: unknown,
): QueryScalar | QueryScalar[] {
  if (isQueryScalar(value)) return value;
  if (Array.isArray(value) && value.every(isQueryScalar)) return value;
  throw new Error("Unsupported value in Firestore query.");
}

class FirestoreQuery<Single extends boolean = false>
  implements PromiseLike<StoreResult<QueryData<Single>>>
{
  private operation: QueryOperation = "select";
  private filters: Filter[] = [];
  private ordering: Array<{
    field: string;
    ascending: boolean;
    nullsFirst?: boolean;
  }> = [];
  private maximumRows: number | undefined;
  private payload: Record<string, unknown> | Record<string, unknown>[] | null =
    null;
  private conflictFields: string[] | undefined;
  private singleMode: "single" | "maybeSingle" | null = null;
  private returnsRows = false;

  constructor(
    private readonly firestore: Firestore,
    private readonly table: string,
  ) {}

  select(columns = "*"): this {
    void columns;
    this.returnsRows = true;
    return this;
  }

  eq(field: string, value: unknown): this {
    this.filters.push({ field, operator: "==", value });
    return this;
  }

  neq(field: string, value: unknown): this {
    this.filters.push({ field, operator: "!=", value });
    return this;
  }

  not(field: string, operator: string, value: unknown): this {
    if (operator === "is" && value === null) {
      this.filters.push({ field, operator: "not-null", value: null });
      return this;
    }

    throw new Error(`Unsupported Firestore negation: ${operator}`);
  }

  gt(field: string, value: unknown): this {
    this.filters.push({ field, operator: ">", value });
    return this;
  }

  gte(field: string, value: unknown): this {
    this.filters.push({ field, operator: ">=", value });
    return this;
  }

  lt(field: string, value: unknown): this {
    this.filters.push({ field, operator: "<", value });
    return this;
  }

  lte(field: string, value: unknown): this {
    this.filters.push({ field, operator: "<=", value });
    return this;
  }

  in(field: string, value: unknown[]): this {
    this.filters.push({ field, operator: "in", value });
    return this;
  }

  is(field: string, value: unknown): this {
    this.filters.push({ field, operator: "is", value });
    return this;
  }

  like(field: string, value: string): this {
    this.filters.push({ field, operator: "like", value });
    return this;
  }

  order(
    field: string,
    options: { ascending?: boolean; nullsFirst?: boolean } = {},
  ): this {
    this.ordering.push({
      field,
      ascending: options.ascending ?? true,
      nullsFirst: options.nullsFirst,
    });
    return this;
  }

  limit(count: number): this {
    this.maximumRows = count;
    return this;
  }

  single(): FirestoreQuery<true> {
    const query = Object.assign(
      new FirestoreQuery<true>(this.firestore, this.table),
      this,
    );
    query.singleMode = "single";
    return query;
  }

  maybeSingle(): FirestoreQuery<true> {
    const query = Object.assign(
      new FirestoreQuery<true>(this.firestore, this.table),
      this,
    );
    query.singleMode = "maybeSingle";
    return query;
  }

  insert(
    rows: Record<string, unknown> | Record<string, unknown>[],
  ): this {
    this.operation = "insert";
    this.payload = rows;
    return this;
  }

  upsert(
    rows: Record<string, unknown> | Record<string, unknown>[],
    options: { onConflict?: string } = {},
  ): this {
    this.operation = "upsert";
    this.payload = rows;
    this.conflictFields = options.onConflict
      ?.split(",")
      .map((field) => field.trim())
      .filter(Boolean);
    return this;
  }

  update(values: Record<string, unknown>): this {
    this.operation = "update";
    this.payload = values;
    return this;
  }

  delete(): this {
    this.operation = "delete";
    return this;
  }

  then<TResult1 = StoreResult<QueryData<Single>>, TResult2 = never>(
    onfulfilled?:
      | ((
          value: StoreResult<QueryData<Single>>,
        ) => TResult1 | PromiseLike<TResult1>)
      | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2> {
    return this.execute().then(onfulfilled, onrejected);
  }

  private async matchingDocuments(): Promise<
    QueryDocumentSnapshot<DocumentData>[]
  > {
    const snapshots = await firestoreQuery(
      this.firestore,
      this.table,
      this.filters,
    ).get();
    let documents = snapshots.docs.filter((doc) =>
      matches(rowFromSnapshot(doc), this.filters),
    );

    if (this.ordering.length > 0) {
      documents = documents.sort((left, right) => {
        const leftRow = rowFromSnapshot(left);
        const rightRow = rowFromSnapshot(right);

        for (const { field, ascending } of this.ordering) {
          const a = leftRow[field];
          const b = rightRow[field];
          const nullsFirst =
            this.ordering.find((ordering) => ordering.field === field)
              ?.nullsFirst ?? !ascending;
          const comparison =
            a == null
              ? b == null ? 0 : nullsFirst ? -1 : 1
              : b == null
                ? nullsFirst ? 1 : -1
                : compareValues(a, b);
          if (comparison !== 0) return ascending ? comparison : -comparison;
        }

        return 0;
      });
    }

    if (this.maximumRows !== undefined) {
      documents = documents.slice(0, this.maximumRows);
    }

    return documents;
  }

  private async writeRows(
    rows: Record<string, unknown>[],
    upsert: boolean,
  ): Promise<Row[]> {
    const saved: Row[] = [];

    for (const input of rows) {
      const value = cleanValue(input) as Record<string, unknown>;

      if (upsert && this.conflictFields?.length) {
        const collection = this.firestore.collection(this.table);
        const id = await this.firestore.runTransaction(async (transaction) => {
          const existing = await transaction.get(
            collection.where(
              this.conflictFields![0],
              "==",
              value[this.conflictFields![0]],
            ),
          );
          const found = existing.docs.find((doc) =>
            this.conflictFields!.every(
              (field) => doc.get(field) === value[field],
            ),
          );
          const reference =
            found?.ref ??
            collection.doc(
              deterministicId(this.table, value, this.conflictFields),
            );
          const rowId =
            value.id ?? found?.get("id") ?? reference.id;
          transaction.set(
            reference,
            { ...value, id: String(rowId) },
            { merge: true },
          );
          return reference.id;
        });
        saved.push({ ...value, id: String(value.id ?? id) });
        continue;
      }

      const id = deterministicId(this.table, value);
      const reference = this.firestore.collection(this.table).doc(id);
      if (upsert) {
        await reference.set(
          { ...value, id: String(value.id ?? id) },
          { merge: true },
        );
      } else {
        await reference.create({
          ...value,
          id: String(value.id ?? id),
        });
      }
      saved.push({ ...value, id: String(value.id ?? id) });
    }

    return saved;
  }

  private async execute(): Promise<StoreResult<QueryData<Single>>> {
    try {
      if (this.operation === "insert" || this.operation === "upsert") {
        const rows = Array.isArray(this.payload)
          ? this.payload
          : this.payload
            ? [this.payload]
            : [];
        const result = await this.writeRows(
          rows,
          this.operation === "upsert",
        );
        return {
          data: this.formatRows(result) as QueryData<Single>,
          error: null,
        };
      }

      const documents = await this.matchingDocuments();

      if (this.operation === "select") {
        return {
          data: this.formatRows(documents.map(rowFromSnapshot)) as QueryData<Single>,
          error: null,
        };
      }

      if (this.operation === "delete") {
        for (const document of documents) {
          await this.firestore.runTransaction(async (transaction) => {
            const current = await transaction.get(document.ref);
            if (
              current.exists &&
              matches(
                {
                  ...current.data(),
                  id: String(current.get("id") ?? current.id),
                },
                this.filters,
              )
            ) {
              transaction.delete(document.ref);
            }
          });
        }
        return { data: null, error: null };
      }

      const patch = cleanValue(this.payload ?? {}) as DocumentData;
      const updated: Row[] = [];
      for (const document of documents) {
        const saved = await this.firestore.runTransaction(async (transaction) => {
          const current = await transaction.get(document.ref);
          if (!current.exists) return null;
          const currentRow = {
            ...current.data(),
            id: String(current.get("id") ?? current.id),
          } as Row;
          if (!matches(currentRow, this.filters)) return null;
          transaction.set(document.ref, patch, { merge: true });
          return { ...currentRow, ...patch };
        });
        if (saved) updated.push(saved);
      }
      return {
        data: (this.returnsRows ? this.formatRows(updated) : null) as QueryData<Single>,
        error: null,
      };
    } catch (error) {
      return { data: null, error: errorFor(error) };
    }
  }

  private formatRows(rows: Row[]): Row | Row[] | null {
    if (this.singleMode === "single") {
      if (rows.length !== 1) {
        throw Object.assign(
          new Error(`Expected one ${this.table} document, found ${rows.length}.`),
          { code: "PGRST116" },
        );
      }
      return rows[0];
    }

    if (this.singleMode === "maybeSingle") {
      if (rows.length > 1) {
        throw Object.assign(
          new Error(`Expected at most one ${this.table} document, found ${rows.length}.`),
          { code: "PGRST116" },
        );
      }
      return rows[0] ?? null;
    }

    return rows;
  }
}

export class FirebaseDataClient {
  constructor(
    private readonly firestore: Firestore = getFirebaseAdminFirestore(),
  ) {}

  from(table: string): FirestoreQuery {
    if (!/^[a-z][a-z0-9_]*$/i.test(table)) {
      throw new Error(`Invalid Firestore collection name: ${table}`);
    }
    return new FirestoreQuery(this.firestore, table);
  }
}

export type { StoreError, StoreResult };

let cachedAdminClient: FirebaseDataClient | null = null;

export function getFirebaseAdminClient(): FirebaseDataClient {
  if (!cachedAdminClient) {
    cachedAdminClient = new FirebaseDataClient();
  }
  return cachedAdminClient;
}
