import { redirect } from "next/navigation";

import { getFirebaseAdminClient } from "@/lib/firebase/store";
import { createClient } from "@/lib/firebase/server";
import { VERIFIABLE_FIELDS } from "@/lib/opportunities/verification";

import { reviewOpportunityEvidence } from "./actions";

type AdminPageProps = {
  searchParams: Promise<{ error?: string; saved?: string }>;
};

const errorText: Record<string, string> = {
  invalid_opportunity: "Select a valid opportunity.",
  invalid_evidence: "Provide a valid HTTPS evidence URL, source name, and excerpt.",
  invalid_decision: "Choose a supported review decision.",
  official_source_required: "Only directly reviewed official organizer/event pages can verify facts.",
  invalid_fact: "The selected field value is invalid.",
  review_failed: "The review could not be saved. Check server logs and database state before retrying.",
};

export default async function OpportunityReviewPage({
  searchParams,
}: AdminPageProps) {
  const params = await searchParams;
  const authClient = await createClient();
  const { data: claimsData, error: claimsError } =
    await authClient.auth.getClaims();
  const userId = claimsData?.claims?.sub;
  const reviewerIds = new Set(
    (process.env.OPPORTUNITY_REVIEWER_IDS ?? "")
      .split(",")
      .map((item) => item.trim().toLowerCase())
      .filter(Boolean),
  );
  const reviewerEmails = new Set(
    (process.env.OPPORTUNITY_REVIEWER_EMAILS ?? "")
      .split(",")
      .map((item) => item.trim().toLowerCase())
      .filter(Boolean),
  );
  const email =
    typeof claimsData?.claims?.email === "string"
      ? claimsData.claims.email.toLowerCase()
      : "";

  if (
    claimsError ||
    !userId ||
    (!reviewerIds.has(userId.toLowerCase()) &&
      (!email || !reviewerEmails.has(email)))
  ) {
    redirect("/dashboard");
  }

  const admin = getFirebaseAdminClient();
  const [
    { data: opportunities, error: opportunityError },
    { data: evidence, error: evidenceError },
  ] = await Promise.all([
    admin
      .from("opportunities")
      .select("id,title,canonical_url,verification_status,lifecycle_status,first_discovered_at,verified_fields")
      .in("verification_status", [
        "discovered",
        "extracted",
        "pending_verification",
        "third_party_reported",
        "partially_verified",
        "official_source_partial",
        "conflicting",
      ])
      .order("first_discovered_at", { ascending: false })
      .limit(100),
    admin
      .from("opportunity_field_evidence")
      .select("opportunity_id,field_name,source_name,evidence_url,decision,reviewed_at")
      .order("reviewed_at", { ascending: false })
      .limit(500),
  ]);

  const loadError = opportunityError || evidenceError;

  return (
    <main className="mx-auto min-h-screen max-w-5xl bg-gray-50 p-6 sm:p-8">
      <header>
        <p className="text-sm font-semibold uppercase tracking-wide text-blue-700">
          Reviewer workspace
        </p>
        <h1 className="mt-1 text-3xl font-bold text-gray-950">
          Opportunity evidence review
        </h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-gray-600">
          Verify one fact at a time against the cited organizer or event page.
          Site accessibility alone is not proof. Copy a short supporting excerpt;
          do not use generated text. Third-party reports and conflicts are stored
          without overwriting verified facts. This workflow only assigns partial
          official verification; it cannot mark a whole opportunity fully verified.
        </p>
      </header>

      {params.saved ? (
        <p role="status" className="mt-5 rounded-md bg-green-50 p-3 text-green-800">
          Evidence and review decision saved.
        </p>
      ) : null}
      {params.error && errorText[params.error] ? (
        <p role="alert" className="mt-5 rounded-md bg-red-50 p-3 text-red-800">
          {errorText[params.error]}
        </p>
      ) : null}
      {loadError ? (
        <p role="alert" className="mt-5 rounded-md bg-red-50 p-3 text-red-800">
          The reviewer queue could not be loaded.
        </p>
      ) : null}

      <div className="mt-8 space-y-6">
        {(opportunities ?? []).map((opportunity) => {
          const records = (evidence ?? []).filter(
            (item) => item.opportunity_id === opportunity.id,
          );
          return (
            <article
              key={opportunity.id}
              className="rounded-xl border bg-white p-5 shadow-sm"
            >
              <p className="text-xs font-semibold uppercase text-gray-500">
                {opportunity.verification_status} · {opportunity.lifecycle_status}
              </p>
              <h2 className="mt-1 text-xl font-bold text-gray-900">
                {opportunity.title}
              </h2>
              <a
                href={opportunity.canonical_url}
                target="_blank"
                rel="noreferrer"
                className="mt-2 inline-block break-all text-sm text-blue-700 underline"
              >
                Original announcement
              </a>
              <p className="mt-2 text-xs text-gray-500">
                Discovered {new Date(opportunity.first_discovered_at).toISOString()}
                {" · Verified fields: "}
                {Array.isArray(opportunity.verified_fields)
                  ? opportunity.verified_fields.join(", ") || "none"
                  : "none"}
              </p>

              {records.length > 0 ? (
                <details className="mt-4">
                  <summary className="cursor-pointer text-sm font-medium">
                    Evidence history ({records.length})
                  </summary>
                  <ul className="mt-2 space-y-2 text-sm text-gray-700">
                    {records.map((item, index) => (
                      <li key={`${opportunity.id}-evidence-${index}`}>
                        <span className="font-medium">{item.field_name}</span>
                        {" · "}
                        {item.decision}
                        {" · "}
                        {item.source_name}
                        {" · "}
                        <a
                          href={item.evidence_url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-blue-700 underline"
                        >
                          evidence
                        </a>
                        {" · "}
                        {new Date(item.reviewed_at).toISOString()}
                      </li>
                    ))}
                  </ul>
                </details>
              ) : null}

              <form
                action={reviewOpportunityEvidence}
                className="mt-5 grid gap-4 border-t pt-5 sm:grid-cols-2"
              >
                <input
                  type="hidden"
                  name="opportunityId"
                  value={opportunity.id}
                />
                <label className="text-sm font-medium text-gray-700">
                  Fact to review
                  <select
                    name="field"
                    required
                    className="mt-1 w-full rounded-md border px-3 py-2"
                  >
                    {VERIFIABLE_FIELDS.map((field) => (
                      <option key={field} value={field}>{field}</option>
                    ))}
                  </select>
                </label>
                <label className="text-sm font-medium text-gray-700">
                  Review decision
                  <select
                    name="decision"
                    required
                    className="mt-1 w-full rounded-md border px-3 py-2"
                  >
                    <option value="verified">Verified from official source</option>
                    <option value="third_party_reported">Third-party reported only</option>
                    <option value="conflicting">Conflicting information found</option>
                    <option value="unverified">Could not verify</option>
                  </select>
                </label>
                <label className="text-sm font-medium text-gray-700">
                  Evidence source name
                  <input
                    name="sourceName"
                    required
                    maxLength={200}
                    className="mt-1 w-full rounded-md border px-3 py-2"
                    placeholder="Organizer or event website"
                  />
                </label>
                <label className="text-sm font-medium text-gray-700">
                  Evidence source type
                  <select
                    name="sourceType"
                    required
                    className="mt-1 w-full rounded-md border px-3 py-2"
                  >
                    <option value="official">Official organizer/event source</option>
                    <option value="third_party">Third-party platform/report</option>
                  </select>
                </label>
                <label className="text-sm font-medium text-gray-700 sm:col-span-2">
                  Evidence URL (HTTPS)
                  <input
                    name="sourceUrl"
                    type="url"
                    required
                    pattern="https://.*"
                    className="mt-1 w-full rounded-md border px-3 py-2"
                  />
                </label>
                <label className="text-sm font-medium text-gray-700 sm:col-span-2">
                  Fact value (lists: comma-separated or &quot;none&quot;; team size: min,max or &quot;none&quot;; dates: YYYY-MM-DD)
                  <input
                    name="factValue"
                    maxLength={2000}
                    className="mt-1 w-full rounded-md border px-3 py-2"
                    placeholder="Use an explicit value; for example, none, true, 2,5, or 2026-11-15"
                  />
                </label>
                <label className="text-sm font-medium text-gray-700 sm:col-span-2">
                  Supporting excerpt or concise reviewer note
                  <textarea
                    name="excerpt"
                    required
                    maxLength={2000}
                    rows={3}
                    className="mt-1 w-full rounded-md border px-3 py-2"
                  />
                </label>
                <button
                  type="submit"
                  className="rounded-md bg-blue-700 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-800 sm:col-span-2 sm:justify-self-start"
                >
                  Save evidence decision
                </button>
              </form>
            </article>
          );
        })}
      </div>
      {!loadError && (opportunities ?? []).length === 0 ? (
        <p className="mt-8 rounded-md bg-white p-5 text-gray-600">
          No opportunities are awaiting review.
        </p>
      ) : null}
    </main>
  );
}
