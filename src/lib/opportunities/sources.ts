import type { FirebaseDataClient } from "@/lib/firebase/store";

/**
 * Official feeds that have been reviewed for the source registry. Category and
 * domain values use the canonical taxonomy IDs. Only add a feed here after
 * confirming its URL returns a valid RSS/Atom document and its terms allow
 * collection; never add a guessed or placeholder URL.
 *
 * The previous ESA feed (`/rss/news.en.rss`) currently returns HTTP 404 and is
 * intentionally not seeded. Category coverage for hackathons, ideathons,
 * competitions, events, internships, jobs and startup programmes still needs
 * approved official feeds; see OPPORTUNITY_RADAR_SCOPE_ALIGNMENT.md.
 */
export const DEFAULT_OPPORTUNITY_SOURCES = [
  {
    name: "NASA Learning Resources",
    category: "research",
    base_url: "https://www.nasa.gov/learning-resources/feed/",
    source_type: "official",
    collection_method: "rss",
    supported_categories: ["research"],
    supported_domains: ["interdisciplinary"],
    rate_limit_seconds: 21600,
    is_enabled: true,
    notes:
      "Official NASA feed. Only items with explicit opportunity cues are retained; facts remain pending verification.",
  },
  {
    name: "Innovate UK Activity",
    category: "research",
    base_url: "https://www.gov.uk/government/organisations/innovate-uk.atom",
    source_type: "official",
    collection_method: "rss",
    supported_categories: ["research"],
    supported_domains: ["interdisciplinary"],
    rate_limit_seconds: 21600,
    is_enabled: true,
    notes:
      "Official GOV.UK Atom feed. Geographic eligibility is never inferred from source identity.",
  },
  {
    name: "We Work Remotely — Programming Jobs",
    category: "employment",
    base_url:
      "https://weworkremotely.com/categories/remote-programming-jobs.rss",
    source_type: "third_party",
    collection_method: "rss",
    supported_categories: ["employment"],
    supported_domains: ["software", "cloud_devops", "ai_ml"],
    rate_limit_seconds: 21600,
    is_enabled: true,
    notes:
      "Third-party job board RSS. Every lead remains third-party reported until an official employer page is reviewed.",
  },
  {
    name: "Remotive Remote Jobs",
    category: "employment",
    base_url: "https://remotive.com/remote-jobs/feed",
    source_type: "third_party",
    collection_method: "rss",
    supported_categories: ["employment"],
    supported_domains: ["software", "ai_ml", "cloud_devops"],
    rate_limit_seconds: 21600,
    is_enabled: true,
    notes:
      "Third-party job board RSS. It is not treated as official verification of the employer or role.",
  },
  {
    name: "Codeforces Contests",
    category: "technical_competition",
    base_url: "https://codeforces.com/api/contest.list?gym=false",
    source_type: "official",
    collection_method: "api",
    supported_categories: ["technical_competition"],
    supported_domains: ["software"],
    rate_limit_seconds: 21600,
    is_enabled: true,
    notes:
      "Official Codeforces public contest API. Only contests in the BEFORE phase are imported; results and past contests are ignored.",
  },
  {
    name: "Devpost Open Hackathons",
    category: "hackathon",
    base_url: "https://devpost.com/api/hackathons?status[]=open",
    source_type: "third_party",
    collection_method: "api",
    supported_categories: ["hackathon"],
    supported_domains: ["software", "ai_ml", "cloud_devops"],
    rate_limit_seconds: 21600,
    is_enabled: true,
    notes:
      "Public Devpost listing API. Devpost is a third-party host, so records remain pending verification and are not treated as official organizer confirmation.",
  },
] as const;

/**
 * Seeds the reviewed source registry only when the collection is empty. This
 * keeps discovery from silently running with zero sources while never
 * overwriting an operator-managed registry.
 */
export async function ensureDefaultOpportunitySources(
  admin: FirebaseDataClient,
): Promise<number> {
  const { data: existing, error } = await admin
    .from("opportunity_sources")
    .select("id")
    .limit(1);

  if (error) {
    throw new Error(`Source registry lookup failed: ${error.code}`);
  }

  if ((existing ?? []).length > 0) {
    return 0;
  }

  let inserted = 0;
  for (const source of DEFAULT_OPPORTUNITY_SOURCES) {
    const { error: insertError } = await admin
      .from("opportunity_sources")
      .insert({ ...source, supported_categories: [...source.supported_categories], supported_domains: [...source.supported_domains] });

    if (insertError?.code === "23505") {
      continue;
    }

    if (insertError) {
      throw new Error(`Source registry seed failed: ${insertError.code}`);
    }

    inserted += 1;
  }

  return inserted;
}
