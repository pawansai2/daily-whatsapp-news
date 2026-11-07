# Opportunity Radar — Architecture and Data Foundation

## Decision

The application runtime uses Firebase Authentication and Cloud Firestore.
Supabase/PostgreSQL migrations are retained as historical source definitions
and as the source for the one-time data import; they are not the runtime
database. The Firestore import maps private `user_id` values to the Firebase
UID for the same email and preserves the existing collection names and fields.
Existing Supabase data is not deleted by the import.

The original additive SQL schema is recorded in
`supabase/migrations/20261106230000_opportunity_data_foundation.sql`.

## Logical architecture

```text
Opportunity source registry
  → scheduled source adapters (isolated per source)
  → extraction and normalization (unknowns remain NULL)
  → canonical URL fingerprint and duplicate matching
  → provenance/evidence records and verification state
  → canonical opportunities plus append-only change history
  → profile-based eligibility and deterministic ranking
  → dashboard and idempotent Telegram delivery
```

The source registry is seeded with three real official RSS/Atom feeds; no sample opportunities are inserted. A source must be explicitly curated and enabled before collection.

## Data ownership and access

- `opportunity_sources`, `opportunities`, `opportunity_source_records`, `opportunity_changes`, `collection_runs`, and `collection_run_sources` are shared server-managed Firestore collections.
- `opportunity_profiles` and `user_opportunity_tracking` are private user data. Server queries scope each record to the verified Firebase UID.
- Firestore client rules deny direct client access. Admin SDK operations bypass those rules, so every user-facing server operation must verify the Firebase session and enforce ownership.

## Unknown-value and provenance rules

- Optional fact columns remain `NULL` when no trustworthy evidence is available. `0` is distinct from an unknown entry fee; `FALSE` is distinct from an unknown benefit.
- `opportunity_source_records` preserves source identity, source URL, source type, verification status, and evidence payload. `opportunities.verified_fields` is restricted to known fact names and may only be set when field-level evidence supports the fact.
- `opportunity_changes` stores previous and new JSON values; the dashboard displays recorded changes. Automatic field-change writes are not yet wired into collection.
- `canonical_url_hash` is calculated from the normalized HTTPS URL by the discovery collector and is protected by a unique constraint.
- `user_opportunity_tracking` has one row per user/opportunity and supports `saved` or `applied`; an absent row means not saved.
- Collection execution and per-source results are stored independently so one failed source does not erase the run or other source results.

## Tables introduced

| Table | Purpose |
|---|---|
| `opportunity_sources` | Configurable source registry, method, category/domain coverage, throttling, health and reliability |
| `opportunities` | Canonical structured opportunity facts, dates, fees, benefits, verification and lifecycle |
| `opportunity_source_records` | Cross-source provenance/evidence links |
| `opportunity_changes` | Historical changes to important facts |
| `collection_runs` | Overall discovery run state and aggregate counts |
| `collection_run_sources` | Per-source result, counts and failure code |
| `opportunity_profiles` | Editable user eligibility/preferences data; nullable fields retain unknowns |
| `user_opportunity_tracking` | Per-user saved/applied state |
| `opportunity_alert_deliveries` | Private idempotency and status history reserved for opportunity alerts; no immediate-alert worker is active |

## Discovery implementation status

The RSS collector and authenticated `/api/cron/opportunities` handler are implemented. The handler requires the existing cron bearer secret and runs each enabled source independently, then refreshes lifecycle state using verified dates. RSS requests require HTTPS, reject redirects, have an 8-second timeout and 1 MiB response cap, and retry transient network/HTTP failures up to three attempts with exponential delay. Successful source timestamps enforce each registry entry's minimum interval.

The source-seed migration adds these official feeds:

- NASA Learning Resources — `https://www.nasa.gov/learning-resources/feed/`
- European Space Agency News — `https://www.esa.int/rss/news.en.rss`
- Innovate UK Activity — `https://www.gov.uk/government/organisations/innovate-uk.atom`

Only announcements with explicit application, competition, funding, or similar cues are retained as *unverified leads*. Source dates are not interpreted as opportunity deadlines; extracted facts remain unknown unless separately verified. Devpost was not added because its public RSS endpoint returned HTTP 403 during source validation; no access restriction is bypassed. No HTML scraping adapter or external paid API is included.

Per-source status and rejected-entry counts are persisted. Exact canonical URL fingerprints prevent repeat records; conservative title/organizer/deadline matching is available when reliable organizer data exists. The current feeds generally do not expose an organizer for each opportunity, so the pipeline does not guess one and cannot yet merge all cross-source near-duplicates.

## Eligibility, ranking, dashboard, and notifications

`src/lib/opportunities/intelligence.ts` contains a deterministic eligibility evaluator and explainable 0–100 scoring function. Profile contradictions are kept separate from missing profile/source facts; free-text experience restrictions remain unresolved rather than being guessed. A field must be in `verified_fields` before it can establish eligibility, add relevance points, or count as a documented benefit. Eligibility conflicts can be supplied separately from conflicting source evidence.

The score weights are eligibility match (25), technical/domain relevance (25), deadline feasibility (15), career pathway (15), documented benefits (10), and accessibility/cost (10). Relevance is also reported separately from deadline urgency, so urgency does not inflate the relevance ranking. Unknown or unverified fees, dates, benefits, and participation details earn no points and can produce warnings. The authenticated opportunity page reads through the server-side Firebase data client, ranks each candidate against the private profile, shows source URLs and score explanations, and supports search/category/verification/tracking filters. The profile page edits only the authenticated user's eligibility facts and daily opportunity-digest preference. Saved/applied actions are private to the owner.

The discovery cron does not push immediate opportunity alerts. The existing per-user daily Telegram digest can include up to three source-backed matches when the user has enabled the opportunity digest, the relevance score meets their threshold, and the eligibility evaluator returns `eligible` or `likely_eligible`. Opportunity-only digests are permitted when news retrieval succeeds with no fresh stories, and opportunity matches can still be sent when the news provider fails. Deadline and change-triggered messages are not implemented.

The reviewer queue at `/admin/opportunities` is restricted to authenticated Firebase accounts configured in `OPPORTUNITY_REVIEWER_EMAILS` or `OPPORTUNITY_REVIEWER_IDS`. Reviewers record one field at a time with an HTTPS citation and supporting excerpt. Only official evidence can set a fact as verified; third-party reports and conflicts are separately recorded. Team-size limits use `min,max`, with `none` meaning no restriction. The workflow can mark fields as partially verified but deliberately cannot declare an entire opportunity officially verified. No automated web verification is performed.

Two GitHub Actions workflows are checked in: opportunity discovery every six hours and due-digest dispatch every 15 minutes. They require repository secrets `APP_BASE_URL` and `CRON_SECRET`; a schedule is not active until these workflows are present on the default branch and enabled. GitHub scheduled events may be delayed or dropped, so these cadences are best-effort and do not provide real-time delivery.

The interface, profile persistence, reviewer queue, digest integration, and scheduler definitions pass local checks. They have not been integration-tested against a live Firebase project or Telegram bot. Firebase Auth, Firestore import, scheduled execution, and real Telegram sends are not claimed as verified.

## Historical SQL and Firebase data import

The SQL migrations are retained as the historical source schema and as input
for migrating existing Supabase rows. They are not a Firebase deployment
mechanism. The one-time import is documented in `FIREBASE_SETUP.md` and:

- maps `user_id` to the matching Firebase Auth UID by email;
- imports existing opportunity collections when they exist in Supabase;
- seeds the curated RSS source registry if the historical source table is not
  present;
- refuses to overwrite different Firestore documents or delete extra data.

Keep the Supabase source and its private credentials until the import and
production checks are complete. Do not reset or delete the source database as
part of the Firebase cutover.

## Scheduler constraint

The repository includes GitHub Actions definitions for six-hour discovery and 15-minute dispatcher polling. They are not active until present on the default branch and configured with the required secrets. Scheduled events are best-effort, not real-time. Collection and digest delivery remain separate routes; missed-run recovery must use persisted run/delivery state, not assume a scheduler invocation occurred on time.

## Validation status

The Supabase migrations have not been verified against a live production
database, and the Firebase data import has not run. See
`OPPORTUNITY_RADAR_TEST_REPORT.md` for historical repository checks and
`FIREBASE_SETUP.md` for current migration requirements. The source audit in
`OPPORTUNITY_RADAR_SOURCE_AUDIT.md` is a historical read-only snapshot; its
addendum records subsequent implementation changes.
