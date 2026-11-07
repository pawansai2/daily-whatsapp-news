import type { OpportunityDraft } from "@/lib/opportunities/schema";

export type ExtractedOpportunityFacts = Pick<
  OpportunityDraft,
  | "participationFormat"
  | "minimumTeamSize"
  | "maximumTeamSize"
  | "individualEligible"
  | "teamEligible"
  | "entryFeeAmount"
  | "entryFeeCurrency"
>;

function clean(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function format(text: string): string | null {
  if (/\bhybrid\b/i.test(text)) return "hybrid";
  if (/\b(?:online|virtual|remote)\b/i.test(text)) return "online";
  if (/\b(?:in[- ]person|offline|on[- ]site)\b/i.test(text)) return "offline";
  return null;
}

function teamSize(text: string): {
  minimumTeamSize: number | null;
  maximumTeamSize: number | null;
} | null {
  const patterns = [
    /\bteams?\s+(?:of|with)\s+(\d+)\s*(?:-|–|to)\s*(\d+)\b/i,
    /\b(?:team\s+size|team\s+members?)\D{0,12}(\d+)\s*(?:-|–|to)\s*(\d+)\b/i,
    /\b(\d+)\s*(?:-|–|to)\s*(\d+)\s*(?:members?|people|participants)\b/i,
  ];

  for (const pattern of patterns) {
    const match = pattern.exec(text);
    if (!match) continue;
    const minimum = Number(match[1]);
    const maximum = Number(match[2]);
    if (
      Number.isInteger(minimum) &&
      Number.isInteger(maximum) &&
      minimum >= 1 &&
      maximum >= minimum &&
      maximum <= 100
    ) {
      return { minimumTeamSize: minimum, maximumTeamSize: maximum };
    }
  }

  return null;
}

function fee(text: string): {
  entryFeeAmount: number | null;
  entryFeeCurrency: string | null;
} | null {
  if (
    /\b(?:free(?:\s+(?:to\s+enter|entry|registration|participation))?|no\s+(?:entry|registration|participation)\s+fee|without\s+charge)\b/i
      .test(text)
  ) {
    return { entryFeeAmount: 0, entryFeeCurrency: null };
  }

  const currencyPatterns: Array<[RegExp, string]> = [
    [/(?:₹|INR)\s*([\d,]+(?:\.\d+)?)/i, "INR"],
    [/(?:US\$|\$|USD)\s*([\d,]+(?:\.\d+)?)/i, "USD"],
    [/(?:€|EUR)\s*([\d,]+(?:\.\d+)?)/i, "EUR"],
    [/(?:£|GBP)\s*([\d,]+(?:\.\d+)?)/i, "GBP"],
  ];

  for (const [pattern, currency] of currencyPatterns) {
    const match = pattern.exec(text);
    if (!match) continue;
    const amount = Number(match[1].replaceAll(",", ""));
    if (Number.isFinite(amount) && amount >= 0 && amount <= 100_000_000) {
      return { entryFeeAmount: amount, entryFeeCurrency: currency };
    }
  }

  return null;
}

/**
 * Conservative deterministic extraction. Every value is copied from explicit
 * source text; an absent or ambiguous value stays null. These facts are not
 * treated as verified and are not shown as confirmed until a human reviewer
 * records evidence.
 */
export function extractOpportunityFacts(input: {
  title: string;
  description: string;
}): Partial<ExtractedOpportunityFacts> {
  const text = clean(`${input.title} ${input.description}`);
  const result: Partial<ExtractedOpportunityFacts> = {};

  const participationFormat = format(text);
  if (participationFormat) result.participationFormat = participationFormat;

  const size = teamSize(text);
  if (size) {
    result.minimumTeamSize = size.minimumTeamSize;
    result.maximumTeamSize = size.maximumTeamSize;
  }

  if (/\bindividual(?:s)?\s+(?:participation|entries|eligible|allowed)\b/i.test(text) ||
    /\bsolo\s+(?:participation|entries|eligible|allowed)\b/i.test(text)) {
    result.individualEligible = true;
  }
  if (/\bteam(?:s)?\s+(?:participation|entries|eligible|allowed)\b/i.test(text) ||
    /\bteams?\s+of\s+\d+/i.test(text)) {
    result.teamEligible = true;
  }

  const feeValue = fee(text);
  if (feeValue) {
    result.entryFeeAmount = feeValue.entryFeeAmount;
    if (feeValue.entryFeeCurrency) {
      result.entryFeeCurrency = feeValue.entryFeeCurrency;
    }
  }

  return result;
}
