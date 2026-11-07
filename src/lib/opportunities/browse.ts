import {
  canonicalCategory,
  canonicalDomain,
  OPPORTUNITY_CATEGORY_IDS,
  type OpportunityCategoryId,
  type OpportunityViewId,
} from "@/lib/opportunities/taxonomy";

export type BrowseOpportunity = {
  id: string;
  title: string;
  organizer: string | null;
  company: string | null;
  institution: string | null;
  description: string | null;
  category: string | null;
  subcategory: string | null;
  domains: string[];
  format: string | null;
  geography: string | null;
  location: string | null;
  registrationOpensOn: string | null;
  registrationClosesOn: string | null;
  submissionDeadline: string | null;
  entryFeeAmount: number | null;
  verificationStatus: string;
  lifecycleStatus: string;
  eligibilityStatus: string;
  score: number;
  trackingStatus: "saved" | "applied" | null;
};

export type OpportunityBrowseFilters = {
  view: OpportunityViewId;
  category: OpportunityCategoryId | "all";
  domain: string;
  format: string;
  geography: string;
  fee: "all" | "free" | "paid" | "unknown";
  deadline: "all" | "7" | "30";
  eligibility: string;
  verification: string;
  tracking: "all" | "not-tracked" | "saved" | "applied";
  query: string;
};

export type BrowseOptions = {
  now?: Date;
};

export const DEFAULT_BROWSE_FILTERS: OpportunityBrowseFilters = {
  view: "all",
  category: "all",
  domain: "all",
  format: "all",
  geography: "all",
  fee: "all",
  deadline: "all",
  eligibility: "all",
  verification: "all",
  tracking: "all",
  query: "",
};

const VERIFIED_STATUSES = new Set([
  "officially_verified",
  "official_source_partial",
]);

const EXPIRED_LIFECYCLES = new Set([
  "expired",
  "closed",
  "cancelled",
  "postponed",
]);

const EXPIRED_VERIFICATION = new Set(["expired", "cancelled", "postponed"]);

function dayOnly(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function daysUntil(date: string | null, today: string): number | null {
  if (!date) return null;
  const parsed = Date.parse(`${date.slice(0, 10)}T00:00:00.000Z`);
  if (!Number.isFinite(parsed)) return null;
  const todayMs = Date.parse(`${today}T00:00:00.000Z`);
  return Math.floor((parsed - todayMs) / 86_400_000);
}

export function earliestDeadline(item: BrowseOpportunity): string | null {
  return [item.registrationClosesOn, item.submissionDeadline]
    .filter((value): value is string => Boolean(value))
    .sort()[0] ?? null;
}

export function isClosingSoon(item: BrowseOpportunity, today: string): boolean {
  if (item.lifecycleStatus === "closing_soon") return true;
  const days = daysUntil(earliestDeadline(item), today);
  return days !== null && days >= 0 && days <= 7;
}

export function isUpcoming(item: BrowseOpportunity, today: string): boolean {
  if (item.lifecycleStatus === "upcoming") return true;
  return Boolean(item.registrationOpensOn && item.registrationOpensOn > today);
}

export function isExpiredOrCancelled(
  item: BrowseOpportunity,
  today: string,
): boolean {
  if (EXPIRED_LIFECYCLES.has(item.lifecycleStatus)) return true;
  if (EXPIRED_VERIFICATION.has(item.verificationStatus)) return true;
  const days = daysUntil(earliestDeadline(item), today);
  return days !== null && days < 0;
}

export function isVerified(item: BrowseOpportunity): boolean {
  return VERIFIED_STATUSES.has(item.verificationStatus);
}

export function isRecommended(item: BrowseOpportunity): boolean {
  if (item.eligibilityStatus === "eligible" ||
    item.eligibilityStatus === "likely_eligible") {
    return true;
  }
  return item.eligibilityStatus === "potentially_eligible" &&
    item.score >= 60;
}

export function matchesView(
  item: BrowseOpportunity,
  view: OpportunityViewId,
  today: string,
): boolean {
  switch (view) {
    case "all":
      return true;
    case "recommended":
      return isRecommended(item);
    case "closing_soon":
      return isClosingSoon(item, today);
    case "upcoming":
      return isUpcoming(item, today);
    case "verified":
      return isVerified(item);
    case "saved":
      return item.trackingStatus === "saved";
    case "applied":
      return item.trackingStatus === "applied";
    case "expired":
      return isExpiredOrCancelled(item, today);
    default:
      return true;
  }
}

function normalized(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

function matchesFee(
  item: BrowseOpportunity,
  fee: OpportunityBrowseFilters["fee"],
): boolean {
  if (fee === "all") return true;
  if (fee === "unknown") return item.entryFeeAmount == null;
  if (fee === "free") return item.entryFeeAmount === 0;
  return item.entryFeeAmount != null && item.entryFeeAmount > 0;
}

export function filterOpportunities<T extends BrowseOpportunity>(
  items: readonly T[],
  filters: OpportunityBrowseFilters,
  options: BrowseOptions = {},
): T[] {
  const today = dayOnly(options.now ?? new Date());
  const search = normalized(filters.query);

  return items.filter((item) => {
    if (!matchesView(item, filters.view, today)) return false;

    if (
      filters.category !== "all" &&
      canonicalCategory(item.category) !== filters.category
    ) {
      return false;
    }

    if (
      filters.domain !== "all" &&
      !item.domains.some((domain) => canonicalDomain(domain) === filters.domain)
    ) {
      return false;
    }

    if (
      filters.format !== "all" &&
      normalized(item.format) !== normalized(filters.format)
    ) {
      return false;
    }

    if (filters.geography !== "all") {
      const targets = `${item.geography ?? ""} ${item.location ?? ""}`;
      if (!normalized(targets).includes(normalized(filters.geography))) {
        return false;
      }
    }

    if (!matchesFee(item, filters.fee)) return false;

    if (filters.deadline !== "all") {
      const days = daysUntil(earliestDeadline(item), today);
      const window = Number(filters.deadline);
      if (days === null || days < 0 || days > window) return false;
    }

    if (
      filters.eligibility !== "all" &&
      item.eligibilityStatus !== filters.eligibility
    ) {
      return false;
    }

    if (
      filters.verification !== "all" &&
      item.verificationStatus !== filters.verification
    ) {
      return false;
    }

    if (filters.tracking !== "all") {
      if (
        filters.tracking === "not-tracked"
          ? item.trackingStatus != null
          : item.trackingStatus !== filters.tracking
      ) {
        return false;
      }
    }

    if (search) {
      const searchable = normalized([
        item.title,
        item.organizer,
        item.company,
        item.institution,
        item.description,
        item.category,
        item.subcategory,
        item.geography,
        item.location,
        ...item.domains,
      ].filter(Boolean).join(" "));
      if (!searchable.includes(search)) return false;
    }

    return true;
  });
}

export function sortOpportunities<T extends BrowseOpportunity>(
  items: readonly T[],
  sort: "score" | "deadline",
): T[] {
  return [...items].sort((left, right) => {
    if (sort === "deadline") {
      const leftDate = earliestDeadline(left) ?? "9999-12-31";
      const rightDate = earliestDeadline(right) ?? "9999-12-31";
      const comparison = leftDate.localeCompare(rightDate);
      if (comparison !== 0) return comparison;
    }
    return right.score - left.score;
  });
}

export function categoryCounts(
  items: readonly Pick<BrowseOpportunity, "category">[],
): Record<OpportunityCategoryId, number> {
  const counts = Object.fromEntries(
    OPPORTUNITY_CATEGORY_IDS.map((id) => [id, 0]),
  ) as Record<OpportunityCategoryId, number>;

  for (const item of items) {
    const category = canonicalCategory(item.category);
    if (category) counts[category] += 1;
  }

  return counts;
}

export function uncategorizedCount(
  items: readonly Pick<BrowseOpportunity, "category">[],
): number {
  return items.filter((item) => canonicalCategory(item.category) === null).length;
}

export function viewCounts(
  items: readonly BrowseOpportunity[],
  options: BrowseOptions = {},
): Record<OpportunityViewId, number> {
  const today = dayOnly(options.now ?? new Date());
  const views = [
    "all",
    "recommended",
    "closing_soon",
    "upcoming",
    "verified",
    "saved",
    "applied",
    "expired",
  ] as const;

  return Object.fromEntries(
    views.map((view) => [
      view,
      items.filter((item) => matchesView(item, view, today)).length,
    ]),
  ) as Record<OpportunityViewId, number>;
}
