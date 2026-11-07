import {
  getLanguageConfig,
  normalizeLanguage,
} from "@/lib/news/language";

import type {
  NewsStory,
} from "@/lib/news/provider";
import type {
  OpportunityDigestItem,
} from "@/lib/opportunities/schema";

type BuildDigestOptions = {
  stories: NewsStory[];
  opportunities?: OpportunityDigestItem[];
  interests: string[];
  timezone: string;
  language?: string | null;
  localizationSucceeded?: boolean;
  includeSummaries?: boolean;
};

export type BuiltTelegramDigest = {
  message: string;
  includedStoryIds: string[];
  includedOpportunityIds: string[];
};

function truncate(
  value: string,
  maxLength: number,
): string {
  const clean =
    value
      .replace(
        /\s+/g,
        " ",
      )
      .trim();

  if (
    clean.length <=
    maxLength
  ) {
    return clean;
  }

  return (
    clean
      .slice(
        0,
        maxLength - 1,
      )
      .trimEnd() +
    "…"
  );
}

export function buildTelegramDigestDetailed({
  stories,
  opportunities,
  interests,
  timezone,
  language,
  localizationSucceeded = true,
  includeSummaries = false,
}: BuildDigestOptions): BuiltTelegramDigest {
  const normalizedLanguage =
    normalizeLanguage(
      language,
    );

  const copy =
    getLanguageConfig(
      normalizedLanguage,
    );

  const date =
    new Intl.DateTimeFormat(
      copy.locale,
      {
        timeZone:
          timezone,
        dateStyle:
          "medium",
      },
    ).format(
      new Date(),
    );

  const topicLine =
    interests.length > 0
      ? interests.join(", ")
      : "General";

  const sections:
    string[] = [
      copy.digestTitle,
      date,
      "",
      `${copy.topicsLabel}: ${topicLine}`,
      "",
    ];

  if (
    !localizationSucceeded &&
    normalizedLanguage !== "en"
  ) {
    sections.push(
      copy.fallbackNotice,
      "",
    );
  }

  const includedStoryIds:
    string[] = [];
  const includedOpportunityIds: string[] = [];

  if (opportunities && opportunities.length > 0) {
    sections.push("Opportunity matches with official-source evidence:");
    for (const opportunity of opportunities) {
      const deadline = opportunity.deadline
        ? `Deadline: ${truncate(opportunity.deadline, 40)}`
        : "Deadline: unknown";
      const context = [
        opportunity.organizer,
        opportunity.category,
        opportunity.domain,
        opportunity.verificationStatus?.replaceAll("_", " "),
      ].filter(Boolean).join(" · ");
      const access = [
        opportunity.format ? `Format: ${opportunity.format}` : null,
        opportunity.fee ? `Fee: ${opportunity.fee}` : "Fee: unknown",
        opportunity.participation
          ? `Participation: ${opportunity.participation}`
          : null,
      ].filter(Boolean).join(" · ");
      const benefits = opportunity.benefits?.length
        ? `  Benefits: ${truncate(opportunity.benefits.join(", "), 180)}`
        : null;
      const reasons = opportunity.reasons?.length
        ? `  Why: ${truncate(opportunity.reasons.join(" "), 240)}`
        : null;
      const entry = [
        `• ${truncate(opportunity.title, 140)} — ${opportunity.score}/100`,
        context ? `  ${truncate(context, 220)}` : null,
        `  Eligibility: ${opportunity.eligibilityStatus.replaceAll("_", " ")} · ${deadline}`,
        access ? `  ${access}` : null,
        benefits,
        reasons,
        `  Source: ${truncate(opportunity.sourceUrl, 500)}`,
        "",
      ].filter((line): line is string => line !== null).join("\n");
      const projected = [
        ...sections,
        entry,
        copy.footer,
      ].join("\n");
      if (projected.length > 3900) continue;
      sections.push(entry);
      includedOpportunityIds.push(opportunity.id);
    }
    if (includedOpportunityIds.length === 0) {
      sections.pop();
    }
  }

  let storyNumber = 1;

  for (
    const story
    of stories
  ) {
    const entryLines = [
      `${storyNumber}. ${truncate(
        story.title,
        180,
      )}`,

      `${copy.sourceLabel}: ${story.source} • ${truncate(
        story.category,
        80,
      )}`,
    ];

    if (
      includeSummaries &&
      story.description.trim()
    ) {
      entryLines.push(
        truncate(
          story.description,
          220,
        ),
      );
    }

    entryLines.push(
      story.originalUrl,
      "",
    );

    const entry =
      entryLines.join(
        "\n",
      );

    const projected =
      [
        ...sections,
        entry,
        copy.footer,
      ].join(
        "\n",
      );

    /*
     * Telegram messages are limited to
     * 4096 characters. Stay below that
     * limit to leave safety margin.
     */
    if (
      projected.length >
      3900
    ) {
      break;
    }

    sections.push(
      entry,
    );

    includedStoryIds.push(
      story.id,
    );

    storyNumber += 1;
  }

  sections.push(
    copy.footer,
  );

  return {
    message:
      sections
        .join("\n")
        .trim(),

    includedStoryIds,
    includedOpportunityIds,
  };
}

/*
 * Backward-compatible wrapper used by
 * the legacy daily-news route.
 */
export function buildTelegramDigest(
  options: BuildDigestOptions,
): string {
  return buildTelegramDigestDetailed(
    options,
  ).message;
}
