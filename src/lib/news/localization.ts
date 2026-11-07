import {
  localizeNewsBatch,
} from "@/lib/ai/adapter";

import {
  normalizeLanguage,
  type SupportedLanguage,
} from "@/lib/news/language";

import type {
  NewsStory,
} from "@/lib/news/provider";

export type LocalizationResult = {
  stories: NewsStory[];
  language: SupportedLanguage;
  localized: boolean;
  fallbackReason?: string;
};

export async function localizeStories(
  stories: NewsStory[],
  requestedLanguage:
    | string
    | null
    | undefined,
): Promise<
  LocalizationResult
> {
  const language =
    normalizeLanguage(
      requestedLanguage,
    );

  if (
    language === "en" ||
    stories.length === 0
  ) {
    return {
      stories,
      language,
      localized: true,
    };
  }

  try {
    const localized =
      await localizeNewsBatch(
        stories.map(
          (
            story,
            index,
          ) => ({
            index,
            title:
              story.title,
            description:
              story.description,
            category:
              story.category,
          }),
        ),
        language,
      );

    const byIndex =
      new Map(
        localized.map(
          (item) => [
            item.index,
            item,
          ],
        ),
      );

    const localizedStories =
      stories.map(
        (
          story,
          index,
        ) => {
          const translated =
            byIndex.get(
              index,
            );

          if (!translated) {
            return story;
          }

          return {
            ...story,

            title:
              translated.title ||
              story.title,

            description:
              translated.summary ||
              story.description,

            category:
              translated.category ||
              story.category,
          };
        },
      );

    return {
      stories:
        localizedStories,
      language,
      localized: true,
    };
  } catch (error) {
    console.error(
      "news_localization_failed",
      {
        language,
        message:
          error instanceof Error
            ? error.message
            : "unknown",
      },
    );

    return {
      stories,
      language,
      localized: false,
      fallbackReason:
        "LOCALIZATION_UNAVAILABLE",
    };
  }
}
