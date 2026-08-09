import crypto from "node:crypto";
import { XMLParser } from "fast-xml-parser";

export interface NewsLocation {
  country?: string;
  state?: string;
  district?: string;
  city?: string;
}

export interface NewsStory {
  id: string;
  title: string;
  description: string;
  source: string;
  originalUrl: string;
  category: string;
  region: string;
  publishedAt: string;
  score: number;
}

type FeedDefinition = {
  name: string;
  url: string;
  category: string;
  region: string;
};

const TRUSTED_RSS_FEEDS: FeedDefinition[] = [
  {
    name: "TechCrunch",
    url: "https://techcrunch.com/feed/",
    category: "Technology",
    region: "global",
  },
  {
    name: "The Guardian Technology",
    url: "https://www.theguardian.com/technology/rss",
    category: "Technology",
    region: "global",
  },
  {
    name: "The Guardian Science",
    url: "https://www.theguardian.com/science/rss",
    category: "Science",
    region: "global",
  },
  {
    name: "NASA JPL",
    url: "https://www.jpl.nasa.gov/feeds/news/",
    category: "Space",
    region: "global",
  },
];

function stripHtml(value: unknown): string {
  if (typeof value !== "string") {
    return "";
  }

  return value
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeText(value: string): string {
  return value
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function containsPhrase(
  text: string,
  phrase: string,
): boolean {
  if (!phrase) {
    return false;
  }

  return ` ${text} `.includes(
    ` ${phrase} `,
  );
}

export function createStoryId(
  url: string,
): string {
  return crypto
    .createHash("sha256")
    .update(url)
    .digest("hex");
}

export function createTitleHash(
  title: string,
): string {
  return crypto
    .createHash("sha256")
    .update(normalizeText(title))
    .digest("hex");
}

function getLink(
  item: Record<string, unknown>,
): string {
  const link = item.link;

  if (typeof link === "string") {
    return link.trim();
  }

  if (
    typeof link === "object" &&
    link !== null &&
    "href" in link &&
    typeof (
      link as { href?: unknown }
    ).href === "string"
  ) {
    return (
      link as { href: string }
    ).href.trim();
  }

  return "";
}

function getPublishedAt(
  item: Record<string, unknown>,
): string {
  const candidates = [
    item.pubDate,
    item.published,
    item.updated,
    item.date,
  ];

  for (const candidate of candidates) {
    if (typeof candidate !== "string") {
      continue;
    }

    const parsed =
      new Date(candidate);

    if (
      !Number.isNaN(
        parsed.getTime(),
      )
    ) {
      return parsed.toISOString();
    }
  }

  return new Date().toISOString();
}

function getFeedItems(
  parsed: unknown,
): unknown[] {
  if (
    typeof parsed !== "object" ||
    parsed === null
  ) {
    return [];
  }

  const root =
    parsed as Record<
      string,
      unknown
    >;

  const rss = root.rss;

  if (
    typeof rss === "object" &&
    rss !== null
  ) {
    const channel = (
      rss as Record<
        string,
        unknown
      >
    ).channel;

    if (
      typeof channel === "object" &&
      channel !== null
    ) {
      const item = (
        channel as Record<
          string,
          unknown
        >
      ).item;

      if (Array.isArray(item)) {
        return item;
      }

      if (item) {
        return [item];
      }
    }
  }

  const feed = root.feed;

  if (
    typeof feed === "object" &&
    feed !== null
  ) {
    const entry = (
      feed as Record<
        string,
        unknown
      >
    ).entry;

    if (Array.isArray(entry)) {
      return entry;
    }

    if (entry) {
      return [entry];
    }
  }

  return [];
}

function calculateRelevance(
  title: string,
  description: string,
  interests: string[],
): number {
  const titleText =
    normalizeText(title);

  const descriptionText =
    normalizeText(description);

  let score = 0;

  for (
    const rawInterest
    of interests
  ) {
    const interest =
      normalizeText(rawInterest);

    if (!interest) {
      continue;
    }

    if (
      containsPhrase(
        titleText,
        interest,
      )
    ) {
      score += 5;
    }

    if (
      containsPhrase(
        descriptionText,
        interest,
      )
    ) {
      score += 2;
    }
  }

  return score;
}

function categoryMatchesInterest(
  category: string,
  interests: string[],
): boolean {
  const normalizedCategory =
    normalizeText(category);

  return interests.some(
    (interest) =>
      normalizeText(interest) ===
      normalizedCategory,
  );
}

function inferCategory(
  title: string,
  description: string,
  interests: string[],
  fallback: string,
): string {
  const searchable =
    normalizeText(
      `${title} ${description}`,
    );

  for (
    const interest
    of interests
  ) {
    const normalized =
      normalizeText(interest);

    if (
      normalized &&
      containsPhrase(
        searchable,
        normalized,
      )
    ) {
      return interest;
    }
  }

  return fallback;
}

export async function fetchNewsFromRSS(
  interests: string[] = [],
): Promise<NewsStory[]> {
  const stories: NewsStory[] = [];

  const parser =
    new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: "",
    });

  for (
    const feed
    of TRUSTED_RSS_FEEDS
  ) {
    const controller =
      new AbortController();

    const timeoutId =
      setTimeout(
        () => controller.abort(),
        8000,
      );

    try {
      const response =
        await fetch(
          feed.url,
          {
            method: "GET",
            headers: {
              Accept:
                "application/rss+xml, application/atom+xml, application/xml, text/xml",
              "User-Agent":
                "DailyIntelligenceAssistant/1.0",
            },
            signal:
              controller.signal,
            cache: "no-store",
          },
        );

      if (!response.ok) {
        console.error(
          "rss_feed_http_failure",
          {
            feed: feed.name,
            status:
              response.status,
          },
        );

        continue;
      }

      const text =
        await response.text();

      if (
        Buffer.byteLength(
          text,
          "utf8",
        ) >
        1024 * 1024
      ) {
        console.error(
          "rss_feed_too_large",
          {
            feed: feed.name,
          },
        );

        continue;
      }

      const parsed =
        parser.parse(text);

      const items =
        getFeedItems(
          parsed,
        ).slice(0, 30);

      for (
        const rawItem
        of items
      ) {
        if (
          typeof rawItem !==
            "object" ||
          rawItem === null
        ) {
          continue;
        }

        const item =
          rawItem as Record<
            string,
            unknown
          >;

        const title =
          stripHtml(
            item.title,
          );

        const description =
          stripHtml(
            item.description ??
              item.summary ??
              item.content,
          );

        const originalUrl =
          getLink(item);

        if (
          !title ||
          !originalUrl.startsWith(
            "https://",
          )
        ) {
          continue;
        }

        let relevance =
          calculateRelevance(
            title,
            description,
            interests,
          );

        if (
          categoryMatchesInterest(
            feed.category,
            interests,
          )
        ) {
          relevance += 1;
        }

        if (
          interests.length > 0 &&
          relevance === 0
        ) {
          continue;
        }

        stories.push({
          id: createStoryId(
            originalUrl,
          ),
          title,
          description,
          source: feed.name,
          originalUrl,
          category:
            inferCategory(
              title,
              description,
              interests,
              feed.category,
            ),
          region: feed.region,
          publishedAt:
            getPublishedAt(item),
          score: relevance,
        });
      }
    } catch (error) {
      console.error(
        "rss_feed_fetch_failed",
        {
          feed: feed.name,
          message:
            error instanceof Error
              ? error.message
              : "unknown",
        },
      );
    } finally {
      clearTimeout(
        timeoutId,
      );
    }
  }

  return stories;
}

export async function fetchNews(
  interests: string[],
  language: string,
  location: NewsLocation,
): Promise<NewsStory[]> {
  void language;
  void location;

  const mode =
    process.env
      .NEWS_PROVIDER_MODE
      ?.trim()
      .toLowerCase() ??
    "rss";

  if (mode === "mock") {
    return [
      {
        id: createStoryId(
          "https://example.com/mock-1",
        ),
        title:
          "Mock AI Startup raises $10M",
        description:
          "A new startup in the AI space...",
        source: "MockTech",
        originalUrl:
          "https://example.com/mock-1",
        category: "AI",
        region: "interest",
        publishedAt:
          new Date().toISOString(),
        score: 100,
      },
    ];
  }

  if (mode !== "rss") {
    throw new Error(
      `Unsupported NEWS_PROVIDER_MODE: ${mode}`,
    );
  }

  return fetchNewsFromRSS(
    interests,
  );
}

export function filterAndRankStories(
  stories: NewsStory[],
  sentHashes: string[],
): NewsStory[] {
  const uniqueStories =
    new Map<
      string,
      NewsStory
    >();

  const sent =
    new Set(sentHashes);

  const now = Date.now();

  const maxAge =
    48 *
    60 *
    60 *
    1000;

  for (
    const story
    of stories
  ) {
    const publishedTime =
      new Date(
        story.publishedAt,
      ).getTime();

    if (
      !Number.isFinite(
        publishedTime,
      )
    ) {
      continue;
    }

    const age =
      now - publishedTime;

    if (
      age <
        -60 *
          60 *
          1000 ||
      age > maxAge
    ) {
      continue;
    }

    if (
      sent.has(
        story.id,
      )
    ) {
      continue;
    }

    const existing =
      uniqueStories.get(
        story.originalUrl,
      );

    if (
      !existing ||
      story.score >
        existing.score
    ) {
      uniqueStories.set(
        story.originalUrl,
        story,
      );
    }
  }

  const ranked =
    Array.from(
      uniqueStories.values(),
    );

  for (
    const story
    of ranked
  ) {
    const publishedTime =
      new Date(
        story.publishedAt,
      ).getTime();

    story.score =
      story.score *
        10_000_000_000_000 +
      publishedTime;
  }

  return ranked.sort(
    (a, b) =>
      b.score -
      a.score,
  );
}
