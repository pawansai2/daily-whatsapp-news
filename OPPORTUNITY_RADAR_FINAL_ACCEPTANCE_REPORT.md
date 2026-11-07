# Opportunity Radar — Final Acceptance Report

**Date:** 2026-11-07
**Release candidate:** current working tree, not committed, not deployed.
**Verdict:** **LOCALLY IMPLEMENTED AND TESTED — NOT PRODUCTION VERIFIED — SCOPE INCOMPLETE (2/9 categories have sources).**

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

| Category | Source configured | Live fetch | Candidates normalized | Persisted | Status |
|---|---|---:|---:|---:|---|
| Hackathons | No | — | 0 | 0 | **NOT IMPLEMENTED (source gap)** |
| Ideathons | No | — | 0 | 0 | **NOT IMPLEMENTED (source gap)** |
| Innovation challenges | No | — | 0 | 0 | **NOT IMPLEMENTED (source gap)** |
| Technical competitions | No | — | 0 | 0 | **NOT IMPLEMENTED (source gap)** |
| Technical events | No | — | 0 | 0 | **NOT IMPLEMENTED (source gap)** |
| Internships | No | — | 0 | 0 | **NOT IMPLEMENTED (source gap)** |
| Jobs & recruitment | Yes, 2 third-party | PASS | 34 | 0 | **IMPLEMENTED + LIVE-VERIFIED ADAPTER; NOT PERSISTED** |
| Research opportunities | Yes, 2 official | PASS | 9 | 0 | **IMPLEMENTED + LIVE-VERIFIED ADAPTER; NOT PERSISTED** |
| Startup & entrepreneurship | No | — | 0 | 0 | **NOT IMPLEMENTED (source gap)** |

## Sources and live results

- NASA Learning Resources: 10 entries, 3 candidates.
- Innovate UK Activity: 20 entries, 6 candidates.
- We Work Remotely Programming Jobs: 25 entries, 24 candidates.
- Remotive Remote Jobs: 13 entries, 10 candidates.
- **Total: 68 live entries, 43 normalized candidates.**

No candidate was persisted. Firestore counts:

```
opportunities=0
opportunity_sources=0
collection_runs=0
collection_run_sources=0
opportunity_source_records=0
opportunity_field_evidence=0
opportunity_changes=0
opportunity_profiles=0
user_opportunity_tracking=0
deliveries=0
user_channels=0
```

## What was implemented

- Owner allowlist enforced at session issuance and on every server session check.
- Admin page/action reviewer authorization unified.
- `first_discovered_at` written; admin timestamps fail safe.
- Manual lifecycle decisions with required reason and history.
- Dry-run discovery endpoint that never writes.
- Conservative extraction for format, team size, participation and fee.
- Cross-source deduplication fallback.
- Opportunity detail page and authenticated detail/list APIs.
- Expanded profile fields.
- Dashboard latest/closing today/closing tomorrow/recommended sections with real scoring.
- Digest content enrichment.
- Discovery run guard, workflow concurrency and function duration target.
- Notification settings discoverable at `Settings → Notifications`.

## Verification and scoring

- Eligibility/scoring retain the 25/25/15/15/10/10 model.
- 58 local tests pass; one live-network test is skipped by default and was run separately.
- Unknown values receive no benefit; unverified benefits and fees do not score.
- Manual verification remains required before facts are shown as verified.
- No fake opportunities, statistics or verification were created.

## User workflows

| Workflow | Status |
|---|---|
| Sign-in | LIVE VERIFIED in the prior audit; new owner gate is LOCAL ONLY |
| Dashboard | IMPLEMENTED; build passes; not deployed |
| Category views | IMPLEMENTED; 7 categories legitimately empty |
| Search/filters/views | IMPLEMENTED and unit-tested |
| Opportunity detail | IMPLEMENTED; not deployed |
| Save/apply/remove tracking | IMPLEMENTED; not exercised against production |
| Profile save | IMPLEMENTED; not exercised against production |
| Manual review | IMPLEMENTED; not exercised against real data |
| Telegram delivery | Not tested; no linked user |
| Scheduler | Code hardened; 0 runs, 0 secrets |

## Firebase / Telegram / scheduler / deployment

- Firebase Auth and Firestore connectivity were live-verified in the prior audit.
- Production still has zero opportunity data and no sources.
- Telegram bot identity and webhook were valid previously; zero `user_channels`; no message sent.
- GitHub Actions: 0 runs, 0 secrets. Workflows active.
- Vercel: existing production deployment only; no new deploy.
- Git: release candidate is uncommitted; no push/reset/merge.

## Tests executed

| Command | Result |
|---|---|
| `npm run lint` | PASS |
| `npm run typecheck` | PASS |
| `npm run test` | 13 passed, 1 skipped; 58 passed, 1 skipped |
| `npm run build` | PASS |
| `npm run validate` | PASS |
| `RUN_LIVE_SOURCE_TEST=1 npx jest test/live-sources.test.ts --runInBand` | PASS, 4 sources |

## Remaining blockers

1. **Deployment approval** — production is not updated.
2. **GitHub Actions secrets** — `APP_BASE_URL` and `CRON_SECRET` are absent; zero runs.
3. **Source gaps** — 7 of 9 categories have no approved free source.
4. **No persisted data** — first controlled collection and human verification have not run.
5. **Telegram** — no linked user and no authorized delivery test.
6. **Plan verification** — Firebase/Vercel plans and Firebase sign-up setting are unverified.
7. **Production verification** — no production test of the owner gate, detail/API, tracking, review or dry run.

## Exact manual actions required

1. Review the 47 changed/untracked paths and approve a commit/push.
2. Approve a Vercel deployment (preview first, production only on explicit approval).
3. Add `APP_BASE_URL` and `CRON_SECRET` as GitHub Actions repository secrets.
4. Confirm Firebase email/password sign-up is disabled.
5. Link the owner Telegram chat and authorize one test message.
6. Run the production dry run with the cron secret, inspect the 43 candidates, then run one controlled collection.
7. Approve/deny free sources for the seven uncovered categories; do not add guessed feeds.
8. Confirm the Firebase and Vercel plans are ₹0-compatible and the news provider is not on a paid tier.

## Honest definition-of-done assessment

- **Discover:** partially implemented; 2 categories have reachable adapters; no persisted data.
- **Compete:** not operational for hackathons/ideathons/competitions.
- **Innovate:** not operational for innovation challenges/research/entrepreneurship beyond research feeds.
- **Build:** data model and detail UI exist; source facts remain manual.
- **Grow:** employment feeds and internship model exist; internships have no source; no delivery evidence.

The product is **not complete** under the prompt's Definition of Done.
