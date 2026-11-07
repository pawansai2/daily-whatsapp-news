import { createHash } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { cert, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

const TABLES = [
  "profiles",
  "personal_settings",
  "personal_interests",
  "sent_article_hashes",
  "deliveries",
  "inbound_messages",
  "pending_confirmations",
  "user_channels",
  "telegram_link_tokens",
  "opportunities",
  "opportunity_sources",
  "opportunity_source_records",
  "opportunity_changes",
  "opportunity_field_evidence",
  "collection_runs",
  "collection_run_sources",
  "opportunity_profiles",
  "user_opportunity_tracking",
  "opportunity_alert_deliveries",
];

const OPTIONAL_OPPORTUNITY_TABLES = new Set([
  "opportunities",
  "opportunity_sources",
  "opportunity_source_records",
  "opportunity_changes",
  "opportunity_field_evidence",
  "collection_runs",
  "collection_run_sources",
  "opportunity_profiles",
  "user_opportunity_tracking",
  "opportunity_alert_deliveries",
]);

const INITIAL_OPPORTUNITY_SOURCES = [
  {
    name: "NASA Learning Resources",
    category: "Government and education",
    base_url: "https://www.nasa.gov/learning-resources/feed/",
    source_type: "official",
    collection_method: "rss",
    supported_categories: ["education", "research"],
    supported_domains: ["space", "engineering", "science"],
    rate_limit_seconds: 600,
    is_enabled: true,
    consecutive_failures: 0,
    notes:
      "Official NASA feed. Only items with explicit opportunity cues are retained; source facts remain pending verification.",
  },
  {
    name: "European Space Agency News",
    category: "Government and research",
    base_url: "https://www.esa.int/rss/news.en.rss",
    source_type: "official",
    collection_method: "rss",
    supported_categories: ["research", "innovation"],
    supported_domains: ["space", "engineering", "science"],
    rate_limit_seconds: 600,
    is_enabled: true,
    consecutive_failures: 0,
    notes:
      "Official ESA RSS feed. General news is not treated as an opportunity unless the announcement has explicit application or participation cues.",
  },
  {
    name: "Innovate UK Activity",
    category: "Government and funding",
    base_url: "https://www.gov.uk/government/organisations/innovate-uk.atom",
    source_type: "official",
    collection_method: "rss",
    supported_categories: ["funding", "grants", "innovation"],
    supported_domains: ["engineering", "science", "technology"],
    rate_limit_seconds: 600,
    is_enabled: true,
    consecutive_failures: 0,
    notes:
      "Official GOV.UK Atom feed for Innovate UK activity. Geographic eligibility is not inferred from source identity.",
  },
];

function requiredEnvironment(name) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function parseServiceAccount() {
  let credentials;
  try {
    credentials = JSON.parse(
      requiredEnvironment("FIREBASE_ADMIN_SERVICE_ACCOUNT_JSON"),
    );
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error("Firebase Admin service-account JSON is invalid.");
    }
    throw error;
  }

  if (
    typeof credentials.project_id !== "string" ||
    typeof credentials.client_email !== "string" ||
    typeof credentials.private_key !== "string"
  ) {
    throw new Error(
      "Firebase Admin service-account JSON is missing required fields.",
    );
  }
  return credentials;
}

async function listSupabaseUsers(client) {
  const users = [];
  for (let page = 1; ; page += 1) {
    const { data, error } = await client.auth.admin.listUsers({
      page,
      perPage: 1000,
    });
    if (error) {
      throw new Error(`Supabase auth user export failed: ${error.message}`);
    }
    users.push(...data.users);
    if (data.users.length < 1000) return users;
  }
}

async function listFirebaseUsers(auth) {
  const users = [];
  let pageToken;
  do {
    const page = await auth.listUsers(1000, pageToken);
    users.push(...page.users);
    pageToken = page.pageToken;
  } while (pageToken);
  return users;
}

function remapUserIds(table, input, userIdMap) {
  const row = { ...input };
  for (const field of ["owner_id", "user_id"]) {
    if (typeof row[field] !== "string") continue;
    const mapped = userIdMap.get(row[field]);
    if (!mapped) {
      throw new Error(
        `Cannot migrate ${table}: a row references an unmapped Supabase user.`,
      );
    }
    row[field] = mapped;
  }
  if (table === "profiles" && typeof row.id === "string") {
    const mapped = userIdMap.get(row.id);
    if (!mapped) {
      throw new Error("Cannot migrate profiles: a user ID is unmapped.");
    }
    row.id = mapped;
  }
  return row;
}

function documentId(table, row) {
  if (table === "inbound_messages" && row.provider_message_id) {
    return createHash("sha256")
      .update(`${table}:${row.provider_message_id}`)
      .digest("hex");
  }

  const conflictFields = {
    opportunity_profiles: ["user_id"],
    user_opportunity_tracking: ["user_id", "opportunity_id"],
    opportunity_alert_deliveries: [
      "user_id",
      "opportunity_id",
      "channel",
      "event_key",
    ],
  }[table];

  if (conflictFields) {
    const compoundKey = conflictFields
      .map((field) => {
        if (row[field] == null) {
          throw new Error(`Cannot migrate ${table}: missing ${field}.`);
        }
        return `${field}:${String(row[field])}`;
      })
      .join("|");
    return createHash("sha256")
      .update(`${table}:${compoundKey}`)
      .digest("hex");
  }

  if (table === "personal_settings") return String(row.owner_id);
  if (table === "profiles") return String(row.id);
  if (typeof row.id === "string") return row.id;
  if (typeof row.owner_id === "string") return row.owner_id;
  if (typeof row.user_id === "string") return row.user_id;
  throw new Error(`Cannot determine a stable Firestore document ID for ${table}.`);
}

function initialOpportunitySources() {
  const now = new Date().toISOString();
  return INITIAL_OPPORTUNITY_SOURCES.map((source) => ({
    ...source,
    id: createHash("sha256")
      .update(`opportunity_sources:name:${source.name}`)
      .digest("hex"),
    last_succeeded_at: null,
    last_failed_at: null,
    reliability_score: null,
    created_at: now,
    updated_at: now,
  }));
}

function stableJson(value) {
  if (Array.isArray(value)) {
    return `[${value.map(stableJson).join(",")}]`;
  }
  if (value && typeof value === "object") {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

async function main() {
  const apply = process.argv.includes("--apply");
  const supabase = createClient(
    requiredEnvironment("NEXT_PUBLIC_SUPABASE_URL"),
    requiredEnvironment("SUPABASE_SECRET_KEY"),
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );
  const credentials = parseServiceAccount();
  const projectId =
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID?.trim() ||
    credentials.project_id;
  if (projectId !== credentials.project_id) {
    throw new Error("Firebase web and Admin project IDs do not match.");
  }

  const firebaseApp = initializeApp({
    credential: cert({
      projectId: credentials.project_id,
      clientEmail: credentials.client_email,
      privateKey: credentials.private_key.replace(/\\n/g, "\n"),
    }),
    projectId: credentials.project_id,
  });
  const firebaseAuth = getAuth(firebaseApp);
  const firestore = getFirestore(firebaseApp);
  const [supabaseUsers, firebaseUsers] = await Promise.all([
    listSupabaseUsers(supabase),
    listFirebaseUsers(firebaseAuth),
  ]);
  const firebaseByEmail = new Map(
    firebaseUsers
      .filter((user) => user.email)
      .map((user) => [user.email.toLowerCase(), user.uid]),
  );
  const userIdMap = new Map();
  let unmappedUsers = 0;

  for (const user of supabaseUsers) {
    const uid =
      typeof user.email === "string"
        ? firebaseByEmail.get(user.email.toLowerCase())
        : undefined;
    if (uid) {
      userIdMap.set(user.id, uid);
    } else {
      unmappedUsers += 1;
    }
  }

  if (unmappedUsers > 0) {
    throw new Error(
      `${unmappedUsers} Supabase account(s) have no matching Firebase Auth user. Create or import those accounts with the same email, then rerun.`,
    );
  }

  const exports = [];
  for (const table of TABLES) {
    const tableRows = [];
    let missingOptionalTable = false;
    for (let offset = 0; ; offset += 1000) {
      const { data, error } = await supabase
        .from(table)
        .select("*")
        .range(offset, offset + 999);
      if (error) {
        if (
          OPTIONAL_OPPORTUNITY_TABLES.has(table) &&
          (error.code === "PGRST205" || error.code === "42P01")
        ) {
          missingOptionalTable = true;
          break;
        }
        throw new Error(
          `Supabase export failed for ${table}: ${error.message}`,
        );
      }
      tableRows.push(...(data ?? []));
      if ((data ?? []).length < 1000) break;
    }

    if (
      table === "opportunity_sources" &&
      tableRows.length === 0 &&
      missingOptionalTable
    ) {
      tableRows.push(...initialOpportunitySources());
    }

    const rows = tableRows.map((row) =>
      remapUserIds(table, row, userIdMap),
    );
    const documents = rows.map((row) => ({
      id: documentId(table, row),
      data: row,
    }));
    const ids = new Set(documents.map((document) => document.id));
    if (ids.size !== documents.length) {
      throw new Error(
        `Migration stopped: ${table} contains duplicate document keys.`,
      );
    }
    exports.push({ table, documents });
  }

  console.log(
    `${apply ? "Applying" : "Dry run"}: ${supabaseUsers.length} user mappings and ${exports.reduce((sum, item) => sum + item.documents.length, 0)} records across ${exports.length} collections.`,
  );
  for (const item of exports) {
    console.log(`${item.table}: ${item.documents.length}`);
  }
  if (!apply) {
    console.log("No data was written. Rerun with --apply to import.");
    return;
  }

  const existingByTable = new Map();
  for (const { table, documents } of exports) {
    const expectedById = new Map(
      documents.map((document) => [document.id, document.data]),
    );
    const existing = await firestore.collection(table).get();
    for (const document of existing.docs) {
      const expected = expectedById.get(document.id);
      if (!expected || stableJson(document.data()) !== stableJson(expected)) {
        throw new Error(
          `Migration stopped before writing: Firestore collection ${table} contains data that differs from the Supabase source.`,
        );
      }
    }
    existingByTable.set(
      table,
      new Set(existing.docs.map((document) => document.id)),
    );
  }

  for (const { table, documents } of exports) {
    const existingIds = existingByTable.get(table);
    for (let offset = 0; offset < documents.length; offset += 400) {
      const batch = firestore.batch();
      for (const document of documents.slice(offset, offset + 400)) {
        if (!existingIds.has(document.id)) {
          batch.create(
            firestore.collection(table).doc(document.id),
            document.data,
          );
        }
      }
      if (documents.slice(offset, offset + 400).some((document) =>
        !existingIds.has(document.id),
      )) {
        await batch.commit();
      }
    }
  }

  for (const { table, documents } of exports) {
    const snapshot = await firestore.collection(table).get();
    const actualById = new Map(
      snapshot.docs.map((document) => [document.id, document.data()]),
    );
    let verified = 0;
    for (const expected of documents) {
      const actual = actualById.get(expected.id);
      if (!actual || stableJson(actual) !== stableJson(expected.data)) {
        throw new Error(
          `Post-import verification failed for ${table} document ${expected.id}.`,
        );
      }
      verified += 1;
    }
    if (snapshot.size !== documents.length) {
      throw new Error(
        `Post-import count mismatch for ${table}: source ${documents.length}, Firestore ${snapshot.size}.`,
      );
    }
    console.log(`${table}: verified ${verified}/${documents.length}`);
  }
}

main().catch((error) => {
  console.error(
    "Firebase migration stopped:",
    error instanceof Error ? error.message : "unknown error",
  );
  process.exitCode = 1;
});
