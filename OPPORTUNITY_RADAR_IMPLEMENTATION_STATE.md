# Opportunity Radar — Implementation State

**Updated:** 2026-11-07, after the audit-remediation implementation pass and the six-source live run.
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
- Deduplication now keeps distinct same-source records apart by exact provenance (`source_id + source_record_key`) before any title fallback, and prevents the same title fallback from merging two records from the same source. Cross-source dedup still uses a high title-similarity threshold with exact canonical URL first.
- Source registry now includes six sources: NASA, Innovate UK, We Work Remotely, Remotive, Codeforces, Devpost.

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

## Live six-source discovery evidence

**Run:** `RUN_LIVE_SOURCE_TEST=1 npx jest test/live-sources.test.ts --runInBand --silent=false`
**Sources:** NASA Learning Resources, Innovate UK Activity, We Work Remotely — Programming Jobs, Remotive Remote Jobs, Codeforces Contests, Devpost Open Hackathons.
**Entries seen:** 83. **Normalized candidates:** 58.

| Source | Category | Entries | Candidates | Persisted |
|---|---:|---:|---:|---:|
| NASA Learning Resources | Research | 10 | 3 | 3 |
| Innovate UK Activity | Research | 20 | 6 | 6 |
| We Work Remotely — Programming Jobs | Employment | 25 | 24 | 22 |
| Remotive Remote Jobs | Employment | 13 | 10 | 10 |
| Codeforces Contests | Technical competitions | 6 | 6 | 6 |
| Devpost Open Hackathons | Hackathons | 9 | 9 | 9 |

**Persisted totals:** 56 unique opportunities from 58 source records. Category split: hackathon 9, employment 32, research 8, technical_competition 6, internship 1. Two cross-source merges reduced 58 records to 56.
