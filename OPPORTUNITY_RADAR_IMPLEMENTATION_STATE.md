# Opportunity Radar — Implementation State

**Updated:** 2026-11-07, after the audit-remediation implementation pass.
**Baseline:** repository `main` at `0614c4b`, with the pre-existing uncommitted work preserved. No commit, push, merge, reset, production deploy or production database write was performed.

## Current architecture

- Next.js 16.2.12 App Router, TypeScript, React, Tailwind CSS 4.
- Firebase Authentication (email/password) with an HttpOnly `__session` cookie.
- Cloud Firestore through the existing Supabase-style Admin adapter in `src/lib/firebase/store.ts`.
- Telegram Bot API for the daily digest; WhatsApp remains a legacy surface.
- GitHub Actions for discovery and digest scheduling; no Vercel Cron.
- Vercel production deployment remains the previously audited build. The new code is **not deployed**.

## Implemented in this pass

### Security

- `src/lib/auth/authorization.ts`: owner allowlist using `OWNER_EMAIL` and/or `OWNER_UID`; fails closed when neither is configured.
- `/api/auth/session` verifies the Firebase ID token and then requires owner authorization before issuing a session cookie.
- `createClient().auth.getClaims()` verifies the session and then re-checks owner authorization, so an existing non-owner cookie cannot access protected pages or Server Actions.
- Admin page and review action now share `isReviewerClaims`; the previous page/action mismatch is removed. In this single-owner deployment the owner is the reviewer.
- Firestore client rules remain deny-all.

### Verification

- Discovery inserts `first_discovered_at`.
- Admin rendering uses a safe timestamp formatter instead of throwing on a missing/invalid date.
- Added a manual lifecycle action for active, closing soon, expired, postponed and cancelled, with a required reason written to `opportunity_changes`.
- Manual evidence still records field-level values, evidence URL, excerpt, reviewer, provenance and change history. Facts remain pending/partial until reviewed.

### Discovery and extraction

- Added `runOpportunityDiscoveryDryRun()`: fetches real configured sources and returns normalized candidates without creating runs, opportunities or source records.
- `GET /api/cron/opportunities?dryRun=1` exposes the safe dry run behind the cron secret.
- Added a 60-second function duration target and a running-run guard (30-minute staleness window) to reduce duplicate concurrent discovery.
- Added conservative extraction for explicit format, team size, participation mode and fee.
- Deduplication now works cross-source when organizers are absent, using a high title-similarity threshold; exact canonical URLs still deduplicate first.
- Source registry now includes two official research feeds and two third-party employment feeds.

### Product workflows

- Opportunity detail page: `/opportunities/[id]`.
- Authenticated detail API: `/api/opportunities/[id]`.
- Authenticated list API: `/api/opportunities`.
- Card titles link to the detail page.
- Detail page shows verified facts, eligibility, score components, warnings, description, provenance, change history, save/apply/remove-tracking.
- Profile expanded with current status, proficiency notes, projects, experience, certifications, preferred formats, preferred locations, travel availability, internship eligibility and employment eligibility.
- Dashboard now computes real eligibility/scores, adds recommended count, latest opportunities, closing today and closing tomorrow sections.
- Notification settings are discoverable as `Settings → Notifications`; delivery time, timezone and digest enablement remain persisted in `personal_settings`.

### Digest

- Opportunity digest items now include organizer, category, domain, verification status, format, fee, participation mode, benefits and two score reasons.
- The Telegram digest renders those fields while staying inside the 4,096-character send limit.

### Scheduler

- Both GitHub workflows now have non-cancelling concurrency groups.
- Cron routes have `maxDuration = 60`.
- Discovery refuses to start a second run while a recent run is `running`.

## Verification results

| Check | Command | Result |
|---|---|---|
| Lint | `npm run lint` | PASS |
| Typecheck | `npm run typecheck` | PASS |
| Tests | `npm run test` | 13 suites passed, 1 skipped; 58 passed, 1 skipped |
| Build | `npm run build` | PASS |
| Full validation | `npm run validate` | PASS |
| Live feed adapter | `RUN_LIVE_SOURCE_TEST=1 npx jest test/live-sources.test.ts --runInBand` | PASS |

Live feed evidence from the actual reviewed sources:

```
NASA Learning Resources: 10 entries, 3 candidates
Innovate UK Activity: 20 entries, 6 candidates
We Work Remotely — Programming Jobs: 25 entries, 24 candidates
Remotive Remote Jobs: 13 entries, 10 candidates
Total: 68 entries, 43 normalized candidates
```

No candidate was persisted. Firestore still reports zero opportunities, sources, runs, source records, evidence, changes, profiles, tracking rows, deliveries and channels.

## Preserved work

The 24 pre-existing changed/untracked files were not reset or overwritten. This pass adds new files and modifies existing files in place. See `git status` and `git diff` for the complete release candidate.

## Remaining blockers

1. No production deploy or production database write was authorized, so live production still runs the audited build.
2. GitHub Actions still has zero repository secrets (`APP_BASE_URL`, `CRON_SECRET`) and zero runs.
3. Seven categories still have no approved free source: hackathons, ideathons, innovation challenges, technical competitions, technical events, internships and startup/entrepreneurship.
4. No linked Telegram user exists; delivery has not been tested.
5. Firebase sign-up enablement and the Firebase/Vercel billing plans were not verified.
6. A production dry run, first real collection, human verification and Telegram delivery remain blocked on deployment/authorization.

## Next exact step

After explicit deployment approval: commit/push the release candidate, add the two GitHub Actions secrets, deploy, call `/api/cron/opportunities?dryRun=1` with the cron secret, inspect the 43 candidates, then run one controlled collection and verify a small sample manually before enabling the scheduled workflow.
