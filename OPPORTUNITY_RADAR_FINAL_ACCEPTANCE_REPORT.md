# Opportunity Radar — Final Acceptance Report

**Date:** 2026-11-07
**Release candidate:** current working tree, not committed, not deployed.
**Verdict:** **LOCALLY IMPLEMENTED AND TESTED — NOT PRODUCTION VERIFIED — SCOPE INCOMPLETE (4/9 categories have sources).**

This report deliberately does not call the product complete. The release candidate fixes the audit's authorization, verification, timestamp, API, detail, profile, dashboard, extraction, deduplication, digest and scheduler-lock defects. It does **not** fabricate source coverage, production data, verification or delivery evidence.

## Actual architecture

- Next.js 16.2.12 App Router, TypeScript, React, Tailwind CSS 4.
- Firebase Authentication email/password + server session cookie.
- Firestore through the existing Admin adapter; Firestore client rules deny direct access.
- Server Components, Server Actions and route handlers; no separate backend.
- Telegram Bot API digest; WhatsApp legacy surface.
- GitHub Actions scheduler; no Vercel Cron.
- Vercel hosting; the deployed production build is the previously audited build, not this release candidate.

## Nine-category coverage

| Category | Sources configured | Live fetch | Normalized candidates | Persisted | Status |
|---|---:|---:|---:|---:|---|
| Hackathons | 1 (Devpost) | PASS | 9 | 9 | **IMPLEMENTED + LIVE VERIFIED; VERIFICATION PENDING** |
| Ideathons | 0 | — | 0 | 0 | **NOT IMPLEMENTED (source gap)** |
| Innovation challenges | 0 | — | 0 | 0 | **NOT IMPLEMENTED (source gap)** |
| Technical competitions | 1 (Codeforces) | PASS | 6 | 6 | **IMPLEMENTED + LIVE VERIFIED; VERIFICATION PENDING** |
| Technical events | 0 | — | 0 | 0 | **NOT IMPLEMENTED (source gap)** |
| Internships | 0 | — | 0 | 0 | **NOT IMPLEMENTED (source gap)** |
| Jobs & recruitment | 2 (WWR, Remotive) | PASS | 34 | 32 | **IMPLEMENTED + LIVE VERIFIED; VERIFICATION PENDING** |
| Research opportunities | 2 (NASA, Innovate UK) | PASS | 9 | 8 | **IMPLEMENTED + LIVE VERIFIED; VERIFICATION PENDING** |
| Startup & entrepreneurship | 0 | — | 0 | 0 | **NOT IMPLEMENTED (source gap)** |

**Coverage: 4 of 9 categories reach a live feed. 5 of 9 remain blocked on approved sources.**

## Sources and live results

| Source | Category | Entries | Candidates | Persisted |
|---|---|---|---|---|
| NASA Learning Resources | Research | 10 | 3 | 3 |
| Innovate UK Activity | Research | 20 | 6 | 6 |
| We Work Remotely — Programming Jobs | Employment | 25 | 24 | 22 |
| Remotive Remote Jobs | Employment | 13 | 10 | 10 |
| Codeforces API | Technical competitions | 6 | 6 | 6 |
| Devpost API | Hackathons | 9 | 9 | 9 |
| **Total** | | **83** | **58** | **56** |

## Emulator verification

**Command:** `RUN_FIRESTORE_EMULATOR_TEST=1 npx jest test/opportunity-persistence.emulator.test.ts --runInBand`
**Emulator:** Firestore at `127.0.0.1:8080`, isolated project `demo-opportunity-radar`.

| Collection | Count |
|---|---|
| opportunities | 56 |
| opportunity_sources | 6 |
| collection_runs | 2 |
| collection_run_sources | 12 |
| opportunity_source_records | 58 |

**Category counts:** `{ "hackathon": 9, "employment": 32, "research": 8, "technical_competition": 6, "internship": 1 }`.
**Other:** `opportunity_profiles=1`, `user_opportunity_tracking=1`.

The persistence test clears the emulator, runs real discovery, then asserts:
records persisted per category; `first_discovered_at` and `pending_verification` present; provenance captured; each source collection run; a second collection run adds **0 duplicates**; detail, eligibility and score surfaces; profile save; and tracking save.

## API verification

**Command:** `RUN_FIRESTORE_EMULATOR_TEST=1 npx jest test/opportunity-api.emulator.test.ts --runInBand`
Seeds a record, then asserts the list and detail APIs return 200 against the same persisted data, shared state between the two routes, and a 401 for unauthenticated access. Both emulator suites pass together.

## Full validation

`npm run validate` passed:

- ESLint: clean.
- `tsc --noEmit`: clean.
- Jest: **58 passed, 3 skipped** (live sources and emulator tests each run with their env): `test/opportunity-taxonomy.test.ts`, `test/opportunity-schema.test.ts`, `test/opportunity-dry-run.test.ts`, `test/firebase-encoding.test.ts`, `test/opportunity-verification.test.ts`, `test/opportunity-extraction.test.ts`, `test/firebase-config.test.ts`, `test/security.test.ts`, `test/authorization.test.ts`, `test/unit.test.ts`, `test/opportunity-discovery.test.ts`, `test/integration.test.ts`, `test/firebase-server.test.ts`.
- Production build: compiled successfully; all routes listed, including `/api/opportunities`, `/api/opportunities/[id]`, `/api/cron/dispatcher`, `/api/cron/opportunities`, dashboard and admin.

## What was implemented

- Owner allowlist enforced at session issuance and on every server session check.
- Admin page/action reviewer authorization unified.
- DynamoDB/Firestore extraction adapters for six live sources; Codeforces and Devpost added.
- Provenance-first deduplication fixed: distinct same-source records stay distinct; replay is idempotent.
- Devpost date normalization: `registrationClosesOn` from the parsed date; no invented submission time.
- Emulator persistence and API tests added and passing.

## What is not verified

- No production write, deploy, push or commit was made.
- No Telegram digest delivery, Telegram link, approval, concurrency, runtime production discovery, owner-gate production enforcement, or Firebase/Vercel billing feature was exercised.
- These remain blocked or **PENDING VERIFICATION** until the owner authorizes deployment and live credentials/webhook access.

## Open categories

| Category | Status | Required next source work |
|---|---|---|
| Ideathons | BLOCKED | Approve ideathon organizer pages or feeds |
| Innovation challenges | BLOCKED | Approve innovation-challenge sources with permitted collection |
| Technical events | BLOCKED | Approve conference/workshop/developer-event feeds |
| Internships | BLOCKED | Approve official internship/fellowship feeds |
| Startups | BLOCKED | Approve incubator/accelerator or startup-challenge source |
