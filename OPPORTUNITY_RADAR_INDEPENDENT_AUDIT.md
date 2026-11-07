# Opportunity Radar — Independent Product Maturity Audit

**Audit date:** 2026-11-07, 19:15–19:30 IST (14:00 UTC)
**Auditor role:** Independent architecture, product, QA, security and production-readiness review.
**Method:** Read-only inspection of the workspace, read-only production/database checks, official feed fetches, Telegram health checks, GitHub/Vercel metadata, and execution of existing checks. No source, configuration, schema or deployment changes were made. No messages were sent.

---

## A. Executive verdict

### **PARTIALLY FUNCTIONAL PROTOTYPE**

The application is not a product-ready platform, and it is not yet a functional MVP for opportunity discovery.

What genuinely works:

- Firebase Authentication email/password sign-in and server session creation work live.
- Firestore is genuinely connected through the Admin SDK; a read-only check succeeded.
- The Next.js application is deployed and reachable; authenticated dashboard, opportunities and profile pages return `200`.
- The opportunity data model, taxonomy, classification, filtering, scoring, eligibility and manual-verification code exist and are unit-tested.
- Two official research/funding RSS/Atom feeds are reachable and return items that match the discovery cue filter.

What prevents it from being an MVP:

- Firestore contains **zero opportunities, zero sources, zero source records, zero collection runs, zero profiles and zero tracking records**. The only collection in the database is `personal_settings`.
- Opportunity discovery has **never run** in production. GitHub Actions has **zero runs** and **zero repository secrets**.
- Eight of the nine required categories have **no source at all**.
- The discovery extractor only captures title, description and URL. It does not extract dates, fees, eligibility, organizer, company, institution or application URLs; those facts require manual review.
- The manual-review screen is **blocked in production** (no reviewer IDs/emails configured) and will crash once a lead exists because `first_discovered_at` is never written.
- The deployed UI therefore shows empty views and zero counts. No user can currently discover, evaluate or participate in an opportunity through this product.

---

## B. Product scope verdict

The motto is **Discover. Compete. Innovate. Build. Grow.**

The actual product currently delivers:

- A credible **UI shell** for discovery, filtering, saved/applied views and eligibility profiling.
- A **lead-collection pipeline** for two research/funding feeds, never executed.
- A **manual verification design**, currently inaccessible and incomplete.
- A **single-user news/Telegram application** that predates Opportunity Radar and still dominates the README and runtime surface.

It does **not** deliver all nine opportunity categories in any operational sense. Category names exist in the schema, the classifier and the UI tabs, but names in enums, tabs and prompts are not coverage. No hackathon, ideathon, innovation-challenge, competition, event, internship, job or startup source is configured. No category has a live opportunity record.

**Scope coverage: 0 of 9 categories live. 1 of 9 has code-level source coverage and has never run. 8 of 9 are model/UI only.**

---

## C. Category coverage matrix

| Category | Data model | Sources | Discovery | Extraction | Verification | Eligibility | Dashboard | Notifications | Verdict |
|---|---|---|---|---|---|---|---|---|---|
| **Hackathons** | Yes: `category`, `subcategory`, taxonomy, classifier (`taxonomy.ts`) | **None** | Generic RSS collector only; no hackathon source | Title/description/URL only | Manual workflow exists; blocked | Generic model; no records | Tab + filter; 0 records | Digest code exists; no data/profile/channel | **PARTIALLY IMPLEMENTED** (model/UI only) |
| **Ideathons** | Yes | **None** | Generic RSS only | Title/description/URL only | Manual; blocked | Generic; no records | Tab; 0 records | Code exists; no data | **PARTIALLY IMPLEMENTED** (model/UI only) |
| **Innovation Challenges** | Yes | **None** | Generic RSS only | Title/description/URL only | Manual; blocked | Generic; no records | Tab; 0 records | Code exists; no data | **PARTIALLY IMPLEMENTED** (model/UI only) |
| **Technical Competitions** | Yes | **None** | Generic RSS only | Title/description/URL only | Manual; blocked | Generic; no records | Tab; 0 records | Code exists; no data | **PARTIALLY IMPLEMENTED** (model/UI only) |
| **Technical Events** | Yes | **None** | Generic RSS only | Title/description/URL only | Manual; blocked | Generic; no records | Tab; 0 records | Code exists; no data | **PARTIALLY IMPLEMENTED** (model/UI only) |
| **Internships** | Yes | **None** | Generic RSS only | Title/description/URL only | Manual; blocked | Generic; no records | Tab; 0 records | Code exists; no data | **PARTIALLY IMPLEMENTED** (model/UI only) |
| **Jobs & Recruitment** | Yes | **None** | Generic RSS only | Title/description/URL only | Manual; blocked | Generic; no records | Tab; 0 records | Code exists; no data | **PARTIALLY IMPLEMENTED** (model/UI only) |
| **Research Opportunities** | Yes | 2 reviewed feeds in code (NASA, Innovate UK); **0 in Firestore**; ESA removed (404) | Generic RSS collector; never executed | Title/description/URL only | Manual; blocked | Generic; no records | Tab; 0 records | Code exists; no data/profile/channel | **IMPLEMENTED BUT NOT LIVE-VERIFIED** |
| **Startup & Entrepreneurship** | Yes | **None** | Generic RSS only | Title/description/URL only | Manual; blocked | Generic; no records | Tab; 0 records | Code exists; no data | **PARTIALLY IMPLEMENTED** (model/UI only) |

Evidence:

- Categories and subcategories: `src/lib/opportunities/taxonomy.ts`.
- Source defaults: `src/lib/opportunities/sources.ts` (`DEFAULT_OPPORTUNITY_SOURCES` contains only NASA and Innovate UK).
- Classification: `classifyOpportunity()` in the same taxonomy module.
- Discovery chain: `src/lib/opportunities/discovery.ts`, `rss.ts`.
- UI tabs/views: `src/app/opportunities/OpportunityList.tsx`.
- Dashboard counts: `src/app/dashboard/page.tsx`.
- Digest inclusion: `src/lib/opportunities/notifications.ts`, `src/lib/news/delivery.ts`.

No source-specific discovery exists for eight categories. The generic collector can retain arbitrary RSS items if they contain opportunity cues, but no such feeds are configured.

---

## D. Architecture reality

| Layer | Actual implementation |
|---|---|
| Frontend | Next.js **16.2.12** App Router, React, TypeScript, Tailwind CSS 4. `package.json`. |
| Backend | Next.js server components, Server Actions (`src/app/**/actions.ts`) and route handlers under `src/app/api/**`. No separate service. |
| Database | **Cloud Firestore**, accessed through a custom Supabase-style adapter in `src/lib/firebase/store.ts` using `firebase-admin`. |
| Authentication | **Firebase Authentication** email/password. Client SDK signs in, posts ID token to `/api/auth/session`, server creates a 5-day HttpOnly `__session` cookie (`src/app/api/auth/session/route.ts`). Pages verify the cookie with Firebase Admin (`src/lib/firebase/server.ts`). |
| Notification | **Telegram Bot API**. Bot token, webhook and per-user `user_channels` design. WhatsApp route remains as legacy code but is not the active product channel. |
| Scheduler | **GitHub Actions only**: `.github/workflows/opportunity-discovery.yml` (every 6 hours) and `.github/workflows/daily-digest-dispatcher.yml` (every 15 minutes). No `vercel.json`, therefore no Vercel Cron. |
| Hosting | **Vercel**, project `pawsansai/daily-whatsapp-news-3d5j`, production aliases include `https://daily-whatsapp-news-3d5j.vercel.app`, functions in `iad1`. |
| Firebase integration | Genuinely integrated server-side. Production has `FIREBASE_ADMIN_SERVICE_ACCOUNT_JSON`; client sign-in succeeded; Admin SDK read queries succeeded. Firestore client rules deny all direct access (`firestore.rules`). |
| Firebase client configuration | Production does **not** define `NEXT_PUBLIC_FIREBASE_*`; the app silently falls back to hardcoded project config in `src/lib/firebase/config.ts`. It works, but environment drift is invisible. |
| Supabase | **Not active at runtime.** No `supabase` references under `src/`. Supabase migrations, `supabase/config.toml`, `@supabase/supabase-js` and the one-time migration script remain as legacy/import assets. The import has not been run. |
| Scheduled jobs | Workflows are active in GitHub, but have **never run** and the repository has **no Actions secrets**. |
| Function duration | No `maxDuration` export or configuration. Discovery is sequential and can perform multiple 8-second fetches plus retries and Firestore writes. |

Firestore live state (read-only, Admin SDK):

```
COLLECTIONS=personal_settings
opportunities=0
opportunity_sources=0
collection_runs=0
collection_run_sources=0
opportunity_source_records=0
opportunity_field_evidence=0
opportunity_changes=0
opportunity_profiles=0
user_opportunity_tracking=0
personal_settings=1
user_channels=0
deliveries=0
AUTH_USERS_SAMPLE_COUNT=1 (no additional page)
```

Because empty Firestore collections do not exist, `personal_settings` is the only collection physically present.

---

## E. Live verification results

All checks were read-only. No data was written; no Telegram message was sent.

| Check | How | Result | Evidence / limitation |
|---|---|---|---|
| Production homepage | `GET /` | **200** | Vercel `Server: Vercel`, cache HIT. |
| Login page | `GET /login` | **200** | Public page renders. |
| Unauthenticated protected routes | `GET /dashboard`, `/opportunities`, `/admin/opportunities` | **307 → `/login`** | Middleware `src/proxy.ts` checks only cookie presence; pages also verify the session. |
| Owner sign-in | Firebase REST sign-in, then `POST /api/auth/session` | **200, session cookie set** | Auth service and Admin session creation work. No credential is reproduced here. |
| Authenticated dashboard | `GET /dashboard` with session | **200, 24,644 bytes** | Renders Opportunity Radar summary, digest status, Telegram status. |
| Authenticated opportunities | `GET /opportunities` | **200, 19,880 bytes** | Renders view tabs, category tabs, filters and the empty state “No verified opportunity leads yet.” |
| Authenticated recommended view | `GET /opportunities?view=recommended` | **200, 19,957 bytes** | Same empty state. |
| Authenticated profile | `GET /settings/opportunities` | **200, 20,170 bytes** | Renders the eligibility form. Save was **not tested** (no production writes). |
| Reviewer page | `GET /admin/opportunities` with session | **307 → `/dashboard`** | Production has no `OPPORTUNITY_REVIEWER_IDS` or `OPPORTUNITY_REVIEWER_EMAILS`. |
| Unauthenticated opportunity cron | `GET /api/cron/opportunities` | **401** | `INVALID_CRON_CREDENTIAL`; secret guard works. Discovery was **not executed** (would write production data). |
| Unauthenticated dispatcher cron | `GET /api/cron/dispatcher` | **401** | Secret guard works; no digest run. |
| Cross-origin session POST | `Origin: https://evil.example` | **403** | Same-origin check works. |
| Telegram bot identity | Bot API `getMe` | **200, ok=true** | Bot `@daily_intelligence_news_bot` is valid. Delivery not tested. |
| Telegram webhook | Bot API `getWebhookInfo` | **200, ok=true** | Webhook points to production `/api/telegram/webhook`; pending updates `0`; no last error. |
| GitHub Actions | `gh run list`, `gh secret list`, `gh workflow list` | Workflows **active**; **0 runs**; **0 secrets** | Both workflows can only fail configuration validation if dispatched. |
| Vercel deployment | `vercel ls`, `vercel inspect` | Latest Production **Ready**, created **19:03 IST**, aliases active | No Git commit metadata was displayed by `inspect`; deployment came from the local/CLI build, not a verified Git pipeline. |
| Firestore read connectivity | Admin SDK read-only counts | **Success** | Data state listed above. |
| NASA feed | `fetch` with the collector’s headers and `redirect: "error"` | **HTTP 200**, 10 items, **2** titles match the opportunity cue | Feed is reachable. Extraction/persistence not run. |
| Innovate UK feed | Same | **HTTP 200**, 20 items, **3** titles match the opportunity cue | Feed is reachable. Extraction/persistence not run. |
| Lint | `npm run lint` | **exit 0** | Clean. |
| TypeScript | `npm run typecheck` | **exit 0** | Clean. |
| Tests | `npx jest --runInBand` | **10 suites, 50 tests, pass** | All are unit/mocked tests; no Firestore emulator, browser or live-delivery test. |
| Production build | `npm run build` | **exit 0** | Compiled successfully. |
| Real opportunity extraction | Not run | **NOT TESTED** | Audit rules prohibit production writes; a dry-run mode does not exist. |
| Save/apply tracking | Not run | **NOT TESTED** | No opportunity exists and production writes are prohibited. |
| Manual verification | Not run | **NOT TESTED / BLOCKED** | Reviewer page redirects; no reviewer configuration; page has a data-shape crash risk. |
| Telegram delivery | Not run | **NOT TESTED** | Audit prohibits sending real messages; no linked channel exists. |

---

## F. Feature-by-feature status

### Working and verified

- Firebase email/password sign-in and server session creation.
- Session-protected routing and page-level session verification.
- Firestore server connectivity and deny-all client rules.
- Cron endpoint secret rejection.
- Session same-origin rejection.
- Production deployment reachability.
- Telegram bot token validity and webhook registration.
- Taxonomy classification, browse filters/views, eligibility and scoring unit behaviour.
- Lint, typecheck, tests, production build.

### Implemented but not live-verified

- RSS/Atom fetching, cue filtering, URL canonicalization, duplicate heuristics and source isolation (unit-tested, feeds reachable, discovery never run).
- Firestore persistence of opportunities, provenance, source health and collection runs (code exists, no records).
- Manual evidence capture and field-level verification (code and parser tests exist, page is inaccessible).
- Eligibility profile persistence (page renders, no saved profile).
- Saved/applied tracking (actions exist, no opportunity to track).
- Opportunity inclusion in the Telegram digest (code and digest tests exist, no verified records or linked channel).
- Daily digest dispatcher and per-user timezone logic (code exists, scheduler has never run).

### Partially implemented

- Opportunity detail: **no detail route**. Cards are inline; there is no `/opportunities/[id]` page.
- Dashboard: counts and links only. No latest/recommended/today-tomorrow lists; the requirement for “Closing today / tomorrow” is not separately implemented.
- Profile: education, branch, graduation year, country, team size, preference, skills, domains and budget exist. **Projects, experience, certifications, current status and travel availability are missing.**
- Source management: no operator UI; sources can only be seeded from code or edited directly in Firestore.
- Source health: failure counters and timestamps are written; there is no source-health screen.
- Search: client-side substring search only; no server-side search or pagination.
- Opportunities API: none. The feature is server-rendered pages plus Server Actions.

### UI only / placeholder

- Eight of nine category tabs: they have no category-specific source, no records and no category-specific ingestion.
- Dashboard opportunity summary with all counts at zero.
- “Verified”, “Recommended”, “Closing Soon”, “Upcoming”, “Saved”, “Applied” and “Expired” views render, but there is no data to populate them.
- “Official application page” button only appears if `official_application_url` is verified; discovery never extracts it.

### Not implemented

- Automated fact extraction for dates, fees, eligibility, organizer/company/institution, benefits or application URLs.
- Automatic cross-source duplicate detection that works in practice (see below).
- Opportunity detail pages.
- Public/read API for opportunities.
- Source health dashboard.
- Category-specific source coverage for hackathons, ideathons, innovation challenges, competitions, events, internships, jobs and startups.
- Owner allowlist.
- Saved-search or per-category alert preferences.
- Automatic cancellation/postponement detection.

### Blocked

- Live opportunity discovery: no sources in Firestore, no scheduler run, and audit rules prohibit writing production data.
- Manual verification: reviewer configuration absent; review page redirects; page may crash on missing `first_discovered_at`.
- Telegram delivery: no `user_channels` rows and no authorized delivery test.
- End-to-end save/apply: no opportunities.

---

## G. Security and reliability findings

### HIGH — No owner allowlist in the authentication path

`POST /api/auth/session` verifies any valid Firebase ID token and creates a session (`src/app/api/auth/session/route.ts`). `src/proxy.ts` and page guards only check that a session exists. `OWNER_EMAIL` is present in environment configuration but is **not referenced anywhere in `src/`**.

Currently Firebase has only **1** user, so exposure is limited. If email/password sign-up is enabled in the Firebase project, any new account could obtain a session and access the owner's dashboard, settings, profile and tracking. Sign-up enablement was **not tested** because creating a user would write production data.

**Required:** allowlist the owner UID/email in session creation and in a shared authorization helper; reject all other accounts. Verify Firebase sign-up is disabled.

### HIGH — Reviewer authorization is inconsistent and absent in production

- The reviewer page accepts either `OPPORTUNITY_REVIEWER_IDS` or `OPPORTUNITY_REVIEWER_EMAILS` (`src/app/admin/opportunities/page.tsx`).
- The review Server Action checks **only** `OPPORTUNITY_REVIEWER_IDS` (`src/app/admin/opportunities/actions.ts`). An email-only allowlist would render the page but reject the submit.
- Production has neither variable. The live check returned `307 → /dashboard`.
- No human can verify a fact in production. Because discovery persists records as `pending_verification` and digest inclusion requires verified status plus an official source record, verification is a hard dependency for every downstream feature.

### HIGH — Reviewer page crashes when `first_discovered_at` is missing

Discovery inserts opportunities without `first_discovered_at` (`src/lib/opportunities/discovery.ts`). The reviewer page renders:

```ts
new Date(opportunity.first_discovered_at).toISOString()
```

(`src/app/admin/opportunities/page.tsx`). With the field absent, `new Date(undefined)` is invalid and `.toISOString()` throws `RangeError`. The Supabase migration gave this column a database default, but Firestore applies no such default. As soon as discovery creates a lead, the reviewer queue is likely to return a server error instead of a queue.

**Required:** write `first_discovered_at` at discovery time and make the renderer tolerate missing/invalid dates.

### HIGH — Discovery and verification are not operationally connected

- Discovery has never run and the source registry is empty.
- Even if it runs, every lead is `pending_verification` with no extracted facts.
- Verification is inaccessible and crash-prone.
- Digest inclusion requires `officially_verified`, `official_source_partial` or `partially_verified`, plus an official source record.
- The lifecycle refresh only advances when deadlines are **verified**; discovered leads have no verified deadlines, so they remain `unknown`.

The end-to-end chain is therefore broken at three consecutive points.

### MEDIUM — Deduplication is ineffective for RSS leads

`isLikelySameOpportunity()` requires both records to have a non-null organizer and matching organizer text. `entryToCandidate()` never sets `organizer`; RSS entries provide only title, description, URL and publication date. Cross-source duplicates with different URLs will therefore not be merged; only exact canonical-URL matches deduplicate.

### MEDIUM — The Firestore adapter loads whole collections and filters client-side

`FirestoreQuery.matchingDocuments()` in `src/lib/firebase/store.ts` fetches the collection (with at most one Firestore-side equality/`in` filter), then applies all remaining filters, sorting and limits in memory. The opportunities page also issues two `.in("opportunity_id", ids)` queries that can read large result sets. There are no indexes or pagination. This is acceptable at prototype scale but will become slow and costlier as data grows, and it makes `.limit()` misleading.

### MEDIUM — No discovery concurrency lock

A discovery run creates a `collection_runs` record but does not acquire a mutual-exclusion lock. A manually dispatched run can overlap the scheduled run, creating duplicate opportunity attempts and conflicting source-health updates. There is no stale-run recovery.

### MEDIUM — No function duration limit

No route exports `maxDuration`, and `next.config.js` sets none. Discovery performs sequential 8-second fetches with up to three attempts per source, plus Firestore writes and per-entry persistence. On Vercel Hobby's default function duration, a slow source can terminate the function mid-run. The actual limit was not verified.

### MEDIUM — Production Firebase client configuration is implicit

Production does not define `NEXT_PUBLIC_FIREBASE_*`; `src/lib/firebase/config.ts` falls back to hardcoded project values. The values are public client identifiers, not secrets, but the fallback hides misconfiguration and couples the app to one project.

### LOW — Incomplete browser hardening headers

Production sends `Strict-Transport-Security`, but no Content-Security-Policy, `X-Frame-Options` or `Referrer-Policy` in the checked response. Next.js defaults and React escaping mitigate common injection, but clickjacking and script-source restrictions are not explicitly configured. The public homepage also sends `Access-Control-Allow-Origin: *` (without credentials), which is informational for a public page.

### LOW — Legacy WhatsApp surface remains

`src/app/api/whatsapp/webhook/route.ts` still exists and returned `503` when the Meta signature secret is absent. It is not part of the active notification path and should be removed or clearly retired to reduce attack surface.

### INFORMATIONAL — No secret values were found in tracked files

`git ls-files` tracks only `.env.example`, not `.env.local`. The admin service-account file is outside the repository. `firestore.rules` denies all client reads/writes. No secret value is reproduced in this report. The Firebase web API key is intentionally public.

### INFORMATIONAL — Public repository

`gh repo view` reports the repository is **PUBLIC**. This is good for free GitHub Actions minutes, but it means source and documentation are public. No secrets are tracked.

---

## H. Zero-cost assessment

Potentially ₹0, but **not proven**:

| Dependency | Cost risk | Assessment |
|---|---|---|
| GitHub Actions | Free for public repositories | Repository is public; both workflows are well within free runner limits. **₹0 likely.** |
| Vercel | Hobby plan limits | Deployment is live; no billing evidence was checked. Hobby is free but non-commercial. No `vercel.json` cron. **₹0 likely, plan not verified.** |
| Firebase Auth | Free tier | One user. **₹0 likely.** |
| Cloud Firestore | Spark quota | Reads/writes are small today; no Blaze/billing status was verified. The adapter's full-collection scans increase read cost as data grows. **₹0 likely now; not proven.** |
| RSS/Atom sources | None | NASA and GOV.UK feeds are free. **₹0.** |
| Telegram Bot API | None | Free. **₹0.** |
| News provider | Possible paid API | `NEWS_PROVIDER_MODE` exists in production but its value was not inspected. If it selects a paid NewsAPI tier, cost risk exists. |
| AI summarization | Optional paid API | No AI variables appeared in the Production environment listing. No cost observed. |

**Conclusion:** ₹0 operation is plausible under the current architecture, but cannot be certified without confirming the Firebase plan/billing state, Vercel plan, and news-provider mode. No billing account was queried and no paid feature was enabled during this audit.

---

## I. Critical blockers, in priority order

1. **No opportunity data and no executed discovery.** Firestore has zero opportunities and zero sources; GitHub Actions has zero runs and zero secrets.
2. **Verification is inaccessible and likely broken.** No reviewer configuration in Production; the page and action disagree on email authorization; the queue crashes on missing `first_discovered_at`.
3. **Source coverage is essentially absent.** Only two research/funding feeds exist in code; eight categories have no source.
4. **Extraction is too shallow to be useful.** No dates, fees, eligibility, organizer, benefits or application URL is extracted; every record needs manual completion.
5. **Owner authorization is not enforced in code.** Any Firebase account could become a session if sign-up is enabled.
6. **No detail page, no opportunity API, and tracking/verification have no end-to-end test.**
7. **Production is not reproducible from Git.** Local `main` equals `origin/main` at `0614c4b`, but 24 files are uncommitted; the deployed build includes those uncommitted changes.

---

## J. Implementation gap analysis

### J1. Execute discovery and seed the source registry

- **Current:** `opportunity_sources=0`, `collection_runs=0`, `opportunities=0`. Defaults exist only in `src/lib/opportunities/sources.ts`.
- **Required:** run the authenticated cron once in a controlled environment, confirm sources seed, feeds fetch, per-source runs record, and leads persist.
- **Files:** `src/lib/opportunities/sources.ts`, `discovery.ts`, `src/app/api/cron/opportunities/route.ts`.
- **Why:** without a first successful run there is no evidence the persistence path works against real Firestore.
- **Correction:** add a dry-run mode (fetch + classify, no writes), then execute in a non-production environment and inspect records.
- **Dependencies/risks:** requires Firebase credentials, network access, a writable staging project; do not run against production during an audit.

### J2. Make verification reachable and safe

- **Current:** no reviewer env in Production; page redirects; action checks IDs only; `first_discovered_at` missing causes a render crash.
- **Required:** configure reviewer UID/email, make page and action use the same helper, write `first_discovered_at` at discovery, tolerate invalid dates.
- **Files:** `src/app/admin/opportunities/page.tsx`, `actions.ts`, `src/lib/opportunities/discovery.ts`.
- **Why:** all downstream ranking, digest and lifecycle value depends on verified facts.
- **Correction:** centralize reviewer authorization, add a discovery `first_discovered_at`, add a guard around date rendering, and add an admin action test.
- **Dependencies:** owner/reviewer identity configuration.

### J3. Add sources for the missing categories

- **Current:** two research/funding feeds; no hackathon, ideathon, competition, event, internship, job or startup feed.
- **Required:** reviewed official or clearly labelled third-party feeds/APIs per category, with documented terms and verified URLs.
- **Files:** `src/lib/opportunities/sources.ts`, source registry, `taxonomy.ts`.
- **Why:** categories are otherwise UI-only.
- **Correction:** approve one or two feeds per category, verify live HTTP/XML, add source hints, run a controlled collection.
- **Dependencies:** source research and legal/terms review; no guessed URLs.

### J4. Deepen extraction

- **Current:** `entryToCandidate()` captures title, description, URL, category/subcategory/domains only.
- **Required:** at least organizer, event dates, registration deadline, fee, format, geography, eligibility and application URL where explicitly stated.
- **Files:** `src/lib/opportunities/rss.ts`, `schema.ts`, `verification.ts`.
- **Why:** a lead with no deadline, eligibility or fee cannot be ranked or acted on.
- **Correction:** add conservative structured extraction (JSON-LD/feed fields) that writes only explicit facts and leaves unknown fields null; never infer.
- **Dependencies:** source formats; no hallucination; verification remains manual for ambiguous facts.

### J5. Fix deduplication

- **Current:** cross-source dedup requires organizer + 92% title similarity, but organizer is never populated.
- **Required:** dedup by canonical URL plus title/deadline similarity when organizer is absent; record duplicate provenance rather than dropping it.
- **Files:** `src/lib/opportunities/rss.ts`, `discovery.ts`.
- **Why:** repeat announcements across feeds will create duplicate opportunities.
- **Correction:** relax the organizer requirement and retain multiple source records for one opportunity.
- **Dependencies:** careful thresholds to avoid false merges.

### J6. Enforce the single-owner boundary

- **Current:** any verified Firebase ID token becomes a session; `OWNER_EMAIL` is unused.
- **Required:** allowlist the owner UID/email in session creation and shared page guards; disable public sign-up.
- **Files:** `src/app/api/auth/session/route.ts`, `src/lib/firebase/server.ts`, `src/proxy.ts`.
- **Why:** this is a private owner application; authentication alone is not authorization.
- **Correction:** add a server-side owner check and reject non-owner tokens with 403.
- **Dependencies:** owner UID/email configuration; verify Firebase Auth provider settings.

### J7. Add opportunity detail and API surface

- **Current:** no `/opportunities/[id]` route and no opportunities API.
- **Required:** a stable detail page and a read-only API if external clients are needed.
- **Files:** new route under `src/app/opportunities/[id]/`, optional `src/app/api/opportunities/route.ts`.
- **Why:** cards are not linkable, shareable or independently auditable; deep links are expected in a discovery product.
- **Correction:** build a server-rendered detail page from the same verified-field projection; keep unverified facts labelled.
- **Dependencies:** stable IDs, safe URL handling.

### J8. Make scheduling real

- **Current:** workflows active, zero runs, zero secrets.
- **Required:** `APP_BASE_URL` and `CRON_SECRET` repository secrets, one successful manual dispatch, then scheduled runs.
- **Files:** `.github/workflows/*.yml`.
- **Why:** the product claims continuous discovery and daily delivery; neither occurs automatically.
- **Correction:** add secrets, dispatch manually, verify response JSON and run logs, monitor failures.
- **Dependencies:** production URL, secret rotation policy.

### J9. Reconcile deployment with Git

- **Current:** local `main` equals `origin/main` at `0614c4b`; 24 files are uncommitted. The deployed build was produced from the local working tree.
- **Required:** committed, reproducible source matching Production.
- **Why:** a rebuild from GitHub would not include the Firebase runtime fix or the scope work.
- **Correction:** review and commit the intended changes, push, and deploy from the commit.
- **Dependencies:** owner approval; no automatic commit/push under project rules.

### J10. Complete the dashboard/profile scope

- **Current:** dashboard has counts and links only; profile lacks projects, experience, certifications, current status and travel availability.
- **Required:** latest/recommended/closing-today/saved/applied/expired surfaces and the full profile fields that ranking claims to use.
- **Files:** `src/app/dashboard/page.tsx`, `src/app/settings/opportunities/page.tsx`, `profile.ts`, `intelligence.ts`.
- **Why:** “Recommended for Me” is weak when profile data is partial and dashboard summaries are empty.
- **Correction:** add the missing fields and ensure each dashboard card links to a populated view; do not fabricate metrics.
- **Dependencies:** data availability and verification.

---

## K. Final maturity scorecard

Scores are evidence-based, not an average.

| Dimension | Score (0–5) | Evidence |
|---|---:|---|
| Product scope | **2/5** | Broad model and UI, but only research has a source and nothing is live. |
| Opportunity category coverage | **1/5** | 0/9 categories live; 8/9 model/UI only. |
| Discovery | **2/5** | Pipeline code and unit tests; zero production runs and zero sources in Firestore. |
| Source quality | **1/5** | Two official research/funding feeds, both reachable; no category breadth; one dead feed removed. |
| Verification / provenance | **1/5** | Schema and manual workflow exist; inaccessible, crash-prone and unexercised. |
| Eligibility | **3/5** | Well-tested deterministic logic; no profile or opportunity data to apply it to. |
| Ranking | **3/5** | Weights match the specified 25/25/15/15/10/10 model; unknown benefits earn zero; no live outputs. |
| User profile | **2/5** | Core fields render; missing projects/experience/certifications/status/travel; no saved profile. |
| Dashboard | **2/5** | Attractive summary, but all counts zero and no latest/recommended/today views. |
| Database | **3/5** | Firebase genuinely connected and rules deny client access; no schema enforcement, indexes or data. |
| Authentication / security | **2/5** | Sign-in and session work; owner authorization missing; reviewer gate inconsistent. |
| Telegram / WhatsApp | **2/5** | Bot token and webhook valid; zero linked channels; delivery untested; WhatsApp legacy only. |
| Scheduling | **0/5** | Zero runs, zero secrets, no Vercel cron. |
| Live deployment | **3/5** | Reachable, sign-in works, protected pages render; no live opportunity data or backend workflow. |
| Testing | **3/5** | 50 passing unit tests; no emulator, E2E, admin-action, tracking or delivery tests. |
| Reliability | **1/5** | No run history, no concurrency lock, no source breadth, verification dead end. |
| Zero-cost feasibility | **3/5** | Public repo + free feeds + Telegram; plan/billing and news-provider cost unverified. |

**No overall average is meaningful.** Deployment and UI polish do not compensate for zero live opportunities, zero scheduler runs, inaccessible verification and missing owner authorization. The product is **not production-ready**.

---

## Direct answers

### 1. What have we actually built?

A deployed Next.js/Firebase application with a polished opportunity-browsing UI, a deterministic taxonomy/filter/scoring layer, a manual verification design, a two-feed RSS collector that has never run, and a Telegram digest pipeline inherited from the earlier news product. Firestore currently contains only one settings document.

### 2. Does it genuinely cover hackathons, ideathons and the other seven categories?

**No.** All nine appear in the taxonomy, classifier, filters and tabs. Only research/funding has any source, and that source has never been collected. The other eight are model/UI only.

### 3. Does live opportunity discovery work?

**No evidence that it does.** Firestore has zero sources and zero collection runs. GitHub Actions has zero runs and zero secrets. Feeds are reachable and the code is unit-tested, but the live path has never executed. A successful feed HTTP response is not proof of discovery.

### 4. Are real sources connected and producing usable opportunities?

**No.** Two official feeds are defined in code (NASA, Innovate UK); neither is stored in Firestore. No opportunity was produced or persisted. Live fetches returned items, but extraction into usable opportunity facts has not been run.

### 5. Is verification genuinely implemented?

**Partially in code, not operational.** The field-evidence schema, parser and review action exist and the parser is tested. In Production the reviewer page redirects, the action and page use inconsistent allowlists, and the queue will likely crash on missing `first_discovered_at`. No record has ever been verified.

### 6. Is the profile/dashboard functional?

**The pages are functional; the data loop is not.** The profile page renders and has a save action, but no profile exists and save was not tested. The dashboard renders zero counts because there are no opportunities or tracking records. It lacks latest/recommended/today-tomorrow lists.

### 7. Is Firebase/Supabase actually connected?

**Firebase is genuinely connected.** Authentication sign-in and server session creation succeeded live; the Admin SDK read Firestore successfully; rules deny direct client access. Production is missing the public Firebase environment variables but falls back to hardcoded config. **Supabase is not used at runtime**; only legacy migrations and an unrun import script remain.

### 8. Is Telegram actually connected?

**Credentials and webhook are valid; user delivery is not connected.** `getMe` succeeded for `@daily_intelligence_news_bot`, and the webhook is registered with zero pending updates. There are zero `user_channels` rows, and no real message was sent. Delivery remains unverified.

### 9. Is automatic scheduling working?

**No.** Two GitHub Actions workflows are active, but both have zero runs and the repository has zero Actions secrets. There is no Vercel Cron configuration. Discovery and digests are not occurring.

### 10. Is the deployed application live and functional?

**Live, but not functionally complete.** The production alias is reachable; homepage, login, dashboard, opportunities and profile return `200`; unauthenticated routes redirect; admin review redirects; cron endpoints reject unauthorized calls. Backend data reads work. But there are no opportunities, no sources, no profiles, no tracking and no verified records, so the core product cannot be used.

### 11. Can it operate at ₹0?

**Likely, but not proven.** Public repository and free feeds favor ₹0; GitHub Actions is free for public repositories; Telegram is free. Firebase billing, Vercel plan and the news-provider mode were not verified. No paid feature was enabled during this audit.

### 12. What is the honest maturity level?

**Partially functional prototype.** It has real authentication, real deployment, a real data model and tested pure logic, but the product-defining loop — discover, verify, rank, notify — has never run end to end and currently produces nothing.

### 13. What are the five most important gaps?

1. No live discovery and no data: zero sources, zero runs, zero opportunities.
2. Verification is inaccessible and crash-prone; no reviewer configuration.
3. No source coverage for eight of nine categories, and extraction captures no usable facts.
4. Owner authorization is not enforced; any Firebase account could become a session if sign-up is enabled.
5. Scheduling is dead (zero workflow runs/secrets), and deployment is not reproducible from Git (24 uncommitted files).

### 14. What should be done next, in the correct dependency order?

1. **Enforce the owner boundary** in session creation and verify Firebase sign-up is disabled.
2. **Fix verification prerequisites:** write `first_discovered_at`, centralize reviewer authorization, configure reviewer IDs, guard invalid dates.
3. **Commit and push the current working tree** so Production matches a reproducible Git commit.
4. **Add a dry-run discovery mode**, execute it against a staging/non-production project, and confirm source seeding, feed parsing and deduplication.
5. **Run one controlled production/staging discovery**, then manually verify a small set of records end to end.
6. **Add and validate category sources** one category at a time, starting with hackathons and internships, without guessed URLs.
7. **Deepen extraction** for dates, fees, eligibility, organizer and application URL, keeping unknown values null.
8. **Configure GitHub Actions secrets**, dispatch both workflows manually, and confirm scheduled runs.
9. **Test Telegram delivery** to the owner's linked channel, then create a profile and verify digest inclusion.
10. **Add the detail page, tracking tests, source-health UI and dashboard lists** only after the data loop is demonstrably working.

---

## Report location

`OPPORTUNITY_RADAR_INDEPENDENT_AUDIT.md` (project root).
