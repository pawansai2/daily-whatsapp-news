export const OPPORTUNITY_CATEGORY_IDS = [
  "hackathon",
  "ideathon",
  "innovation_challenge",
  "technical_competition",
  "technical_event",
  "internship",
  "employment",
  "research",
  "startup",
] as const;

export type OpportunityCategoryId = (typeof OPPORTUNITY_CATEGORY_IDS)[number];

export const TECHNICAL_DOMAIN_IDS = [
  "ai_ml",
  "software",
  "cybersecurity",
  "electronics_vlsi",
  "embedded_iot_robotics",
  "cloud_devops",
  "blockchain",
  "hardware_communications",
  "interdisciplinary",
] as const;

export type TechnicalDomainId = (typeof TECHNICAL_DOMAIN_IDS)[number];

type SubcategoryDefinition = {
  id: string;
  label: string;
  patterns: readonly RegExp[];
};

type CategoryDefinition = {
  id: OpportunityCategoryId;
  label: string;
  aliases: readonly string[];
  patterns: readonly RegExp[];
  subcategories: readonly SubcategoryDefinition[];
};

export const OPPORTUNITY_CATEGORIES: readonly CategoryDefinition[] = [
  {
    id: "hackathon",
    label: "Hackathons",
    aliases: ["hackathon", "hackathons", "hack", "hackathons and challenges"],
    patterns: [
      /\bhackathons?\b/,
      /\bhack\s*(?:day|week|night|fest)\b/,
      /\bcodeathon\b/,
    ],
    subcategories: [
      {
        id: "corporate_hackathon",
        label: "Corporate hackathon",
        patterns: [/\b(?:corporate|company|employer)[- ]sponsored\b/, /\bby (?:google|microsoft|amazon|meta|adobe|ibm|oracle|nvidia|intel)\b/],
      },
      {
        id: "university_hackathon",
        label: "University hackathon",
        patterns: [/\b(?:university|college|student|campus)[- ](?:hackathon|hack)\b/, /\binter[- ]college\b/],
      },
      {
        id: "national_hackathon",
        label: "National hackathon",
        patterns: [/\bnational\b/, /\bsmart india hackathon\b/, /\bgovernment\b/],
      },
      {
        id: "international_hackathon",
        label: "International hackathon",
        patterns: [/\binternational\b/, /\bglobal\b/, /\bworldwide\b/],
      },
      {
        id: "online_hackathon",
        label: "Online hackathon",
        patterns: [/\bonline\b/, /\bvirtual\b/, /\bremote\b/],
      },
      {
        id: "offline_hackathon",
        label: "In-person hackathon",
        patterns: [/\boffline\b/, /\bin[- ]person\b/, /\bon[- ]site\b/],
      },
      {
        id: "hybrid_hackathon",
        label: "Hybrid hackathon",
        patterns: [/\bhybrid\b/],
      },
    ],
  },
  {
    id: "ideathon",
    label: "Ideathons",
    aliases: ["ideathon", "ideathons", "idea competition", "idea challenge"],
    patterns: [
      /\bideathons?\b/,
      /\bidea\s+(?:competition|challenge|contest|fest)\b/,
      /\bdesign\s+thinking\b/,
      /\bproblem[- ]solving\s+(?:competition|challenge|event)\b/,
    ],
    subcategories: [
      {
        id: "idea_competition",
        label: "Idea competition",
        patterns: [/\bidea\s+(?:competition|contest)\b/, /\bpitch\b/],
      },
      {
        id: "innovation_challenge",
        label: "Innovation challenge",
        patterns: [/\binnovation\s+(?:challenge|contest)\b/],
      },
      {
        id: "problem_solving_challenge",
        label: "Problem-solving challenge",
        patterns: [/\bproblem[- ]solving\b/, /\bcase\s+(?:competition|challenge)\b/],
      },
      {
        id: "design_thinking_competition",
        label: "Design-thinking competition",
        patterns: [/\bdesign\s+thinking\b/, /\bhuman[- ]centered\b/],
      },
    ],
  },
  {
    id: "innovation_challenge",
    label: "Innovation Challenges",
    aliases: ["innovation challenge", "innovation", "prototype challenge", "industry challenge"],
    patterns: [
      /\binnovation\s+(?:challenge|programme|program|contest)\b/,
      /\bindustry[- ]sponsored\s+(?:challenge|competition)\b/,
      /\bprototype\s+(?:challenge|competition)\b/,
      /\bproduct\s+(?:development|design)\s+(?:challenge|competition)\b/,
      /\bproblem\s+statement\b/,
    ],
    subcategories: [
      {
        id: "industry_sponsored",
        label: "Industry-sponsored challenge",
        patterns: [/\bindustry[- ]sponsored\b/, /\bcorporate\s+(?:challenge|innovation)\b/],
      },
      {
        id: "prototype_challenge",
        label: "Prototype challenge",
        patterns: [/\bprototype\b/, /\bmvp\b/, /\bbuild\s+(?:a|an)\b/],
      },
      {
        id: "product_development",
        label: "Product-development competition",
        patterns: [/\bproduct\s+(?:development|design)\b/],
      },
      {
        id: "problem_statement",
        label: "Real-world problem statement",
        patterns: [/\bproblem\s+statement\b/, /\breal[- ]world\b/],
      },
    ],
  },
  {
    id: "technical_competition",
    label: "Technical Competitions",
    aliases: ["technical competition", "contest", "competition", "ctf", "coding competition"],
    patterns: [
      /\b(?:coding|programming|competitive programming)\s+(?:competition|contest|challenge)\b/,
      /\bctf\b/,
      /\bcapture\s+the\s+flag\b/,
      /\b(?:robotics|electronics|vlsi|embedded)\s+(?:competition|contest|challenge)\b/,
      /\bengineering\s+(?:competition|contest)\b/,
      /\bicpc\b/,
      /\bcodeforces\b/,
    ],
    subcategories: [
      {
        id: "coding_competition",
        label: "Coding competition",
        patterns: [/\bcoding\s+(?:competition|contest|challenge)\b/, /\bcodeforces\b/, /\bleetcode\b/],
      },
      {
        id: "competitive_programming",
        label: "Competitive programming",
        patterns: [/\bcompetitive\s+programming\b/, /\bicpc\b/, /\bolympiad\b/],
      },
      {
        id: "cybersecurity_ctf",
        label: "Cybersecurity / CTF",
        patterns: [/\bctf\b/, /\bcapture\s+the\s+flag\b/, /\bcyber\s*(?:security|security challenge)\b/],
      },
      {
        id: "robotics_competition",
        label: "Robotics competition",
        patterns: [/\brobotics\b/, /\brobot\s+(?:competition|challenge)\b/],
      },
      {
        id: "electronics_competition",
        label: "Electronics competition",
        patterns: [/\belectronics\b/, /\bcircuit\b/, /\bpcb\b/],
      },
      {
        id: "vlsi_competition",
        label: "VLSI / semiconductor competition",
        patterns: [/\bvlsi\b/, /\bsemiconductor\b/, /\bchip\s+design\b/],
      },
      {
        id: "embedded_competition",
        label: "Embedded-systems competition",
        patterns: [/\bembedded\b/, /\bfirmware\b/, /\bmicrocontroller\b/],
      },
    ],
  },
  {
    id: "technical_event",
    label: "Technical Events",
    aliases: ["technical event", "conference", "workshop", "bootcamp", "developer event"],
    patterns: [
      /\b(?:conference|summit|symposium|congress)\b/,
      /\bworkshops?\b/,
      /\bbootcamps?\b/,
      /\bdeveloper\s+(?:event|day|meetup|summit)\b/,
      /\btech\s*(?:fest|festival)\b/,
      /\bmeetup\b/,
      /\bnetworking\s+event\b/,
    ],
    subcategories: [
      {
        id: "conference",
        label: "Conference",
        patterns: [/\b(?:conference|symposium|congress|summit)\b/],
      },
      {
        id: "workshop",
        label: "Workshop",
        patterns: [/\bworkshops?\b/],
      },
      {
        id: "developer_event",
        label: "Developer event",
        patterns: [/\bdeveloper\s+(?:event|day|meetup|summit)\b/, /\bhack\s*day\b/],
      },
      {
        id: "bootcamp",
        label: "Bootcamp",
        patterns: [/\bbootcamps?\b/],
      },
      {
        id: "tech_festival",
        label: "Technical festival",
        patterns: [/\btech\s*(?:fest|festival)\b/, /\bfest\b/],
      },
      {
        id: "networking_event",
        label: "Networking event",
        patterns: [/\bnetworking\b/, /\bmeetup\b/],
      },
    ],
  },
  {
    id: "internship",
    label: "Internships",
    aliases: ["internship", "internships", "intern", "fellowship", "graduate programme"],
    patterns: [
      /\binternships?\b/,
      /\bintern\b/,
      /\bresearch\s+internship\b/,
      /\bfellowships?\b/,
      /\bgraduate\s+(?:programme|program|scheme)\b/,
      /\btraining\s+(?:programme|program)\b/,
    ],
    subcategories: [
      {
        id: "company_internship",
        label: "Company internship",
        patterns: [/\bcompany\s+internship\b/, /\bsummer\s+internship\b/, /\binternship\s+(?:at|with)\b/],
      },
      {
        id: "research_internship",
        label: "Research internship",
        patterns: [/\bresearch\s+internship\b/, /\bresearch\s+fellowship\b/],
      },
      {
        id: "technical_training",
        label: "Technical training",
        patterns: [/\btraining\s+(?:programme|program)\b/, /\bmentorship\s+programme\b/],
      },
      {
        id: "fellowship",
        label: "Fellowship",
        patterns: [/\bfellowships?\b/],
      },
      {
        id: "graduate_programme",
        label: "Graduate programme",
        patterns: [/\bgraduate\s+(?:programme|program|scheme)\b/],
      },
    ],
  },
  {
    id: "employment",
    label: "Jobs & Recruitment",
    aliases: ["job", "jobs", "employment", "hiring", "recruitment", "career"],
    patterns: [
      /\bjob\s+(?:opening|opportunity|vacancy|posting)s?\b/,
      /\bhiring\b/,
      /\brecruitment\b/,
      /\bcampus\s+(?:placement|recruitment|drive)\b/,
      /\boff[- ]campus\s+drive\b/,
      /\bentry[- ]level\s+(?:job|role|position)\b/,
      /\bwalk[- ]in\b/,
      /\bfresher(?:s)?\b/,
      /\bgraduate\s+(?:recruitment|hiring|job)\b/,
      /\bhiring\s+challenge\b/,
    ],
    subcategories: [
      {
        id: "fresher_hiring",
        label: "Fresher hiring",
        patterns: [/\bfresher(?:s)?\b/, /\bentry[- ]level\b/],
      },
      {
        id: "graduate_recruitment",
        label: "Graduate recruitment",
        patterns: [/\bgraduate\s+(?:recruitment|hiring|job)\b/],
      },
      {
        id: "campus_recruitment",
        label: "Campus recruitment",
        patterns: [/\bcampus\s+(?:placement|recruitment|drive)\b/],
      },
      {
        id: "off_campus_drive",
        label: "Off-campus drive",
        patterns: [/\boff[- ]campus\b/],
      },
      {
        id: "entry_level_job",
        label: "Entry-level job",
        patterns: [/\bentry[- ]level\b/, /\bjunior\s+(?:role|position|engineer)\b/],
      },
      {
        id: "hiring_challenge",
        label: "Hiring challenge",
        patterns: [/\bhiring\s+challenge\b/],
      },
    ],
  },
  {
    id: "research",
    label: "Research Opportunities",
    aliases: ["research", "grant", "funding", "research programme"],
    patterns: [
      /\bresearch\s+(?:competition|programme|program|grant|fellowship|opportunity|project)\b/,
      /\bsponsored\s+(?:project|research)\b/,
      /\bstudent\s+research\b/,
      /\bresearch\s+grant\b/,
      /\bgrant\s+(?:call|programme|program|opportunity)\b/,
      /\bcall\s+for\s+(?:proposals|research)\b/,
    ],
    subcategories: [
      {
        id: "research_competition",
        label: "Research competition",
        patterns: [/\bresearch\s+(?:competition|contest|challenge)\b/],
      },
      {
        id: "sponsored_project",
        label: "Sponsored project",
        patterns: [/\bsponsored\s+(?:project|research)\b/],
      },
      {
        id: "student_research_programme",
        label: "Student research programme",
        patterns: [/\bstudent\s+research\b/, /\bundergraduate\s+research\b/],
      },
      {
        id: "grant",
        label: "Grant",
        patterns: [/\bgrant\b/, /\bfunding\b/],
      },
      {
        id: "institutional_opportunity",
        label: "Institutional opportunity",
        patterns: [/\binstitution\b/, /\buniversity\b/, /\blaboratory\b/],
      },
    ],
  },
  {
    id: "startup",
    label: "Startup & Entrepreneurship",
    aliases: ["startup", "startups", "entrepreneurship", "incubator", "accelerator"],
    patterns: [
      /\bstartups?\s+(?:challenge|competition|programme|program|grant|accelerator|incubator)\b/,
      /\bincubators?\b/,
      /\baccelerators?\b/,
      /\bentrepreneurship\b/,
      /\bventure\s+(?:challenge|competition|programme)\b/,
      /\bprototype\s+grant\b/,
      /\binnovation\s+programme\b/,
    ],
    subcategories: [
      {
        id: "incubator",
        label: "Incubator",
        patterns: [/\bincubator\b/],
      },
      {
        id: "accelerator",
        label: "Accelerator",
        patterns: [/\baccelerator\b/],
      },
      {
        id: "startup_challenge",
        label: "Startup challenge",
        patterns: [/\bstartup\s+(?:challenge|competition)\b/],
      },
      {
        id: "entrepreneurship_competition",
        label: "Entrepreneurship competition",
        patterns: [/\bentrepreneurship\b/, /\bpitch\s+(?:competition|event)\b/],
      },
      {
        id: "prototype_grant",
        label: "Prototype grant",
        patterns: [/\bprototype\s+grant\b/, /\bseed\s+fund\b/],
      },
      {
        id: "innovation_programme",
        label: "Innovation programme",
        patterns: [/\binnovation\s+(?:programme|program)\b/],
      },
    ],
  },
] as const;

type DomainDefinition = {
  id: TechnicalDomainId;
  label: string;
  aliases: readonly string[];
  patterns: readonly RegExp[];
};

export const TECHNICAL_DOMAINS: readonly DomainDefinition[] = [
  {
    id: "ai_ml",
    label: "AI / ML / GenAI / Data Science",
    aliases: ["ai", "ai/ml", "ai / ml", "artificial intelligence", "machine learning", "ml", "deep learning", "dl", "genai", "data science", "data"],
    patterns: [
      /\bai\b/,
      /\bartificial\s+intelligence\b/,
      /\bmachine\s+learning\b/,
      /\bdeep\s+learning\b/,
      /\bgen(?:erative)?\s*ai\b/,
      /\bllms?\b/,
      /\bdata\s+science\b/,
      /\bcomputer\s+vision\b/,
      /\bnlp\b/,
    ],
  },
  {
    id: "software",
    label: "Software / Web / Mobile / Systems",
    aliases: ["software", "software engineering", "web", "mobile", "backend", "frontend", "systems", "app development"],
    patterns: [
      /\bsoftware\b/,
      /\bweb\s+(?:development|app|application)\b/,
      /\bmobile\s+(?:app|development)\b/,
      /\bbackend\b/,
      /\bfrontend\b/,
      /\bfull[- ]stack\b/,
      /\boperating\s+systems?\b/,
      /\bdistributed\s+systems?\b/,
    ],
  },
  {
    id: "cybersecurity",
    label: "Cybersecurity / Ethical Hacking / Networking",
    aliases: ["cybersecurity", "cyber security", "security", "ethical hacking", "networking", "infosec"],
    patterns: [
      /\bcyber\s*security\b/,
      /\bcybersecurity\b/,
      /\bethical\s+hacking\b/,
      /\bpenetration\s+testing\b/,
      /\binfosec\b/,
      /\bnetworking\b/,
      /\bnetwork\s+security\b/,
    ],
  },
  {
    id: "electronics_vlsi",
    label: "ECE / VLSI / Semiconductors / Electronics",
    aliases: ["ece", "vlsi", "semiconductor", "semiconductors", "electronics", "chip design"],
    patterns: [
      /\bvlsi\b/,
      /\bsemiconductors?\b/,
      /\bchip\s+design\b/,
      /\belectronics?\b/,
      /\bece\b/,
      /\bcircuit\s+design\b/,
      /\bfpga\b/,
    ],
  },
  {
    id: "embedded_iot_robotics",
    label: "Embedded Systems / IoT / Robotics / Automation",
    aliases: ["embedded", "embedded systems", "iot", "robotics", "automation", "mechatronics"],
    patterns: [
      /\bembedded\s+systems?\b/,
      /\bembedded\b/,
      /\biot\b/,
      /\binternet\s+of\s+things\b/,
      /\brobotics?\b/,
      /\bautomation\b/,
      /\bmechatronics\b/,
      /\bdrone\b/,
    ],
  },
  {
    id: "cloud_devops",
    label: "Cloud / DevOps",
    aliases: ["cloud", "devops", "aws", "azure", "gcp", "kubernetes", "sre"],
    patterns: [
      /\bcloud\s+(?:computing|native|platform)\b/,
      /\bdevops\b/,
      /\bkubernetes\b/,
      /\baws\b/,
      /\bazure\b/,
      /\bgcp\b/,
      /\bplatform\s+engineering\b/,
    ],
  },
  {
    id: "blockchain",
    label: "Blockchain",
    aliases: ["blockchain", "web3", "distributed ledger", "smart contracts"],
    patterns: [
      /\bblockchain\b/,
      /\bweb3\b/,
      /\bsmart\s+contracts?\b/,
      /\bdistributed\s+ledger\b/,
    ],
  },
  {
    id: "hardware_communications",
    label: "Hardware / Communications / Engineering",
    aliases: ["hardware", "communications", "communication engineering", "electrical", "mechanical", "engineering"],
    patterns: [
      /\bhardware\b/,
      /\bcommunications?\s+(?:engineering|systems?)\b/,
      /\bwireless\b/,
      /\brf\b/,
      /\bsignal\s+processing\b/,
      /\belectrical\s+engineering\b/,
      /\bmechanical\s+engineering\b/,
    ],
  },
  {
    id: "interdisciplinary",
    label: "Interdisciplinary Engineering",
    aliases: ["interdisciplinary", "engineering", "science", "technology", "multidisciplinary"],
    patterns: [
      /\binterdisciplinary\b/,
      /\bmultidisciplinary\b/,
      /\bcross[- ]disciplinary\b/,
    ],
  },
];

export const OPPORTUNITY_VIEWS = [
  { id: "all", label: "All Opportunities" },
  { id: "recommended", label: "Recommended for Me" },
  { id: "closing_soon", label: "Closing Soon" },
  { id: "upcoming", label: "Upcoming" },
  { id: "verified", label: "Verified" },
  { id: "saved", label: "Saved" },
  { id: "applied", label: "Applied" },
  { id: "expired", label: "Expired / Cancelled" },
] as const;

export type OpportunityViewId = (typeof OPPORTUNITY_VIEWS)[number]["id"];

function normalize(value: string | null | undefined): string {
  return (value ?? "")
    .normalize("NFKC")
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ");
}

const categoryById = new Map<OpportunityCategoryId, CategoryDefinition>(
  OPPORTUNITY_CATEGORIES.map((category) => [category.id, category]),
);

const categoryAliases = new Map<string, OpportunityCategoryId>();
for (const category of OPPORTUNITY_CATEGORIES) {
  categoryAliases.set(normalize(category.id), category.id);
  categoryAliases.set(normalize(category.label), category.id);
  for (const alias of category.aliases) {
    categoryAliases.set(normalize(alias), category.id);
  }
}

const categoryFallbackAliases: Record<string, OpportunityCategoryId> = {
  education: "research",
  educational: "research",
  scholarship: "research",
  scholarships: "research",
  grant: "research",
  grants: "research",
  funding: "research",
  innovation: "innovation_challenge",
  contest: "technical_competition",
  competition: "technical_competition",
  competitions: "technical_competition",
  event: "technical_event",
  events: "technical_event",
  conference: "technical_event",
  conferences: "technical_event",
  workshop: "technical_event",
  workshops: "technical_event",
  bootcamp: "technical_event",
  bootcamps: "technical_event",
  career: "employment",
  careers: "employment",
  job: "employment",
  jobs: "employment",
  hiring: "employment",
  internship: "internship",
  internships: "internship",
  fellowship: "internship",
  fellowships: "internship",
  incubator: "startup",
  incubators: "startup",
  accelerator: "startup",
  accelerators: "startup",
  entrepreneurship: "startup",
};

export function canonicalCategory(
  value: string | null | undefined,
): OpportunityCategoryId | null {
  const key = normalize(value);
  if (!key) return null;
  return categoryAliases.get(key) ?? categoryFallbackAliases[key] ?? null;
}

export function categoryLabel(value: string | null | undefined): string | null {
  const id = canonicalCategory(value);
  return id ? categoryById.get(id)?.label ?? null : null;
}

const domainById = new Map<TechnicalDomainId, DomainDefinition>(
  TECHNICAL_DOMAINS.map((domain) => [domain.id, domain]),
);

const domainAliases = new Map<string, TechnicalDomainId>();
for (const domain of TECHNICAL_DOMAINS) {
  domainAliases.set(normalize(domain.id), domain.id);
  domainAliases.set(normalize(domain.label), domain.id);
  for (const alias of domain.aliases) {
    domainAliases.set(normalize(alias), domain.id);
  }
}

const domainFallbackAliases: Record<string, TechnicalDomainId> = {
  engineering: "interdisciplinary",
  science: "interdisciplinary",
  sciences: "interdisciplinary",
  technology: "interdisciplinary",
  technologies: "interdisciplinary",
  data: "ai_ml",
  "data science": "ai_ml",
  "information technology": "software",
  it: "software",
  computer: "software",
  computing: "software",
  computer_science: "software",
  "computer science": "software",
};

export function canonicalDomain(
  value: string | null | undefined,
): TechnicalDomainId | null {
  const key = normalize(value);
  if (!key) return null;
  return domainAliases.get(key) ?? domainFallbackAliases[key] ?? null;
}

export function domainLabel(value: string | null | undefined): string | null {
  const id = canonicalDomain(value);
  return id ? domainById.get(id)?.label ?? null : null;
}

export type OpportunityClassification = {
  category: OpportunityCategoryId | null;
  subcategory: string | null;
  domains: TechnicalDomainId[];
};

type ClassifiableText = {
  title: string;
  description?: string | null;
  sourceCategoryHints?: readonly string[];
  sourceDomainHints?: readonly string[];
};

function scorePatterns(
  patterns: readonly RegExp[],
  title: string,
  body: string,
): number {
  let score = 0;
  for (const pattern of patterns) {
    if (pattern.test(title)) score += 4;
    else if (pattern.test(body)) score += 2;
  }
  return score;
}

function bestSubcategory(
  category: CategoryDefinition,
  title: string,
  body: string,
): string | null {
  let best: { id: string; score: number } | null = null;
  for (const subcategory of category.subcategories) {
    const score = scorePatterns(subcategory.patterns, title, body);
    if (score > 0 && (!best || score > best.score)) {
      best = { id: subcategory.id, score };
    }
  }
  return best?.id ?? null;
}

/**
 * Deterministic lead classification. It never invents a value: when a source
 * has no clear category/domain signal the field stays null.
 */
export function classifyOpportunity(input: ClassifiableText): OpportunityClassification {
  const title = normalize(input.title);
  const body = normalize(input.description);

  let bestCategory: { category: CategoryDefinition; score: number } | null = null;
  for (const category of OPPORTUNITY_CATEGORIES) {
    const score = scorePatterns(category.patterns, title, body);
    if (score > 0 && (!bestCategory || score > bestCategory.score)) {
      bestCategory = { category, score };
    }
  }

  let category: OpportunityCategoryId | null = bestCategory?.category.id ?? null;
  if (!category) {
    const hints = (input.sourceCategoryHints ?? [])
      .map(canonicalCategory)
      .filter((value): value is OpportunityCategoryId => value !== null);
    const uniqueHints = Array.from(new Set(hints));
    if (uniqueHints.length === 1) {
      category = uniqueHints[0];
    }
  }

  const domains = new Map<TechnicalDomainId, number>();
  for (const domain of TECHNICAL_DOMAINS) {
    const score = scorePatterns(domain.patterns, title, body);
    if (score > 0) domains.set(domain.id, score);
  }

  if (domains.size === 0) {
    for (const hint of input.sourceDomainHints ?? []) {
      const domain = canonicalDomain(hint);
      if (domain) domains.set(domain, 1);
    }
  }

  return {
    category,
    subcategory: category && bestCategory
      ? bestSubcategory(bestCategory.category, title, body)
      : null,
    domains: Array.from(domains.entries())
      .sort((left, right) => right[1] - left[1])
      .map(([domain]) => domain)
      .slice(0, 5),
  };
}
