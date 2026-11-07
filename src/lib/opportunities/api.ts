import type { OpportunityCandidate, OpportunitySource } from "@/lib/opportunities/rss";
import {
  canonicalizeOpportunityUrl,
  fingerprintOpportunityUrl,
  SourceCollectionError,
} from "@/lib/opportunities/rss";
import { OpportunityDraftSchema } from "@/lib/opportunities/schema";

const MAX_JSON_BYTES = 2 * 1024 * 1024;
const TIMEOUT_MS = 12_000;

type CodeforcesContest = {
  id: number;
  name: string;
  type: string;
  phase: string;
  durationSeconds: number;
  startTimeSeconds?: number;
};

function isoDate(seconds: number): string {
  return new Date(seconds * 1000).toISOString().slice(0, 10);
}

async function readBoundedJson(response: Response): Promise<unknown> {
  const declared = Number(response.headers.get("content-length") ?? "0");
  if (Number.isFinite(declared) && declared > MAX_JSON_BYTES) {
    throw new SourceCollectionError(
      "API response exceeded the size limit.",
      "SOURCE_RESPONSE_TOO_LARGE",
    );
  }

  const text = await response.text();
  if (new TextEncoder().encode(text).byteLength > MAX_JSON_BYTES) {
    throw new SourceCollectionError(
      "API response exceeded the size limit.",
      "SOURCE_RESPONSE_TOO_LARGE",
    );
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new SourceCollectionError(
      "API returned malformed JSON.",
      "SOURCE_INVALID_RSS",
    );
  }
}

type DevpostHackathon = {
  id: number;
  title: string;
  url: string;
  open_state?: string;
  submission_period_dates?: string;
  displayed_location?: { location?: string };
  organization_name?: string;
  themes?: Array<{ name?: string }>;
  prize_amount?: string;
};

function parseDevpostDeadline(value: string | undefined): string | null {
  if (!value) return null;
  const match = value.match(
    /([A-Za-z]{3})[a-z]*\s+(\d{1,2})\s*-\s*([A-Za-z]{3})[a-z]*\s+(\d{1,2}),\s*(\d{4})/,
  );
  if (!match) return null;
  const months: Record<string, number> = {
    Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5,
    Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11,
  };
  const month = months[match[3]];
  if (month === undefined) return null;
  const date = new Date(Date.UTC(Number(match[5]), month, Number(match[4])));
  return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10);
}

function devpostCandidates(
  source: OpportunitySource,
  payload: unknown,
): OpportunityCandidate[] {
  if (
    !payload ||
    typeof payload !== "object" ||
    !Array.isArray((payload as { hackathons?: unknown }).hackathons)
  ) {
    throw new SourceCollectionError(
      "Devpost API returned an invalid payload.",
      "SOURCE_INVALID_RSS",
    );
  }

  const hackathons = (payload as { hackathons: unknown[] }).hackathons.filter(
    (value): value is DevpostHackathon => {
      if (!value || typeof value !== "object") return false;
      const hackathon = value as Record<string, unknown>;
      return (
        typeof hackathon.id === "number" &&
        typeof hackathon.title === "string" &&
        typeof hackathon.url === "string"
      );
    },
  );

  const candidates: OpportunityCandidate[] = [];
  for (const hackathon of hackathons.slice(0, 50)) {
    if (hackathon.open_state && hackathon.open_state !== "open") continue;

    let contestUrl: string;
    try {
      contestUrl = canonicalizeOpportunityUrl(hackathon.url);
    } catch {
      continue;
    }

    const location = hackathon.displayed_location?.location ?? null;
    const themes = (hackathon.themes ?? [])
      .map((theme) => theme.name)
      .filter((name): name is string => typeof name === "string");
    const description = [
      "Devpost hackathon.",
      hackathon.submission_period_dates
        ? `Submission period: ${hackathon.submission_period_dates}.`
        : null,
      location ? `Location: ${location}.` : null,
      themes.length > 0 ? `Themes: ${themes.join(", ")}.` : null,
    ]
      .filter(Boolean)
      .join(" ");
    const deadline = parseDevpostDeadline(
      hackathon.submission_period_dates,
    );

    const parsed = OpportunityDraftSchema.safeParse({
      canonicalUrl: contestUrl,
      canonicalUrlHash: fingerprintOpportunityUrl(contestUrl),
      title: hackathon.title,
      organizer: hackathon.organization_name ?? null,
      shortDescription: description || null,
      category: "hackathon",
      subcategory: "hackathon",
      primaryDomain: "software",
      additionalDomains: [],
      participationFormat:
        location?.toLowerCase() === "online" ? "online" : null,
      location,
      registrationClosesOn: deadline,
      verificationStatus: "pending_verification",
      lifecycleStatus: "upcoming",
      verifiedFields: [],
    });

    if (!parsed.success) {
      throw new SourceCollectionError(
        "Devpost hackathon did not pass normalization.",
        "SOURCE_INVALID_RSS",
      );
    }

    candidates.push({
      opportunity: parsed.data,
      sourceUrl: contestUrl,
      sourceRecordKey: `devpost:${hackathon.id}`,
      evidence: {
        title: hackathon.title,
        description,
        publishedAt: null,
      },
    });
  }

  return candidates;
}

function codeforcesCandidates(
  source: OpportunitySource,
  payload: unknown,
): OpportunityCandidate[] {
  if (
    !payload ||
    typeof payload !== "object" ||
    (payload as { status?: unknown }).status !== "OK" ||
    !Array.isArray((payload as { result?: unknown }).result)
  ) {
    throw new SourceCollectionError(
      "Codeforces API returned an invalid payload.",
      "SOURCE_INVALID_RSS",
    );
  }

  const contests = (payload as { result: unknown[] }).result.filter(
    (value): value is CodeforcesContest => {
      if (!value || typeof value !== "object") return false;
      const contest = value as Record<string, unknown>;
      return (
        typeof contest.id === "number" &&
        typeof contest.name === "string" &&
        typeof contest.phase === "string" &&
        typeof contest.durationSeconds === "number" &&
        typeof contest.startTimeSeconds === "number"
      );
    },
  );

  const candidates: OpportunityCandidate[] = [];
  for (const contest of contests) {
    if (contest.phase !== "BEFORE") continue;

    const contestUrl = canonicalizeOpportunityUrl(
      `https://codeforces.com/contests/${contest.id}`,
    );
    const startsOn = isoDate(contest.startTimeSeconds!);
    const endsOn = isoDate(
      contest.startTimeSeconds! + contest.durationSeconds,
    );
    const description = [
      `Codeforces ${contest.type} contest.`,
      `Starts ${new Date(contest.startTimeSeconds! * 1000).toISOString()}.`,
      `Duration ${Math.round(contest.durationSeconds / 60)} minutes.`,
    ].join(" ");

    const parsed = OpportunityDraftSchema.safeParse({
      canonicalUrl: contestUrl,
      canonicalUrlHash: fingerprintOpportunityUrl(contestUrl),
      title: `Codeforces: ${contest.name}`,
      shortDescription: description,
      category: "technical_competition",
      subcategory: "competitive_programming",
      primaryDomain: "software",
      additionalDomains: [],
      participationFormat: "online",
      eventStartsOn: startsOn,
      eventEndsOn: endsOn,
      verificationStatus: "pending_verification",
      lifecycleStatus: "upcoming",
      verifiedFields: [],
    });

    if (!parsed.success) {
      throw new SourceCollectionError(
        "Codeforces contest did not pass normalization.",
        "SOURCE_INVALID_RSS",
      );
    }

    candidates.push({
      opportunity: parsed.data,
      sourceUrl: contestUrl,
      sourceRecordKey: `codeforces:${contest.id}`,
      evidence: {
        title: `Codeforces: ${contest.name}`,
        description,
        publishedAt: null,
      },
    });
  }

  return candidates;
}

export async function fetchApiCandidates(
  source: OpportunitySource,
  fetcher: typeof fetch = fetch,
): Promise<OpportunityCandidate[]> {
  const sourceUrl = new URL(source.base_url);
  const isCodeforces =
    sourceUrl.hostname === "codeforces.com" &&
    sourceUrl.pathname.startsWith("/api/contest.list");
  const isDevpost =
    sourceUrl.hostname === "devpost.com" &&
    sourceUrl.pathname === "/api/hackathons";

  if (
    source.collection_method !== "api" ||
    sourceUrl.protocol !== "https:" ||
    (!isCodeforces && !isDevpost)
  ) {
    throw new SourceCollectionError(
      "API source is not supported by an installed adapter.",
      "SOURCE_CONFIGURATION_INVALID",
    );
  }

  let lastError: SourceCollectionError | null = null;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const response = await fetcher(sourceUrl, {
        method: "GET",
        headers: {
          Accept: "application/json",
          "User-Agent": "OpportunityRadar/1.0 (+API collector)",
        },
        signal: controller.signal,
        redirect: "error",
        cache: "no-store",
      });
      if (!response.ok) {
        throw new SourceCollectionError(
          `API returned HTTP ${response.status}.`,
          "SOURCE_HTTP_ERROR",
          response.status === 429 || response.status >= 500,
        );
      }
      const payload = await readBoundedJson(response);
      return isCodeforces
        ? codeforcesCandidates(source, payload)
        : devpostCandidates(source, payload);
    } catch (error) {
      lastError = error instanceof SourceCollectionError
        ? error
        : new SourceCollectionError(
            "API could not be fetched.",
            "SOURCE_HTTP_ERROR",
            true,
          );
      if (!lastError.retryable) throw lastError;
    } finally {
      clearTimeout(timeout);
    }
  }

  throw lastError ?? new SourceCollectionError(
    "API could not be fetched.",
    "SOURCE_HTTP_ERROR",
  );
}
