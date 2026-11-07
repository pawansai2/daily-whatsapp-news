"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import {
  categoryCounts,
  DEFAULT_BROWSE_FILTERS,
  filterOpportunities,
  sortOpportunities,
  uncategorizedCount,
  viewCounts,
  type BrowseOpportunity,
} from "@/lib/opportunities/browse";
import {
  canonicalDomain,
  categoryLabel,
  domainLabel,
  OPPORTUNITY_CATEGORIES,
  OPPORTUNITY_VIEWS,
  type OpportunityCategoryId,
  type OpportunityViewId,
} from "@/lib/opportunities/taxonomy";

import {
  removeOpportunityTracking,
  saveOpportunityTracking,
} from "./actions";

export type OpportunityListItem = BrowseOpportunity & {
  benefits: Array<{
    label: string;
    value: boolean | null;
  }>;
  entryFeeCurrency: string | null;
  relevanceScore: number;
  deadlineUrgency: number | null;
  reasons: string[];
  warnings: string[];
  sourceLinks: Array<{
    url: string;
    type: string;
    status: string;
  }>;
  history: Array<{
    fieldName: string;
    previousValue: unknown;
    newValue: unknown;
    changedAt: string;
  }>;
  applicationUrl: string | null;
};

function readable(value: string): string {
  return value.replaceAll("_", " ");
}

function dateLabel(value: string | null): string {
  if (!value) return "Unknown";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat("en-IN", {
        dateStyle: "medium",
        timeZone: "UTC",
      }).format(date);
}

const eligibilityOptions = [
  "eligible",
  "likely_eligible",
  "potentially_eligible",
  "ineligible",
  "eligibility_conflict",
] as const;

export function OpportunityList({
  items,
  initialView = "all",
  initialCategory = "all",
}: {
  items: OpportunityListItem[];
  initialView?: OpportunityViewId;
  initialCategory?: OpportunityCategoryId | "all";
}) {
  const [now] = useState(() => new Date());
  const [filters, setFilters] = useState(() => ({
    ...DEFAULT_BROWSE_FILTERS,
    view: initialView,
    category: initialCategory,
  }));
  const [sort, setSort] = useState<"score" | "deadline">("score");

  const counts = useMemo(() => categoryCounts(items), [items]);
  const views = useMemo(() => viewCounts(items, { now }), [items, now]);
  const unclassified = useMemo(() => uncategorizedCount(items), [items]);

  const availableDomains = useMemo(
    () =>
      Array.from(
        new Map(
          items.flatMap((item) =>
            item.domains.flatMap((domain) => {
              const id = canonicalDomain(domain);
              return id ? [[id, domainLabel(domain) ?? id] as const] : [];
            }),
          ),
        ).entries(),
      ),
    [items],
  );

  const availableFormats = useMemo(
    () =>
      Array.from(
        new Set(items.map((item) => item.format).filter(Boolean)),
      ).sort() as string[],
    [items],
  );

  const availableGeographies = useMemo(
    () =>
      Array.from(
        new Set(
          items
            .map((item) => item.geography ?? item.location)
            .filter(Boolean),
        ),
      ).sort() as string[],
    [items],
  );

  const visibleItems = useMemo(
    () =>
      sortOpportunities(
        filterOpportunities(items, filters, { now }),
        sort,
      ),
    [filters, items, now, sort],
  );

  function updateFilter<K extends keyof typeof filters>(
    key: K,
    value: (typeof filters)[K],
  ) {
    setFilters((current) => ({ ...current, [key]: value }));
  }

  return (
    <>
      <section aria-label="Opportunity views" className="mt-8">
        <div className="flex flex-wrap gap-2">
          {OPPORTUNITY_VIEWS.map((view) => (
            <button
              key={view.id}
              type="button"
              aria-pressed={filters.view === view.id}
              onClick={() => updateFilter("view", view.id)}
              className={`rounded-full border px-4 py-2 text-sm font-medium ${
                filters.view === view.id
                  ? "border-blue-700 bg-blue-700 text-white"
                  : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
              }`}
            >
              {view.label}
              <span className="ml-2 text-xs opacity-80">
                {views[view.id]}
              </span>
            </button>
          ))}
        </div>

        <div className="mt-4 flex flex-wrap gap-2 border-t border-gray-200 pt-4">
          <button
            type="button"
            aria-pressed={filters.category === "all"}
            onClick={() => updateFilter("category", "all")}
            className={`rounded-md border px-3 py-2 text-sm ${
              filters.category === "all"
                ? "border-gray-900 bg-gray-900 text-white"
                : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
            }`}
          >
            All categories
            <span className="ml-2 text-xs opacity-80">{items.length}</span>
          </button>
          {OPPORTUNITY_CATEGORIES.map((category) => (
            <button
              key={category.id}
              type="button"
              aria-pressed={filters.category === category.id}
              onClick={() => updateFilter("category", category.id)}
              className={`rounded-md border px-3 py-2 text-sm ${
                filters.category === category.id
                  ? "border-gray-900 bg-gray-900 text-white"
                  : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
              }`}
            >
              {category.label}
              <span className="ml-2 text-xs opacity-80">
                {counts[category.id]}
              </span>
            </button>
          ))}
        </div>
        {unclassified > 0 ? (
          <p className="mt-2 text-xs text-amber-800">
            {unclassified} lead(s) have no category signal yet and appear only
            under All.
          </p>
        ) : null}
      </section>

      <section
        aria-label="Opportunity filters"
        className="mt-6 grid gap-3 rounded-xl border bg-white p-4 sm:grid-cols-2 lg:grid-cols-5"
      >
        <label className="text-sm font-medium text-gray-700">
          Search
          <input
            value={filters.query}
            onChange={(event) => updateFilter("query", event.target.value)}
            placeholder="Title, organizer, company, skill"
            className="mt-1 w-full rounded-md border px-3 py-2"
          />
        </label>
        <label className="text-sm font-medium text-gray-700">
          Technical domain
          <select
            value={filters.domain}
            onChange={(event) => updateFilter("domain", event.target.value)}
            className="mt-1 w-full rounded-md border px-3 py-2"
          >
            <option value="all">All domains</option>
            {availableDomains.map(([id, label]) => (
              <option key={id} value={id}>{label}</option>
            ))}
          </select>
        </label>
        <label className="text-sm font-medium text-gray-700">
          Format
          <select
            value={filters.format}
            onChange={(event) => updateFilter("format", event.target.value)}
            className="mt-1 w-full rounded-md border px-3 py-2"
          >
            <option value="all">All formats</option>
            {availableFormats.map((format) => (
              <option key={format} value={format}>{format}</option>
            ))}
          </select>
        </label>
        <label className="text-sm font-medium text-gray-700">
          Geography
          <select
            value={filters.geography}
            onChange={(event) => updateFilter("geography", event.target.value)}
            className="mt-1 w-full rounded-md border px-3 py-2"
          >
            <option value="all">All locations</option>
            {availableGeographies.map((geography) => (
              <option key={geography} value={geography}>{geography}</option>
            ))}
          </select>
        </label>
        <label className="text-sm font-medium text-gray-700">
          Entry fee
          <select
            value={filters.fee}
            onChange={(event) => updateFilter("fee", event.target.value as typeof filters.fee)}
            className="mt-1 w-full rounded-md border px-3 py-2"
          >
            <option value="all">Any fee</option>
            <option value="free">Free</option>
            <option value="paid">Paid</option>
            <option value="unknown">Unknown</option>
          </select>
        </label>
        <label className="text-sm font-medium text-gray-700">
          Deadline
          <select
            value={filters.deadline}
            onChange={(event) => updateFilter("deadline", event.target.value as typeof filters.deadline)}
            className="mt-1 w-full rounded-md border px-3 py-2"
          >
            <option value="all">Any deadline</option>
            <option value="7">Next 7 days</option>
            <option value="30">Next 30 days</option>
          </select>
        </label>
        <label className="text-sm font-medium text-gray-700">
          Eligibility
          <select
            value={filters.eligibility}
            onChange={(event) => updateFilter("eligibility", event.target.value)}
            className="mt-1 w-full rounded-md border px-3 py-2"
          >
            <option value="all">All results</option>
            {eligibilityOptions.map((status) => (
              <option key={status} value={status}>
                {readable(status)}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm font-medium text-gray-700">
          Verification
          <select
            value={filters.verification}
            onChange={(event) => updateFilter("verification", event.target.value)}
            className="mt-1 w-full rounded-md border px-3 py-2"
          >
            <option value="all">All statuses</option>
            <option value="officially_verified">Officially verified</option>
            <option value="official_source_partial">Official source, partial</option>
            <option value="partially_verified">Partially verified</option>
            <option value="discovered">Discovered</option>
            <option value="extracted">Extracted</option>
            <option value="pending_verification">Pending verification</option>
            <option value="third_party_reported">Third-party reported</option>
            <option value="conflicting">Conflicting</option>
            <option value="unverified">Unverified</option>
            <option value="cancelled">Cancelled</option>
            <option value="postponed">Postponed</option>
            <option value="expired">Expired</option>
          </select>
        </label>
        <label className="text-sm font-medium text-gray-700">
          Tracking
          <select
            value={filters.tracking}
            onChange={(event) => updateFilter("tracking", event.target.value as typeof filters.tracking)}
            className="mt-1 w-full rounded-md border px-3 py-2"
          >
            <option value="all">All opportunities</option>
            <option value="not-tracked">Not tracked</option>
            <option value="saved">Saved</option>
            <option value="applied">Applied</option>
          </select>
        </label>
        <label className="text-sm font-medium text-gray-700">
          Sort by
          <select
            value={sort}
            onChange={(event) => setSort(event.target.value as typeof sort)}
            className="mt-1 w-full rounded-md border px-3 py-2"
          >
            <option value="score">Best match</option>
            <option value="deadline">Closing date</option>
          </select>
        </label>
      </section>

      <p className="mt-4 text-sm text-gray-600" aria-live="polite">
        Showing {visibleItems.length} of {items.length} opportunities.
      </p>

      {items.length === 0 ? (
        <div className="mt-4 rounded-xl border bg-white p-8 text-center">
          <h2 className="text-xl font-semibold text-gray-900">
            No verified opportunity leads yet
          </h2>
          <p className="mt-2 text-gray-600">
            New source announcements appear here after collection and
            verification. No sample opportunities are shown as real data.
          </p>
        </div>
      ) : null}

      <div className="mt-4 grid gap-5">
        {visibleItems.map((item) => {
          const category = categoryLabel(item.category);
          return (
            <article
              key={item.id}
              className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm"
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">
                    {category ?? "Unclassified lead"}
                    {item.subcategory ? ` · ${readable(item.subcategory)}` : ""}
                    {" · "}
                    {readable(item.verificationStatus)}
                  </p>
                  <h2 className="mt-1 text-xl font-bold text-gray-900">
                    <Link
                      href={`/opportunities/${item.id}`}
                      className="hover:text-blue-700 hover:underline"
                    >
                      {item.title}
                    </Link>
                  </h2>
                  {item.organizer || item.company || item.institution ? (
                    <p className="mt-1 text-sm text-gray-600">
                      {[item.organizer, item.company, item.institution]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  ) : null}
                </div>
                <div className="rounded-lg bg-blue-50 px-4 py-2 text-right">
                  <p className="text-2xl font-bold text-blue-900">{item.score}</p>
                  <p className="text-xs text-blue-800">
                    Match · {item.relevanceScore} relevance
                  </p>
                </div>
              </div>

              {item.description ? (
                <p className="mt-4 whitespace-pre-line text-sm leading-6 text-gray-700">
                  {item.description}
                </p>
              ) : null}

              <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
                <div>
                  <dt className="font-semibold text-gray-700">Eligibility</dt>
                  <dd className="capitalize text-gray-600">
                    {readable(item.eligibilityStatus)}
                  </dd>
                </div>
                <div>
                  <dt className="font-semibold text-gray-700">Lifecycle</dt>
                  <dd className="capitalize text-gray-600">
                    {readable(item.lifecycleStatus)}
                  </dd>
                </div>
                <div>
                  <dt className="font-semibold text-gray-700">Registration closes</dt>
                  <dd className="text-gray-600">
                    {dateLabel(item.registrationClosesOn)}
                  </dd>
                </div>
                <div>
                  <dt className="font-semibold text-gray-700">Submission deadline</dt>
                  <dd className="text-gray-600">
                    {dateLabel(item.submissionDeadline)}
                  </dd>
                </div>
                <div>
                  <dt className="font-semibold text-gray-700">Format</dt>
                  <dd className="text-gray-600">{item.format ?? "Unknown"}</dd>
                </div>
                <div>
                  <dt className="font-semibold text-gray-700">Geography</dt>
                  <dd className="text-gray-600">
                    {item.geography ?? item.location ?? "Unknown"}
                  </dd>
                </div>
                <div>
                  <dt className="font-semibold text-gray-700">Deadline urgency</dt>
                  <dd className="text-gray-600">
                    {item.deadlineUrgency == null
                      ? "Unknown"
                      : `${item.deadlineUrgency}/100`}
                  </dd>
                </div>
                <div>
                  <dt className="font-semibold text-gray-700">Entry fee</dt>
                  <dd className="text-gray-600">
                    {item.entryFeeAmount == null
                      ? "Unknown"
                      : `${item.entryFeeAmount} ${item.entryFeeCurrency ?? "(currency unknown)"}`}
                  </dd>
                </div>
                {item.domains.length > 0 ? (
                  <div className="sm:col-span-2">
                    <dt className="font-semibold text-gray-700">Technical domains</dt>
                    <dd className="text-gray-600">
                      {item.domains
                        .map((domain) => domainLabel(domain) ?? domain)
                        .join(", ")}
                    </dd>
                  </div>
                ) : null}
              </dl>

              <div className="mt-4">
                <h3 className="text-sm font-semibold text-gray-800">
                  Documented benefits
                </h3>
                <ul className="mt-1 flex flex-wrap gap-2 text-xs">
                  {item.benefits.map((benefit) => (
                    <li
                      key={`${item.id}-${benefit.label}`}
                      className="rounded-full bg-gray-100 px-3 py-1 text-gray-700"
                    >
                      {benefit.label}: {benefit.value === true
                        ? "Yes"
                        : benefit.value === false
                          ? "No"
                          : "Unknown"}
                    </li>
                  ))}
                </ul>
              </div>

              {item.reasons.length > 0 ? (
                <div className="mt-5">
                  <h3 className="text-sm font-semibold text-gray-800">
                    Why this match
                  </h3>
                  <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-gray-600">
                    {item.reasons.slice(0, 5).map((reason, index) => (
                      <li key={`${item.id}-reason-${index}`}>{reason}</li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {item.warnings.length > 0 ? (
                <div className="mt-4 rounded-md bg-amber-50 p-3 text-sm text-amber-900">
                  <h3 className="font-semibold">Check these details</h3>
                  <ul className="mt-1 list-disc space-y-1 pl-5">
                    {item.warnings.map((warning, index) => (
                      <li key={`${item.id}-warning-${index}`}>{warning}</li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {item.sourceLinks.length > 0 ? (
                <div className="mt-4">
                  <h3 className="text-sm font-semibold text-gray-800">
                    Sources
                  </h3>
                  <ul className="mt-1 space-y-1 text-sm">
                    {item.sourceLinks.map((source, index) => (
                      <li key={`${item.id}-source-${index}`}>
                        <a
                          href={source.url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-blue-700 underline"
                        >
                          {source.type} source
                        </a>
                        <span className="ml-2 text-gray-500">
                          ({readable(source.status)})
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <p className="mt-4 text-sm text-amber-800">
                  No source record is available. Verify details before applying.
                </p>
              )}

              <details className="mt-4 rounded-md border border-gray-200 px-4 py-3">
                <summary className="cursor-pointer text-sm font-semibold text-gray-800">
                  Change history ({item.history.length})
                </summary>
                {item.history.length > 0 ? (
                  <ol className="mt-3 space-y-3">
                    {item.history.map((change, index) => (
                      <li
                        key={`${item.id}-change-${index}`}
                        className="border-l-2 border-gray-200 pl-3 text-sm"
                      >
                        <p className="font-medium capitalize text-gray-800">
                          {readable(change.fieldName)}
                        </p>
                        <p className="mt-1 break-words text-gray-600">
                          {JSON.stringify(change.previousValue) ?? "Unknown"}
                          {" → "}
                          {JSON.stringify(change.newValue) ?? "Unknown"}
                        </p>
                        <time
                          dateTime={change.changedAt}
                          className="text-xs text-gray-500"
                        >
                          {dateLabel(change.changedAt)}
                        </time>
                      </li>
                    ))}
                  </ol>
                ) : (
                  <p className="mt-2 text-sm text-gray-600">
                    No recorded changes.
                  </p>
                )}
              </details>

              <div className="mt-5 flex flex-wrap items-center gap-3">
                {item.applicationUrl ? (
                  <a
                    href={item.applicationUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-md bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800"
                  >
                    Official application page
                  </a>
                ) : null}
                {item.trackingStatus !== "applied" ? (
                  <>
                    {item.trackingStatus !== "saved" ? (
                      <form action={saveOpportunityTracking}>
                        <input type="hidden" name="opportunityId" value={item.id} />
                        <input type="hidden" name="status" value="saved" />
                        <button className="rounded-md border px-4 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50">
                          Save
                        </button>
                      </form>
                    ) : null}
                    <form action={saveOpportunityTracking}>
                      <input type="hidden" name="opportunityId" value={item.id} />
                      <input type="hidden" name="status" value="applied" />
                      <button className="rounded-md border px-4 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50">
                        Mark applied
                      </button>
                    </form>
                  </>
                ) : (
                  <span className="rounded-md bg-green-50 px-3 py-2 text-sm font-semibold capitalize text-green-800">
                    {item.trackingStatus}
                  </span>
                )}
                {item.trackingStatus ? (
                  <form action={removeOpportunityTracking}>
                    <input type="hidden" name="opportunityId" value={item.id} />
                    <button className="px-3 py-2 text-sm text-gray-600 underline">
                      Remove tracking
                    </button>
                  </form>
                ) : null}
              </div>
            </article>
          );
        })}
      </div>
    </>
  );
}
