# Opportunity Radar — Task Ledger

Statuses are deliberately strict: code written is not the same as locally tested, live verified or production verified.

| ID | Task | Dependency | Status | Evidence | Remaining work |
|---|---|---|---|---|---|
| P0 | Reconstruct workspace and preserve uncommitted work | — | LOCALLY TESTED | `git status`, `git diff`, audit re-read; no reset/commit | Release candidate still uncommitted |
| P1 | Owner authorization | — | LOCALLY TESTED | `src/lib/auth/authorization.ts`; session route and `getClaims` checks; `test/authorization.test.ts` | Verify Firebase sign-up is disabled |
| P1b | Reviewer authorization consistency | P1 | IMPLEMENTED | Page and action both use `isReviewerClaims`; owner is reviewer | Separate non-owner reviewer identities are not enabled by the owner-only session gate |
| P2 | Verification date crash | — | LOCALLY TESTED | `first_discovered_at` written; safe timestamp formatter | Re-test against a real lead after discovery |
| P2b | Manual lifecycle decisions | P2 | IMPLEMENTED | Admin lifecycle action with history | Not exercised against production data |
| P3 | Discovery dry run | P3b | LOCALLY TESTED | `runOpportunityDiscoveryDryRun`, `?dryRun=1` | Not called in production (not deployed) |
| P3b | Live source adapters | — | LIVE VERIFIED | Six feeds: 83 entries, 58 candidates via real network test | Persistence and API tested in emulator |
| P3c | Source coverage for all 9 categories | P3b | BLOCKED | 5 categories covered; 4 have no approved feed | Research and approve free sources |
| P4 | Structured extraction | — | LOCALLY TESTED | `extraction.ts`; 4 extraction tests | Dates, eligibility, organizer and application URL remain manual for news feeds |
| P4b | Cross-source deduplication | P4 | LOCALLY TESTED | Provenance-first exact lookup; same-source title fallback blocked; URL exact match | Re-test with live persisted records |
| P5 | Eligibility and ranking | — | LOCALLY TESTED | Existing 25/25/15/15/10/10 model; deterministic tests | No live profile/opportunity data |
| P6 | Opportunity detail page | P1 | IMPLEMENTED | `/opportunities/[id]`; build route present | Browser test after deploy |
| P6b | Opportunities API | P1 | IMPLEMENTED | `/api/opportunities`, `/api/opportunities/[id]` | Auth/live test after deploy |
| P6c | Profile completion | P1 | IMPLEMENTED | New fields in schema, form and action | Save not exercised against production |
| P6d | Dashboard sections | P5, P6 | IMPLEMENTED | Latest, closing today/tomorrow, recommended count | Browser test after deploy |
| P7 | Telegram notification content | — | LOCALLY TESTED | Digest enrichment; existing 4,096 limit tests | No authorized delivery test |
| P7b | Notification settings | — | IMPLEMENTED | `/settings#notifications`, delivery time/timezone | Not browser-tested live |
| P8 | Scheduler idempotency | — | IMPLEMENTED | Run guard, workflow concurrency, `maxDuration` | Zero workflow runs/secrets |
| P9 | Deployment reconciliation | — | BLOCKED | 47 changed/untracked paths; no commit/deploy | Owner approval, commit, preview/production |
| P10 | Zero-cost validation | — | BLOCKED | Public repo confirmed; plans unverified | Verify Firebase/Vercel plan and news-provider mode |
| P11 | Full QA | P1–P10 | LOCALLY TESTED | `npm run validate`: lint, tsc, 58 passing tests, production build; emulator persistence/API tests | End-to-end production run blocked |
| P12 | Final acceptance | P11 | IMPLEMENTED | `OPPORTUNITY_RADAR_FINAL_ACCEPTANCE_REPORT.md` | Must remain not-production-verified |

## Status definitions used

- **IMPLEMENTED:** code and wiring exist.
- **LOCALLY TESTED:** compile/unit/build checks passed.
- **LIVE VERIFIED:** exercised against a real external service; not necessarily production.
- **PRODUCTION VERIFIED:** observed working in the deployed production system. **No new feature in this pass has this status.**
- **BLOCKED:** requires authorization, credentials, a source decision or deployment.
- **NOT IMPLEMENTED:** absent.
