import type {
  NewsStory,
} from "@/lib/news/provider";

type BuildDigestOptions = {
  stories: NewsStory[];
  interests: string[];
  timezone: string;
};

function truncate(
  value: string,
  maxLength: number,
): string {
  if (
    value.length <=
    maxLength
  ) {
    return value;
  }

  return (
    value
      .slice(
        0,
        maxLength - 1,
      )
      .trimEnd() +
    "…"
  );
}

export function buildTelegramDigest({
  stories,
  interests,
  timezone,
}: BuildDigestOptions): string {
  const date =
    new Intl.DateTimeFormat(
      "en-IN",
      {
        timeZone: timezone,
        dateStyle: "medium",
      },
    ).format(
      new Date(),
    );

  const topicLine =
    interests.length > 0
      ? interests.join(", ")
      : "General";

  const sections: string[] = [
    "📰 Daily Intelligence",
    date,
    "",
    `Topics: ${topicLine}`,
    "",
  ];

  let storyNumber = 1;

  for (
    const story
    of stories
  ) {
    const entry = [
      `${storyNumber}. ${truncate(
        story.title,
        180,
      )}`,
      `${story.source} • ${story.category}`,
      story.originalUrl,
      "",
    ].join("\n");

    const projected =
      [
        ...sections,
        entry,
      ].join("\n");

    if (
      projected.length >
      3900
    ) {
      break;
    }

    sections.push(
      entry,
    );

    storyNumber += 1;
  }

  sections.push(
    "Generated from trusted RSS sources.",
  );

  return sections
    .join("\n")
    .trim();
}
