"use client";

import { useMemo, useState } from "react";

import {
  removeOpportunityTracking,
  saveOpportunityTracking,
} from "./actions";

export type OpportunityListItem = {
  id: string;
  title: string;
  organizer: string | null;
  description: string | null;
  category: string | null;
  domains: string[];
  format: string | null;
  benefits: Array<{
    label: string;
    value: boolean | null;
  }>;
  registrationClosesOn: string | null;
  submissionDeadline: string | null;
  entryFeeAmount: number | null;
  entryFeeCurrency: string | null;
  verificationStatus: string;
  lifecycleStatus: string;
  score: number;
  relevanceScore: number;
  deadlineUrgency: number | null;
  eligibilityStatus: string;
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
  trackingStatus: "saved" | "applied" | null;
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

export function OpportunityList({
  items,
}: {
  items: OpportunityListItem[];
}) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [verification, setVerification] = useState("all");
  const [tracking, setTracking] = useState("all");
  const [sort, setSort] = useState("score");

  const categories = useMemo(
    () =>
      Array.from(
        new Set(items.map((item) => item.category).filter(Boolean)),
      ).sort(),
    [items],
  );

  const visibleItems = useMemo(() => {
    const search = query.trim().toLowerCase();
    return items
      .filter((item) => {
        const searchable =
          `${item.title} ${item.organizer ?? ""} ${item.description ?? ""} ${item.domains.join(" ")}`
            .toLowerCase();
        return (
          (!search || searchable.includes(search)) &&
          (category === "all" || item.category === category) &&
          (verification === "all" ||
            item.verificationStatus === verification) &&
          (tracking === "all" ||
            (tracking === "not-tracked"
              ? item.trackingStatus == null
              : item.trackingStatus === tracking))
        );
      })
      .sort((left, right) => {
        if (sort === "deadline") {
          const leftDate = left.registrationClosesOn ??
            left.submissionDeadline ??
            "9999-12-31";
          const rightDate = right.registrationClosesOn ??
            right.submissionDeadline ??
            "9999-12-31";
          return leftDate.localeCompare(rightDate);
        }
        return right.score - left.score;
      });
  }, [category, items, query, sort, tracking, verification]);

  return (
    <>
      <section
        aria-label="Opportunity filters"
        className="mt-8 grid gap-3 rounded-xl border bg-white p-4 sm:grid-cols-2 lg:grid-cols-5"
      >
        <label className="text-sm font-medium text-gray-700">
          Search
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Title, organizer, skill"
            className="mt-1 w-full rounded-md border px-3 py-2"
          />
        </label>
        <label className="text-sm font-medium text-gray-700">
          Category
          <select
            value={category}
            onChange={(event) => setCategory(event.target.value)}
            className="mt-1 w-full rounded-md border px-3 py-2"
          >
            <option value="all">All categories</option>
            {categories.map((item) => (
              <option key={item} value={item ?? ""}>{item}</option>
            ))}
          </select>
        </label>
        <label className="text-sm font-medium text-gray-700">
          Verification
          <select
            value={verification}
            onChange={(event) => setVerification(event.target.value)}
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
            value={tracking}
            onChange={(event) => setTracking(event.target.value)}
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
            onChange={(event) => setSort(event.target.value)}
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

      <div className="mt-4 grid gap-5">
        {visibleItems.map((item) => (
          <article
            key={item.id}
            className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm"
          >
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">
                  {item.category ?? "Opportunity"} · {readable(item.verificationStatus)}
                </p>
                <h2 className="mt-1 text-xl font-bold text-gray-900">
                  {item.title}
                </h2>
                {item.organizer ? (
                  <p className="mt-1 text-sm text-gray-600">
                    {item.organizer}
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
                  <dt className="font-semibold text-gray-700">Domains</dt>
                  <dd className="text-gray-600">{item.domains.join(", ")}</dd>
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
        ))}
      </div>
    </>
  );
}
