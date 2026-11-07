# Opportunity Radar — Source Audit

**Audit date:** 2026-11-06  
**Scope:** Read-only audit of the current repository and working-tree state, plus lint, type-check, and test execution. No application code, database schema, or deployment configuration was changed for this audit.

## Executive assessment

This repository is an existing Next.js personal news-digest application, not an Opportunity Radar implementation. It has useful foundations that should be preserved: Supabase authentication and PostgreSQL, row-level policies, configurable personal interests and digest timing, RSS ingestion, Telegram linking and delivery, delivery idempotency, and a small set of checks.

At the time of this audit, the product did **not** discover or manage opportunities. The addendum at the end records follow-up implementation and current validation boundaries.

Telegram is the active direction in code, but its production configuration and webhook registration are not documented. WhatsApp webhook verification exists, but messages are deliberately not processed; the separate WhatsApp command processor is not connected and is unsafe to enable as-is. The digest dispatcher has no checked-in schedule configuration, so no automated production cadence is established by this repository.

**Recommendation:** retain Supabase/PostgreSQL and the Next.js application. Extend the existing schema through additive migrations rather than migrating to Firestore. Use a free once-daily schedule only if the deployed Vercel plan and function usage are verified; this does not meet a more frequent discovery cadence. Keep the product honest about that limit rather than implying real-time monitoring.

## Audit method and working-tree boundary

- Read the repository instructions, README, project specification/state/roadmap, environment-variable names, source files, migrations, tests, and deployment-related tracked files.
- Did not read `.env.local` or any secret values. The audit records only environment-variable names declared by `.env.example` or referenced in source.
- The working tree was already dirty before the audit: `next-env.d.ts`, `src/lib/ai/adapter.ts`, and `src/lib/news/delivery.ts` were modified; `src/lib/news/language.ts` and `src/lib/news/localization.ts` were untracked. Those changes were treated as existing user work and left untouched.
- The repository instructions and `docs/PROJECT_STATE.md` prohibit accessing `C:\Dev\IgrisClean`; it was not accessed.
- No remote database, Telegram bot, WhatsApp account, or deployment was contacted. Static code evidence does not establish that any live integration works.

## Actual architecture

```text
Browser
  └─ Next.js App Router (server components, server actions, route handlers)
       ├─ Supabase SSR client: cookie-backed user authentication and RLS queries
       ├─ Supabase admin client: service-key access for scheduled delivery/linking
       ├─ RSS provider → deterministic topic matching → digest formatting
       ├─ Optional OpenAI Responses API localization
       ├─ Telegram Bot API delivery and link webhook
       └─ WhatsApp Cloud API/webhook code (incomplete)

Supabase Auth + PostgreSQL/RLS
  └─ personal settings, interests, delivery records, channels, link tokens,
     inbound-message and confirmation tables
```

The application is a single Next.js deployment; there is no separate worker, queue, or background service. Supabase is used both for authentication and relational persistence. Server-side elevated access is created with `SUPABASE_SECRET_KEY`; user-facing pages use the publishable key and authenticated RLS.

## Directory map

| Path | Observed responsibility |
|---|---|
| `src/app/` | App Router pages, server actions, and API route handlers |
| `src/app/api/cron/` | Legacy single-owner digest route and newer multi-user dispatcher |
| `src/app/api/telegram/` | Telegram link-code, status, disconnect, test, and webhook handlers |
| `src/app/api/whatsapp/` | WhatsApp webhook verification and inbound payload validation |
| `src/components/` | Navigation and small form controls |
| `src/lib/news/` | RSS retrieval, keyword ranking, digest construction, scheduling helpers, localization |
| `src/lib/ai/` | Optional OpenAI-backed localization and deterministic truncation fallback |
| `src/lib/supabase/` | Browser, server, proxy, and elevated Supabase client factories |
| `src/lib/telegram/`, `src/lib/whatsapp/` | Provider clients and legacy command parser |
| `src/lib/schema/`, `src/lib/utils/` | Zod settings validation and phone encryption/hash helpers |
| `supabase/migrations/` | Four additive SQL migrations |
| `test/` | Unit, integration/security-boundary, and security regression tests |
| `docs/` | Existing specification, project state, roadmap, and setup/security notes |

At the time of this historical audit, no checked-in `vercel.json`, `.github/workflows/` schedule, Prisma schema, or Firebase configuration was found.

## Existing functionality inventory

### Confirmed in source

- Login uses Supabase password authentication. Protected application pages are redirected through `src/proxy.ts` and `src/lib/supabase/proxy.ts`; server actions and the Telegram user endpoints also check authenticated claims.
- User settings include language, interests/custom keywords, timezone, digest time, story limit, digest enablement, and optional phone data.
- Four RSS feeds are hard-coded: TechCrunch, The Guardian Technology, The Guardian Science, and NASA JPL. Fetches are sequential, each has an 8-second abort timer, HTTP failures are isolated, response text has a 1 MiB check, and entries require an HTTPS link.
- RSS selection uses keyword matches in title/description. Duplicate handling hashes the raw URL and suppresses recently sent hashes; it does not canonicalize URLs or compare title/organizer/deadline similarity.
- Digest schedule helpers calculate local time and an occurrence key. The newer multi-user delivery flow stores delivery attempts and prevents duplicate occurrence inserts with a unique database index.
- Telegram linking uses short-lived random codes, stores only a hash, and claims a code through an atomic PostgreSQL function. Per-user channel rows are protected by RLS and a unique Telegram chat index.
- Telegram sends are made from server code with the bot token. The multi-user dispatcher looks up active linked chats and runs user deliveries sequentially.
- The Meta webhook checks a request signature, body size, business phone ID, and configured owner number. Its source explicitly returns `processed: false`; it does not execute commands.
- Optional localization can call OpenAI. It uses `store: false`, validates the output shape, and falls back to original text on localization errors. It requires an API key and is not a zero-cost guarantee.
- `.env.example` declares Supabase, cron, WhatsApp, optional news API, optional AI, and phone-encryption variables. It does **not** document the Telegram bot token or Telegram webhook secret used by code.

### Incomplete or unverified

- Live Supabase, Meta, Telegram, Vercel, and external API credentials/configuration were not verified. Existing project notes also label live integrations as blocked.
- No scheduled deployment invocation is configured in the repository. Both cron route handlers require `CRON_SECRET`; a URL handler existing does not mean it runs automatically.
- The legacy `/api/cron/daily-news` path and `/api/cron/dispatcher` both implement digest delivery. The former still depends on a global Telegram chat ID; the latter is the per-user path. This is overlapping business logic that should be consolidated.
- `NEWS_API_KEY` and `NEWS_API_BASE_URL` are documented but not used by the inspected provider path.
- `NEWS_PROVIDER_MODE=mock` returns fabricated example content. It must not be used for production data or presented as a real opportunity/news source.
- `src/lib/whatsapp/commands.ts` is not called by the webhook. If wired in its current form, it selects the first settings row globally rather than matching the sender to an owner; several database errors are ignored, and the confirmation branch does not validate or apply the pending operation. Do not enable it without redesign and tests.
- WhatsApp send code has a mock mode, but neither a usable WhatsApp command workflow nor complete WhatsApp notification preference management is implemented.
- Telegram bot linking and send code are present, but no setup documentation explains the required bot token, webhook secret, webhook registration, or production callback configuration.
- The delivery history page and digest settings pages are real, but the live digest preview explicitly says it is not connected to the dispatch pipeline.
- No source-health view, source run history, retry dashboard, or recovery controls are present.
- Supabase local config references `./seed.sql`, which is not present in the tracked repository; local database reset/seed behavior should be checked before relying on it.

## Existing database model and migration assessment

The four migrations create or extend:

- `personal_settings` — one settings row per auth user, including optional encrypted phone, location fields, language, timezone, delivery time, and digest preferences.
- `personal_interests` — per-user topic rows.
- `sent_article_hashes` — sent URL/title hashes.
- `deliveries` — per-user delivery status, legacy local date, occurrence time, idempotency key, attempts, and provider message ID.
- `inbound_messages` and `pending_confirmations` — intended WhatsApp command/replay/confirmation support.
- `profiles`, `user_channels`, and `telegram_link_tokens` — profile shell, channel association, and short-lived Telegram linking.
- `claim_telegram_link(...)` — service-role-only, security-definer function that atomically consumes a Telegram code.

RLS is enabled on these tables. Initial per-user tables have owner policies; profiles are readable/updatable by their owner; channels are owner-readable and server-managed; link tokens intentionally have no authenticated CRUD policy. Service-role paths bypass those policies and therefore need to retain explicit user scoping.

Migrations are additive and preserve existing delivery history. The delivery occurrence migration backfills legacy idempotency keys and drops the former one-delivery-per-day uniqueness constraint. No opportunity tables or opportunity-related migrations exist. Migration application status was not queried because that would require connecting to a database.

The account model is not strictly single-owner in source: any authenticated Supabase user can own their own settings under RLS, and the newer channel/link design is multi-user. The README's single-owner description and the legacy cron route's one-owner assumption are therefore out of sync with the current schema/code. Public signup is not implemented in the app, but disabling it is only a dashboard/setup instruction, not an application-enforced rule.

## WhatsApp and Telegram findings

| Channel | Current state |
|---|---|
| Telegram | Primary path in recent code. Link flow, status/disconnect endpoints, authenticated test message, webhook secret check, Telegram Bot API client, and per-user dispatcher exist. Production readiness is unverified: required variables are missing from `.env.example`, webhook registration and scheduler configuration are absent, and no Telegram route tests cover successful linking or delivery. |
| WhatsApp | Legacy client, signature-checked webhook, command module, phone encryption, and related tables exist. The webhook intentionally does not process messages; the command module is disconnected and unsafe to wire as-is. Do not describe the WhatsApp commands as working. |

## Existing tests and executed checks

Executed against the current working tree:

| Check | Result |
|---|---|
| `npm run lint` | Passed |
| `npm run typecheck` | Passed |
| `npm test -- --runInBand` | Passed: 3 suites, 10 tests |
| Production build | Not run. `next-env.d.ts` already has an uncommitted change to its generated route-types import; a build can regenerate that tracked file, so it was skipped to protect pre-existing work. |
| Database migration/live integration checks | Not run; no database or provider connectivity was established. |

Coverage is narrow. Existing tests exercise settings validation, phone crypto round-trip, simple story filtering, missing/invalid cron credentials, and a missing/invalid Meta signature. `test/security.test.ts` contains a placeholder assertion (`expect(true).toBe(true)`) for the RSS URL behavior; it does not validate that behavior. There are no tests for the multi-user dispatcher, real webhook signature success, RLS isolation, Telegram linking, localization, retries, or dashboard operations.

## Security and reliability findings

1. **High — dormant WhatsApp command processor lacks sender-to-account authorization.** `src/lib/whatsapp/commands.ts` loads all settings and chooses the first row, and its confirmation handler does not consume/verify a matching confirmation. It is not currently called by the webhook, so this is a latent unsafe path rather than an observed reachable webhook exploit. Keep it disconnected until authorization and atomic confirmation are implemented.
2. **Medium — phone encryption is unauthenticated CBC.** `src/lib/utils/crypto.ts` uses AES-256-CBC without an authentication tag. This does not provide ciphertext integrity. Replace with an authenticated mode such as AES-GCM as a planned, data-preserving migration; do not silently invalidate existing encrypted values.
3. **Medium — integrity and replay coverage is uneven.** Telegram account linking is atomic and code consumption is idempotent, but the webhook does not persist or deduplicate general update IDs. WhatsApp replay protection is described in documentation/state, yet the current webhook does not process messages or persist inbound IDs.
4. **Medium — elevated database operations require careful scoping.** The admin client bypasses RLS. The current dispatcher explicitly scopes per-user operations, but any future admin-backed endpoint must independently bind every read/write to the authenticated user or a validated system task.
5. **Low/Medium — webhook and API abuse controls are incomplete.** WhatsApp has a body-size limit and signature check; Telegram uses its configured secret header. No general application rate limiter or failed-delivery recovery UI was found. The Telegram callback depends on the secret token being configured and registered outside the repo.
6. **Low — settings accept a free-form timezone string.** The settings schema bounds its length but does not check whether `Intl` recognizes it; the dispatcher catches invalid schedule calculation later, after the bad value has been saved.
7. **Privacy/configuration note — optional AI sends selected story text to OpenAI when enabled.** This is external disclosure and may incur costs; leave disabled unless the user explicitly configures and accepts it. The rest of the core product should work without it.

No secret values were read or copied into this report. A dependency vulnerability scan was not run; package manifests include several `"latest"` version declarations, while the lockfile pins the resolved install. Continue using lockfile-based installs and perform a deliberate, reviewed dependency audit before release.

## Functionality to preserve, modify, and add

**Preserve**

- Next.js App Router, Supabase auth/session integration, existing PostgreSQL data, owner-scoped RLS, time-zone helpers, Telegram account-link mechanism, delivery idempotency history, honest empty-state patterns, and the optional AI boundary.

**Modify**

- Reconcile the single-owner README/state with the multi-user schema and define the intended account boundary.
- Consolidate scheduled delivery into one implementation; remove the global-chat legacy route only after compatibility and deployment references are verified.
- Replace hard-coded news feeds and news-only matching with a registry and opportunity adapters. Keep RSS as a transport, not as the product model.
- Replace the unsafe, unused WhatsApp processor or explicitly retain WhatsApp as an inert legacy integration.
- Harden phone encryption with a migration plan; validate IANA timezones before persistence.
- Add Telegram configuration and deployment steps without ever documenting real token values.

**Add**

- Opportunity and source/provenance data model; source registry and collection-run records.
- Normalization, canonical URL handling, duplicate review, official-source verification, conflict and deadline-change history.
- Editable technical/career profile, deterministic eligibility classification, and explainable 0–100 opportunity scoring.
- Personal save/apply tracking and opportunity browse/detail/filter experiences.
- User-specific digest and alert preferences, deduplication/retry recovery, and a source-health view.
- Tests for parsing, missing/unknown facts, cross-source duplicates, eligibility, scoring, timezone scheduling, authorization, retries, and notification idempotency.

## Database decision: retain Supabase/PostgreSQL

The existing application already uses Supabase Auth, Postgres, RLS, migrations, and relational queries joining settings, interests, channels, and deliveries. The opportunity requirements add provenance, source associations, lifecycle history, and per-user tracking—relational data with uniqueness constraints and transactional state transitions. Firestore is viable in isolation, but a migration would replace established auth/session/data access, rewrite queries and policies, migrate users and delivery history, and lose the benefit of the existing SQL migration path. No evidence shows that Firebase materially improves this workload enough to justify that risk.

Current official pricing information checked on **2026-11-06**:

- Supabase Free lists a 500 MB database, 5 GB egress, and free projects pausing after one week of inactivity. This is sufficient to prototype and likely adequate for one small user's records, with the inactivity pause and lack of paid support documented as operational limitations: [Supabase pricing](https://supabase.com/pricing).
- Firebase Spark currently lists Firestore no-cost limits (1 GiB stored, 50K reads/day, 20K writes/day, 10 GiB/month egress) and no payment method requirement. Firebase Cloud Functions are unavailable on Spark in the pricing comparison, so Firebase would not provide a complete free scheduled-worker replacement: [Firebase pricing](https://firebase.google.com/pricing).
- **Decision:** retain Supabase; do not introduce a second database. Use additive migrations and verify every new table's RLS and service-role access.

## Free-tier and scheduling feasibility

- The current source uses Vercel-oriented deployment assumptions but contains no cron schedule configuration. The cron routes are only callable handlers; they do not schedule themselves.
- Vercel's official Cron Jobs usage page (updated 2026-07-15) lists Hobby as once per day with up to ±59 minutes of timing variance, and says function usage/pricing limits still apply: [Vercel Cron Jobs usage and pricing](https://vercel.com/docs/schedules/cron-jobs/usage-and-pricing). This is compatible with a best-effort daily digest, not frequent discovery or deadline-critical real-time alerts.
- GitHub Actions is a possible alternative worker trigger, but repository visibility, included runner allowance, schedule delays, and deployment secrets have not been established here. GitHub's billing documentation confirms that private-repository hosted-runner usage draws from included usage and may be billed after it is exhausted; public standard runners are free: [GitHub Actions billing](https://docs.github.com/en/billing/concepts/product-billing/github-actions). Do not promise this as ₹0 until repository visibility and account limits are verified.
- RSS collection itself does not require a paid API, but feed availability and terms can change. Meta WhatsApp and OpenAI use are not required for the recommended Telegram-first product; enabling paid API paths could violate the ₹0 constraint.
- **Safe initial cadence:** at most one best-effort scheduled collection/digest per day on verified Vercel Hobby, with missed-run recovery and no real-time promise. If the product requires more frequent discovery, scheduler choice is a release blocker until a genuinely zero-cost execution path is verified.

## Recommended target architecture

```text
Versioned source registry
  → scheduled, authenticated Next.js worker
  → isolated source adapters and run records
  → extraction/normalization with unknowns preserved
  → canonicalization, duplicate matching, provenance
  → official-source verification and change history
  → Supabase/PostgreSQL opportunity records (RLS)
  → deterministic eligibility and explainable ranking
  → dashboard and per-user Telegram digest/alerts
```

Keep deterministic rules for deadlines, matching, scoring, and notification idempotency. Optional AI may assist classification or summarization only when its output is tied to evidence and validated; it must not be needed to operate the system. Keep errors observable at the source/run and delivery level, and do not convert failures into successful empty results.

## Risks, dependencies, and stage roadmap

1. **Stage 1 — data foundation:** document the account boundary; retain Supabase; design additive opportunity, source, provenance/change, profile, and user-tracking tables; review RLS and rollback/data-preservation before migration.
2. **Stage 2 — discovery:** implement a registry, independent adapters, bounded fetches, run logs, normalization, canonical URLs, provenance, and safe duplicate handling. Begin with a small, explicitly curated set of official opportunity sources.
3. **Stage 3 — intelligence:** implement unknown-safe eligibility, deterministic scoring components, deadline/lifecycle states, and tests.
4. **Stage 4 — notifications:** document/configure Telegram token and webhook secret via deployment secrets; consolidate dispatcher; add digest/alert settings and recoverable idempotent delivery states.
5. **Stage 5 — dashboard:** replace news-only pages with opportunity overview, search/filter, detail/evidence, save/apply, profile, notification settings, and honest source health.
6. **Stage 6 — production readiness:** verify the chosen free scheduler and deployment, run the production build and database checks, execute security/data-isolation tests, and document operational limits.

Before any migration is applied, confirm it against a disposable/local database and preserve production data. Scheduler cadence beyond once daily, public-vs-private account access, Telegram bot configuration, and any paid AI/API use must be explicit deployment decisions.

## Audit conclusion

The repository was a useful private digest foundation at audit time, but the audit predates the Opportunity Radar implementation described below. It must not be used as evidence that the current feature is production-ready.

## Follow-up implementation addendum

The working tree was subsequently extended with additive opportunity migrations, curated RSS discovery, a reviewer-allowlisted field-evidence workflow, profile-based eligibility and scoring, dashboard/save/apply flows, lifecycle refresh, daily Telegram digest integration, and GitHub Actions schedule definitions. The current validation boundaries and known blockers are recorded in `OPPORTUNITY_RADAR_IMPLEMENTATION_STATUS.md` and `OPPORTUNITY_RADAR_TEST_REPORT.md`.

The new migrations remain unapplied. Docker was unavailable for local Supabase validation, and no live database, Telegram bot, scheduler run, or production deployment was tested. The new implementation has unit/static checks only and must not be described as production-ready.
