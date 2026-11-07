import { createHash } from "node:crypto";
import { XMLParser } from "fast-xml-parser";

import {
  OpportunityDraftSchema,
  type OpportunityDraft,
} from "@/lib/opportunities/schema";

export type OpportunitySource = {
  id: string;
  name: string;
  category: string;
  base_url: string;
  source_type: "official" | "third_party";
  collection_method: "rss" | "api" | "website" | "manual";
  supported_categories: string[];
  supported_domains: string[];
  rate_limit_seconds: number;
  last_succeeded_at: string | null;
  consecutive_failures: number;
};

export function isSourceRateLimited(
  source: OpportunitySource,
  now: Date = new Date(),
): boolean {
  if (!source.last_succeeded_at) {
    return false;
  }

  const lastSucceededAt =
    new Date(source.last_succeeded_at).getTime();

  return Number.isFinite(lastSucceededAt) &&
    now.getTime() - lastSucceededAt <
      source.rate_limit_seconds * 1000;
}

export type RssEntry = {
  title: string;
  description: string;
  url: string;
  sourceRecordKey: string | null;
  publishedAt: string | null;
};

export type OpportunityCandidate = {
  opportunity: OpportunityDraft;
  sourceUrl: string;
  sourceRecordKey: string | null;
  evidence: {
    title: string;
    description: string;
    publishedAt: string | null;
  };
};

export class SourceCollectionError extends Error {
  constructor(
    message: string,
    readonly code:
      | "SOURCE_CONFIGURATION_INVALID"
      | "SOURCE_TIMEOUT"
      | "SOURCE_HTTP_ERROR"
      | "SOURCE_RESPONSE_TOO_LARGE"
      | "SOURCE_INVALID_RSS",
    readonly retryable = false,
  ) {
    super(message);
    this.name = "SourceCollectionError";
  }
}

const MAX_FEED_BYTES = 1024 * 1024;
const REQUEST_TIMEOUT_MS = 8_000;

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "",
  parseTagValue: false,
  trimValues: true,
});

const opportunityCue =
  /\b(?:accelerator|application(?:s)?|apply(?:\s+now)?|award|challenge|competition|contest|fellowship|funding|grant(?:s)?|hackathon|incubator|internship|scholarship|submission|entrepreneurship\s+program|call\s+for\s+(?:applications|proposals|entries))\b/i;

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null
    ? value as Record<string, unknown>
    : null;
}

function textValue(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }

  const record = asRecord(value);
  if (record && typeof record["#text"] === "string") {
    return record["#text"];
  }

  return "";
}

function cleanText(value: unknown, maximumLength: number): string {
  return textValue(value)
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maximumLength);
}

function parseFeedItems(parsed: unknown): unknown[] {
  const root = asRecord(parsed);
  if (!root) {
    return [];
  }

  const rss = asRecord(root.rss);
  const channel = asRecord(rss?.channel);
  const rssItems = channel?.item;
  if (Array.isArray(rssItems)) {
    return rssItems;
  }
  if (rssItems) {
    return [rssItems];
  }

  const atom = asRecord(root.feed);
  const atomEntries = atom?.entry;
  if (Array.isArray(atomEntries)) {
    return atomEntries;
  }
  if (atomEntries) {
    return [atomEntries];
  }

  return [];
}

function getEntryLink(item: Record<string, unknown>): string {
  const links = Array.isArray(item.link)
    ? item.link
    : [item.link];

  for (const link of links) {
    if (typeof link === "string" && link.trim()) {
      return link.trim();
    }

    const record = asRecord(link);
    if (
      typeof record?.href === "string" &&
      (!record.rel || record.rel === "alternate")
    ) {
      return record.href.trim();
    }
  }

  return "";
}

function getEntryDate(item: Record<string, unknown>): string | null {
  const candidate =
    item.pubDate ??
    item.published ??
    item.updated ??
    item.date;
  const raw = textValue(candidate).trim();

  if (!raw) {
    return null;
  }

  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime())
    ? null
    : parsed.toISOString();
}

export function canonicalizeOpportunityUrl(value: string): string {
  let url: URL;

  try {
    url = new URL(value);
  } catch {
    throw new SourceCollectionError(
      "Source entry contains an invalid URL.",
      "SOURCE_INVALID_RSS",
    );
  }

  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password
  ) {
    throw new SourceCollectionError(
      "Source entry URL must use HTTPS and cannot contain credentials.",
      "SOURCE_INVALID_RSS",
    );
  }

  url.hash = "";

  for (const key of Array.from(url.searchParams.keys())) {
    if (
      /^utm_/i.test(key) ||
      ["fbclid", "gclid", "mc_cid", "mc_eid"].includes(key.toLowerCase())
    ) {
      url.searchParams.delete(key);
    }
  }

  url.searchParams.sort();

  if (url.pathname.length > 1) {
    url.pathname = url.pathname.replace(/\/+$/, "");
  }

  return url.toString();
}

export function fingerprintOpportunityUrl(canonicalUrl: string): string {
  return createHash("sha256")
    .update(canonicalUrl)
    .digest("hex");
}

export function parseOpportunityRss(xml: string): RssEntry[] {
  let parsed: unknown;

  try {
    parsed = parser.parse(xml);
  } catch {
    throw new SourceCollectionError(
      "Source returned malformed RSS or Atom XML.",
      "SOURCE_INVALID_RSS",
    );
  }

  const entries = parseFeedItems(parsed);
  if (entries.length === 0) {
    throw new SourceCollectionError(
      "Source response did not contain RSS or Atom entries.",
      "SOURCE_INVALID_RSS",
    );
  }

  return entries.flatMap((rawEntry) => {
    const entry = asRecord(rawEntry);
    if (!entry) {
      return [];
    }

    const title = cleanText(entry.title, 500);
    const description = cleanText(
      entry.description ??
        entry.summary ??
        entry["content:encoded"] ??
        entry.content,
      2000,
    );
    const url = getEntryLink(entry);

    if (!title || !url) {
      return [];
    }

    return [{
      title,
      description,
      url,
      sourceRecordKey:
        cleanText(entry.guid ?? entry.id, 500) || null,
      publishedAt: getEntryDate(entry),
    }];
  });
}

async function readBoundedBody(
  response: Response,
  controller: AbortController,
): Promise<string> {
  const declaredLength =
    Number(response.headers.get("content-length") ?? "0");

  if (
    Number.isFinite(declaredLength) &&
    declaredLength > MAX_FEED_BYTES
  ) {
    controller.abort();
    throw new SourceCollectionError(
      "Source response exceeded the size limit.",
      "SOURCE_RESPONSE_TOO_LARGE",
    );
  }

  if (!response.body) {
    return "";
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }

    totalBytes += value.byteLength;
    if (totalBytes > MAX_FEED_BYTES) {
      controller.abort();
      throw new SourceCollectionError(
        "Source response exceeded the size limit.",
        "SOURCE_RESPONSE_TOO_LARGE",
      );
    }

    chunks.push(value);
  }

  const combined = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    combined.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return new TextDecoder().decode(combined);
}

export async function fetchRssSource(
  source: OpportunitySource,
  fetcher: typeof fetch = fetch,
): Promise<RssEntry[]> {
  let sourceUrl: URL;

  try {
    sourceUrl = new URL(source.base_url);
  } catch {
    throw new SourceCollectionError(
      "Source registry URL is invalid.",
      "SOURCE_CONFIGURATION_INVALID",
    );
  }

  if (
    source.collection_method !== "rss" ||
    sourceUrl.protocol !== "https:" ||
    sourceUrl.username ||
    sourceUrl.password ||
    sourceUrl.hostname === "localhost" ||
    sourceUrl.hostname.endsWith(".local")
  ) {
    throw new SourceCollectionError(
      "Source registry entry is not a permitted HTTPS RSS URL.",
      "SOURCE_CONFIGURATION_INVALID",
    );
  }

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      REQUEST_TIMEOUT_MS,
    );

    try {
      const response = await fetcher(sourceUrl, {
        method: "GET",
        headers: {
          Accept: "application/rss+xml, application/atom+xml, application/xml, text/xml",
          "User-Agent": "OpportunityRadar/1.0 (+RSS collector)",
        },
        signal: controller.signal,
        redirect: "error",
        cache: "no-store",
      });

      if (!response.ok) {
        throw new SourceCollectionError(
          `Source returned HTTP ${response.status}.`,
          "SOURCE_HTTP_ERROR",
          response.status === 429 || response.status >= 500,
        );
      }

      const body = await readBoundedBody(response, controller);
      return parseOpportunityRss(body);
    } catch (error) {
      const normalizedError =
        error instanceof SourceCollectionError
          ? error
          : controller.signal.aborted
            ? new SourceCollectionError(
                "Source request timed out.",
                "SOURCE_TIMEOUT",
                true,
              )
            : new SourceCollectionError(
                "Source could not be fetched.",
                "SOURCE_HTTP_ERROR",
                true,
              );

      if (!normalizedError.retryable || attempt === 2) {
        throw normalizedError;
      }
    } finally {
      clearTimeout(timeout);
    }

    await new Promise((resolve) =>
      setTimeout(resolve, 250 * (2 ** attempt)),
    );
  }

  throw new SourceCollectionError(
    "Source could not be fetched after retries.",
    "SOURCE_HTTP_ERROR",
    true,
  );
}

export function entryToCandidate(
  source: OpportunitySource,
  entry: RssEntry,
): OpportunityCandidate | null {
  const searchableText = `${entry.title} ${entry.description}`;
  if (!opportunityCue.test(searchableText)) {
    return null;
  }

  const canonicalUrl = canonicalizeOpportunityUrl(entry.url);

  const result = OpportunityDraftSchema.safeParse({
    canonicalUrl,
    canonicalUrlHash:
      fingerprintOpportunityUrl(canonicalUrl),
    title: entry.title,
    shortDescription: entry.description || null,
    category:
      source.supported_categories.length === 1
        ? source.supported_categories[0]
        : null,
    primaryDomain:
      source.supported_domains.length === 1
        ? source.supported_domains[0]
        : null,
    verificationStatus: "pending_verification",
    lifecycleStatus: "unknown",
  });

  if (!result.success) {
    throw new SourceCollectionError(
      "Opportunity lead did not pass normalization.",
      "SOURCE_INVALID_RSS",
    );
  }

  return {
    opportunity: result.data,
    sourceUrl: entry.url,
    sourceRecordKey: entry.sourceRecordKey,
    evidence: {
      title: entry.title,
      description: entry.description,
      publishedAt: entry.publishedAt,
    },
  };
}

function normalizeComparisonText(value: string): string {
  return value
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function titleSimilarity(left: string, right: string): number {
  const leftWords = new Set(normalizeComparisonText(left).split(" "));
  const rightWords = new Set(normalizeComparisonText(right).split(" "));
  if (leftWords.size === 0 || rightWords.size === 0) {
    return 0;
  }

  const intersection = Array.from(leftWords)
    .filter((word) => rightWords.has(word)).length;
  const union = new Set([...leftWords, ...rightWords]).size;
  return intersection / union;
}

function closingDate(
  opportunity: Pick<
    OpportunityDraft,
    "submissionDeadline" | "registrationClosesOn"
  >,
): string | null {
  return opportunity.submissionDeadline?.slice(0, 10) ??
    opportunity.registrationClosesOn ??
    null;
}

export function isLikelySameOpportunity(
  incoming: Pick<
    OpportunityDraft,
    | "title"
    | "organizer"
    | "category"
    | "submissionDeadline"
    | "registrationClosesOn"
  >,
  existing: Pick<
    OpportunityDraft,
    | "title"
    | "organizer"
    | "category"
    | "submissionDeadline"
    | "registrationClosesOn"
  >,
): boolean {
  if (
    !incoming.organizer ||
    !existing.organizer ||
    normalizeComparisonText(incoming.organizer) !==
      normalizeComparisonText(existing.organizer) ||
    titleSimilarity(incoming.title, existing.title) < 0.92
  ) {
    return false;
  }

  if (
    incoming.category &&
    existing.category &&
    normalizeComparisonText(incoming.category) !==
      normalizeComparisonText(existing.category)
  ) {
    return false;
  }

  const incomingDeadline = closingDate(incoming);
  const existingDeadline = closingDate(existing);
  return !incomingDeadline ||
    !existingDeadline ||
    incomingDeadline === existingDeadline;
}
