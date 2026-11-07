# Opportunity Radar implementation status

**Status date:** 2026-11-07
**Scope:** Repository implementation, local validation, and live production verification.

## Implemented and verified

- Canonical nine-category opportunity taxonomy with subcategories and nine technical-domain groups.
- Deterministic, source-hint-aware classification of leads; unknown category/domain stays `null` rather than being invented.
- Unified discovery views (All, Recommended, Closing Soon, Upcoming, Verified, Saved, Applied, Expired/Cancelled) and category views with counts.
- Extended filters: technical domain, format, geography, entry fee, deadline window, eligibility, verification, tracking, and search across organizer/company/institution.
- Dashboard Opportunity Radar summary with category counts and view links.
- Idempotent default source seeding for a Firestore registry that has no sources.
- Official RSS/Atom source registry, source-isolated discovery, canonicalization, duplicate protection, and collection-run history.
- Evidence-gated Opportunity Radar: field-level reviewer verification, change history, profile-based eligibility, and explainable scoring. Unknown facts remain unknown.
- Authenticated browsing, profile editing, and private saved/applied tracking.
- Firebase Authentication (email/password) with HTTP-only session cookies and Firebase Admin–backed server access.
- Firestore persistence for settings, interests, delivery records, inbound messages, Telegram channels and link tokens, opportunity profiles/tracking, sources, evidence, changes, and collection runs.
- Firestore client rules deny-all (verified live).
- Telegram linking, per-user test delivery, and verified-opportunity digest inclusion.
- Lifecycle refresh based only on verified dates.
- GitHub Actions schedules for discovery and digest dispatch.
- One-time, dry-run-first Supabase → Firestore importer.
- Lazy Firebase server client initialization so unauthenticated requests are rejected before privileged initialization.
- CommonJS-compatible `jose@4.15.9` override for `firebase-admin` on the Vercel runtime.

## Deployment

- Production: `https://daily-whatsapp-news-3d5j.vercel.app` — deployed 2026-11-07, alias updated.
- Verified: sign-in, session creation, Firestore reads, settings write, protected-route redirects, deny-all client rules, unauthorized cron rejection.
- Runtime logs: no Firebase errors after the fix.

## Not implemented or not proven

- Source coverage outside research/funding is not yet approved. Hackathons, ideathons, competitions, events, internships, jobs, and startup programmes need reviewed official feeds before they can populate; no feed URLs were guessed.
- Classification is an unverified lead, not a confirmed fact.

- Telegram linking and delivery have not been exercised live.
- User isolation has not been tested with two accounts.
- Opportunity save/apply and digest eligibility have not been exercised against real opportunity data (Firestore contains no opportunities).
- The Supabase migrations were never applied; the SQL is historical source definition only. The one-time data import has not run.
- GitHub Actions has no repository secrets (`APP_BASE_URL`, `CRON_SECRET`) and has never run.
- Development-scope Vercel variables are not configured.
- No reviewer account is configured for `/admin/opportunities`.
- Immediate deadline/change alerts, automatic web verification, and cross-source fuzzy merge are not provided.

## Required owner actions

1. Rotate the service-account key because it was shared in the chat transcript; update `FIREBASE_ADMIN_SERVICE_ACCOUNT_JSON` in Vercel and redeploy.
2. Set GitHub Actions repository secrets and run both workflows manually.
3. Configure reviewer emails/IDs.
4. Validate Telegram with an approved test destination.
5. Run the Supabase → Firestore import only after confirming a backup and source counts.

## Related documents

- [Scope alignment](./OPPORTUNITY_RADAR_SCOPE_ALIGNMENT.md)
- [Firebase + Vercel audit](./OPPORTUNITY_RADAR_FIREBASE_VERCEL_AUDIT.md)
- [Firebase validation](./OPPORTUNITY_RADAR_FIREBASE_VALIDATION.md)
- [Database validation](./OPPORTUNITY_RADAR_DATABASE_VALIDATION.md)
- [Vercel deployment](./OPPORTUNITY_RADAR_VERCEL_DEPLOYMENT.md)
- [Test report](./OPPORTUNITY_RADAR_TEST_REPORT.md)
- [Scheduler](./OPPORTUNITY_RADAR_SCHEDULER.md)
- [Telegram validation](./OPPORTUNITY_RADAR_TELEGRAM_VALIDATION.md)
- [Firebase setup](./FIREBASE_SETUP.md)
