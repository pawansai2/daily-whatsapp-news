import type {
  SupportedLanguage,
} from "@/lib/news/language";

import {
  getLanguageConfig,
} from "@/lib/news/language";

export type AiLocalizationInput = {
  index: number;
  title: string;
  description: string;
  category: string;
};

export type AiLocalizationOutput = {
  index: number;
  title: string;
  summary: string;
  category: string;
};

type ResponsesContent = {
  type?: string;
  text?: string;
};

type ResponsesOutput = {
  type?: string;
  content?: ResponsesContent[];
};

type ResponsesPayload = {
  output_text?: string;
  output?: ResponsesOutput[];
  error?: {
    message?: string;
  };
};

function getOutputText(
  payload: ResponsesPayload,
): string {
  if (
    typeof payload.output_text ===
      "string" &&
    payload.output_text.trim()
  ) {
    return payload.output_text.trim();
  }

  for (
    const output
    of payload.output ?? []
  ) {
    for (
      const content
      of output.content ?? []
    ) {
      if (
        content.type ===
          "output_text" &&
        typeof content.text ===
          "string" &&
        content.text.trim()
      ) {
        return content.text.trim();
      }
    }
  }

  return "";
}

function getOpenAiConfiguration() {
  if (
    process.env
      .AI_SUMMARIZATION_ENABLED !==
    "true"
  ) {
    throw new Error(
      "AI localization is disabled.",
    );
  }

  const provider =
    process.env
      .AI_PROVIDER
      ?.trim()
      .toLowerCase();

  if (provider !== "openai") {
    throw new Error(
      "OpenAI localization provider is not configured.",
    );
  }

  const apiKey =
    process.env
      .AI_API_KEY
      ?.trim();

  if (!apiKey) {
    throw new Error(
      "OpenAI API key is not configured.",
    );
  }

  const model =
    process.env
      .AI_MODEL
      ?.trim() ||
    "gpt-5-mini";

  return {
    apiKey,
    model,
  };
}

export async function localizeNewsBatch(
  items: AiLocalizationInput[],
  language: SupportedLanguage,
): Promise<
  AiLocalizationOutput[]
> {
  if (items.length === 0) {
    return [];
  }

  if (language === "en") {
    return items.map(
      (item) => ({
        index:
          item.index,
        title:
          item.title,
        summary:
          item.description,
        category:
          item.category,
      }),
    );
  }

  const {
    apiKey,
    model,
  } = getOpenAiConfiguration();

  const languageConfig =
    getLanguageConfig(
      language,
    );

  const controller =
    new AbortController();

  const timeout =
    setTimeout(
      () =>
        controller.abort(),
      30_000,
    );

  const inputStories =
    items.map(
      (item) => ({
        index:
          item.index,
        title:
          item.title.slice(
            0,
            500,
          ),
        description:
          item.description.slice(
            0,
            900,
          ),
        category:
          item.category.slice(
            0,
            100,
          ),
      }),
    );

  try {
    const response =
      await fetch(
        "https://api.openai.com/v1/responses",
        {
          method: "POST",

          headers: {
            Authorization:
              `Bearer ${apiKey}`,
            "Content-Type":
              "application/json",
          },

          signal:
            controller.signal,

          body:
            JSON.stringify({
              model,

              store: false,

              max_output_tokens:
                6000,

              input: [
                {
                  role: "system",

                  content: [
                    {
                      type:
                        "input_text",

                      text:
                        [
                          "You localize news digests for Indian readers.",
                          `Target language: ${languageConfig.name}.`,
                          "",
                          "For every supplied story:",
                          "- Translate/localize the headline accurately.",
                          "- Produce a concise summary using only facts present in the supplied title and description.",
                          "- Localize the category.",
                          "- Preserve names, companies, products, numbers, technical acronyms, and proper nouns when appropriate.",
                          "- Do not invent facts.",
                          "- Do not add opinions.",
                          "- Do not add markdown.",
                          "- Do not add URLs.",
                          "- Keep each summary concise enough for a Telegram digest.",
                          `- Write naturally in ${languageConfig.name}.`,
                          "- Keep each input index unchanged.",
                        ].join("\n"),
                    },
                  ],
                },

                {
                  role: "user",

                  content: [
                    {
                      type:
                        "input_text",

                      text:
                        JSON.stringify({
                          stories:
                            inputStories,
                        }),
                    },
                  ],
                },
              ],

              text: {
                format: {
                  type:
                    "json_schema",

                  name:
                    "localized_news_stories",

                  strict:
                    true,

                  schema: {
                    type:
                      "object",

                    properties: {
                      stories: {
                        type:
                          "array",

                        items: {
                          type:
                            "object",

                          properties: {
                            index: {
                              type:
                                "integer",
                            },

                            title: {
                              type:
                                "string",
                            },

                            summary: {
                              type:
                                "string",
                            },

                            category: {
                              type:
                                "string",
                            },
                          },

                          required: [
                            "index",
                            "title",
                            "summary",
                            "category",
                          ],

                          additionalProperties:
                            false,
                        },
                      },
                    },

                    required: [
                      "stories",
                    ],

                    additionalProperties:
                      false,
                  },
                },
              },
            }),
        },
      );

    const payload =
      await response.json() as
        ResponsesPayload;

    if (!response.ok) {
      throw new Error(
        `OpenAI localization request failed with HTTP ${response.status}.`,
      );
    }

    const outputText =
      getOutputText(
        payload,
      );

    if (!outputText) {
      throw new Error(
        "OpenAI returned no localization output.",
      );
    }

    const parsed =
      JSON.parse(
        outputText,
      ) as {
        stories?: unknown;
      };

    if (
      !Array.isArray(
        parsed.stories,
      )
    ) {
      throw new Error(
        "OpenAI localization response has an invalid structure.",
      );
    }

    const results:
      AiLocalizationOutput[] =
      [];

    for (
      const value
      of parsed.stories
    ) {
      if (
        typeof value !==
          "object" ||
        value === null
      ) {
        continue;
      }

      const item =
        value as Record<
          string,
          unknown
        >;

      if (
        typeof item.index !==
          "number" ||
        typeof item.title !==
          "string" ||
        typeof item.summary !==
          "string" ||
        typeof item.category !==
          "string"
      ) {
        continue;
      }

      results.push({
        index:
          item.index,
        title:
          item.title.trim(),
        summary:
          item.summary.trim(),
        category:
          item.category.trim(),
      });
    }

    if (
      results.length !==
      items.length
    ) {
      throw new Error(
        "OpenAI did not return every requested localized story.",
      );
    }

    return results;
  } finally {
    clearTimeout(
      timeout,
    );
  }
}

/*
 * Kept for compatibility with any older
 * callers. News localization now uses
 * localizeNewsBatch().
 */
export async function summarizeText(
  text: string,
): Promise<string> {
  const clean =
    text.trim();

  if (
    clean.length <= 150
  ) {
    return clean;
  }

  return (
    clean.slice(
      0,
      149,
    ).trimEnd() +
    "…"
  );
}
