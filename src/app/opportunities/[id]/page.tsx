import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { AppNav } from "@/components/AppNav";
import { createClient } from "@/lib/firebase/server";
import { loadOpportunityDetail } from "@/lib/opportunities/detail";
import { categoryLabel, domainLabel } from "@/lib/opportunities/taxonomy";
import {
  removeOpportunityTracking,
  saveOpportunityTracking,
} from "@/app/opportunities/actions";

export const dynamic = "force-dynamic";

const uuid =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function readable(value: string): string {
  return value.replaceAll("_", " ");
}

function date(value: string | null): string {
  if (!value) return "Unknown";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? value
    : new Intl.DateTimeFormat("en-IN", {
        dateStyle: "medium",
        timeZone: "UTC",
      }).format(parsed);
}

function details(value: unknown): string {
  if (value == null) return "Unknown";
  if (typeof value === "string") return value || "Not restricted";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (Array.isArray(value)) {
    return value.length > 0 ? value.map(String).join(", ") : "Not restricted";
  }
  return JSON.stringify(value);
}

export default async function OpportunityDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!uuid.test(id)) notFound();

  const store = await createClient();
  const { data: claims, error: claimsError } = await store.auth.getClaims();
  const userId = claims?.claims?.sub;
  if (claimsError || typeof userId !== "string") redirect("/login");

  const { data: settings } = await store
    .from("personal_settings")
    .select("timezone")
    .eq("owner_id", userId)
    .maybeSingle();
  const timezone =
    typeof settings?.timezone === "string" && settings.timezone
      ? settings.timezone
      : "Asia/Kolkata";

  let opportunity;
  try {
    opportunity = await loadOpportunityDetail(store, userId, id, timezone);
  } catch (error) {
    console.error("opportunity_detail_load_failed", {
      message: error instanceof Error ? error.message : "unknown",
    });
    return (
      <>
        <AppNav />
        <main className="mx-auto max-w-3xl p-8">
          <p role="alert" className="rounded-md bg-red-50 p-4 text-red-800">
            This opportunity could not be loaded.
          </p>
          <Link href="/opportunities" className="mt-4 inline-block text-blue-700 underline">
            Back to opportunities
          </Link>
        </main>
      </>
    );
  }

  if (!opportunity) notFound();

  return (
    <>
      <AppNav />
      <main className="min-h-screen bg-gray-50 p-6 sm:p-8">
        <article className="mx-auto max-w-4xl">
          <Link
            href="/opportunities"
            className="text-sm font-medium text-blue-700 hover:underline"
          >
            ← Back to opportunities
          </Link>

          <header className="mt-4 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="max-w-2xl">
                <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">
                  {categoryLabel(opportunity.category) ?? "Unclassified lead"}
                  {" · "}
                  {readable(opportunity.verificationStatus)}
                  {" · "}
                  {readable(opportunity.lifecycleStatus)}
                </p>
                <h1 className="mt-2 text-3xl font-bold text-gray-950">
                  {opportunity.title}
                </h1>
                <p className="mt-2 text-sm text-gray-600">
                  {[opportunity.organizer, opportunity.company, opportunity.institution]
                    .filter(Boolean)
                    .join(" · ") || "Organizer not verified"}
                </p>
              </div>
              <div className="rounded-lg bg-blue-50 px-5 py-3 text-right">
                <p className="text-3xl font-bold text-blue-900">
                  {opportunity.score.score}
                </p>
                <p className="text-xs text-blue-800">Match score / 100</p>
              </div>
            </div>

            <div className="mt-5 flex flex-wrap gap-3">
              {opportunity.applicationUrl ? (
                <a
                  href={opportunity.applicationUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-md bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800"
                >
                  Official application page
                </a>
              ) : (
                <span className="rounded-md border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-900">
                  No verified application URL
                </span>
              )}
              {opportunity.announcementUrl ? (
                <a
                  href={opportunity.announcementUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-md border px-4 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50"
                >
                  Original announcement
                </a>
              ) : null}
            </div>

            <div className="mt-5 flex flex-wrap gap-3 border-t pt-5">
              {opportunity.trackingStatus !== "applied" ? (
                <form action={saveOpportunityTracking}>
                  <input type="hidden" name="opportunityId" value={opportunity.id} />
                  <input type="hidden" name="status" value="saved" />
                  <button className="rounded-md border px-4 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50">
                    {opportunity.trackingStatus === "saved" ? "Saved" : "Save"}
                  </button>
                </form>
              ) : null}
              {opportunity.trackingStatus !== "applied" ? (
                <form action={saveOpportunityTracking}>
                  <input type="hidden" name="opportunityId" value={opportunity.id} />
                  <input type="hidden" name="status" value="applied" />
                  <button className="rounded-md bg-green-700 px-4 py-2 text-sm font-semibold text-white hover:bg-green-800">
                    Mark applied
                  </button>
                </form>
              ) : (
                <span className="rounded-md bg-green-50 px-4 py-2 text-sm font-semibold text-green-800">
                  Applied
                </span>
              )}
              {opportunity.trackingStatus ? (
                <form action={removeOpportunityTracking}>
                  <input type="hidden" name="opportunityId" value={opportunity.id} />
                  <button className="rounded-md border px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
                    Remove tracking
                  </button>
                </form>
              ) : null}
            </div>
          </header>

          <section className="mt-6 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-bold text-gray-900">Verified facts</h2>
            <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-2">
              <div><dt className="font-semibold text-gray-600">Deadline</dt><dd className="mt-1 text-gray-900">{date(opportunity.registrationClosesOn ?? opportunity.submissionDeadline)}</dd></div>
              <div><dt className="font-semibold text-gray-600">Format</dt><dd className="mt-1 text-gray-900">{opportunity.format ?? "Unknown"}</dd></div>
              <div><dt className="font-semibold text-gray-600">Location</dt><dd className="mt-1 text-gray-900">{opportunity.location ?? opportunity.geography ?? "Unknown"}</dd></div>
              <div><dt className="font-semibold text-gray-600">Fee</dt><dd className="mt-1 text-gray-900">{opportunity.entryFeeAmount == null ? "Unknown" : `${opportunity.entryFeeAmount} ${opportunity.entryFeeCurrency ?? ""}`}</dd></div>
              <div><dt className="font-semibold text-gray-600">Event dates</dt><dd className="mt-1 text-gray-900">{date(opportunity.eventStartsOn)} – {date(opportunity.eventEndsOn)}</dd></div>
              <div><dt className="font-semibold text-gray-600">Prize</dt><dd className="mt-1 text-gray-900">{opportunity.prizeDetails ?? "Unknown"}</dd></div>
            </dl>
            <div className="mt-4 flex flex-wrap gap-2">
              {opportunity.domains.length > 0 ? opportunity.domains.map((domain) => (
                <span key={domain} className="rounded-full bg-gray-100 px-3 py-1 text-xs text-gray-700">
                  {domainLabel(domain) ?? domain}
                </span>
              )) : <span className="text-sm text-gray-500">No verified technical domain.</span>}
            </div>
            {opportunity.verifiedFields.length === 0 ? (
              <p className="mt-4 rounded-md bg-amber-50 p-3 text-sm text-amber-900">
                No facts have been verified yet. Values above remain unknown until a reviewer records evidence.
              </p>
            ) : null}
          </section>

          <section className="mt-6 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-bold text-gray-900">Eligibility</h2>
            <p className="mt-2 text-sm font-semibold text-gray-800">
              {readable(opportunity.eligibility.status)}
            </p>
            <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-gray-700">
              {[...opportunity.eligibility.reasons, ...opportunity.eligibility.missingInformation, ...opportunity.eligibility.conflicts]
                .map((reason, index) => <li key={`${index}-${reason}`}>{reason}</li>)}
            </ul>
          </section>

          <section className="mt-6 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-bold text-gray-900">Why this score</h2>
            <ul className="mt-3 space-y-2 text-sm text-gray-700">
              {opportunity.score.components.map((component) => (
                <li key={component.name} className="flex justify-between gap-4 border-b border-gray-100 pb-2">
                  <span>{component.explanation}</span>
                  <span className="shrink-0 font-semibold text-gray-900">{component.points}/{component.maximum}</span>
                </li>
              ))}
            </ul>
            {opportunity.score.warnings.length > 0 ? (
              <div className="mt-4 rounded-md bg-amber-50 p-3 text-sm text-amber-900">
                {opportunity.score.warnings.map((warning) => <p key={warning}>{warning}</p>)}
              </div>
            ) : null}
          </section>

          <section className="mt-6 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-bold text-gray-900">Description</h2>
            <p className="mt-3 whitespace-pre-line text-sm leading-6 text-gray-700">
              {opportunity.description ?? "No description collected."}
            </p>
          </section>

          <section className="mt-6 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-bold text-gray-900">Provenance</h2>
            <p className="mt-2 text-xs text-gray-500">
              First discovered {date(opportunity.firstDiscoveredAt)} · Last checked {date(opportunity.lastCheckedAt)} · Last verified {date(opportunity.lastVerifiedAt)}
            </p>
            <ul className="mt-3 space-y-2 text-sm">
              {opportunity.sourceLinks.map((source) => (
                <li key={`${source.url}-${source.type}`}>
                  <a href={source.url} target="_blank" rel="noreferrer" className="break-all text-blue-700 underline">
                    {source.type}
                  </a>
                  <span className="text-gray-500"> · {readable(source.status)}</span>
                </li>
              ))}
              {opportunity.sourceLinks.length === 0 ? <li className="text-gray-500">No source records.</li> : null}
            </ul>
          </section>

          {opportunity.changes.length > 0 ? (
            <section className="mt-6 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
              <h2 className="text-xl font-bold text-gray-900">Change history</h2>
              <ul className="mt-3 space-y-2 text-sm text-gray-700">
                {opportunity.changes.map((change, index) => (
                  <li key={`${change.fieldName}-${index}`}>
                    <span className="font-medium">{change.fieldName}</span>: {details(change.previousValue)} → {details(change.newValue)}
                    <span className="block text-xs text-gray-500">{date(change.changedAt)}</span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </article>
      </main>
    </>
  );
}
