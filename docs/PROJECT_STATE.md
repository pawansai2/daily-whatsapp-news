# Project State

**Updated:** 2026-11-07

## Current implementation

- Firebase Authentication is wired into the login form and HTTP-only session
  cookie flow.
- Protected pages, server actions, and user API routes verify the Firebase
  session; Firestore access is server-side through the Firebase Admin SDK.
- News settings, delivery history, Telegram linking, and Opportunity Radar
  persistence use Firestore collections.
- Opportunity Radar uses a canonical nine-category taxonomy, subcategories,
  nine technical-domain groups, deterministic lead classification, unified
  views/filters, and a dashboard summary. Unknown category/domain values stay
  null rather than being fabricated.
- Firestore client rules remain deny-all and were verified live (`403`).
- The Firebase server data client is created lazily so unauthenticated requests
  are rejected before privileged initialization.
- `package.json` overrides `jose` to `4.15.9` so `firebase-admin@14`'s
  `jwks-rsa` dependency loads in the CommonJS Vercel runtime. Do not remove
  this override.
- `scripts/migrate-supabase-to-firestore.mjs` provides a dry-run-first,
  non-destructive import that maps Supabase user IDs to existing Firebase UIDs
  by email and verifies imported records.
- Supabase schema files remain as historical source definitions until data
  migration and production verification are complete.

## Deployment

- Vercel project `pawansai/daily-whatsapp-news-3d5j` auto-deploys `main`.
- Production alias: `https://daily-whatsapp-news-3d5j.vercel.app`.
- The repaired build was deployed on 2026-11-07 and the alias was updated.
- Verified in Production: browser sign-in, session creation, Firestore reads,
  a settings write, protected-route redirects, unauthorized cron rejection,
  and deny-all client rules.
- Runtime logs show no Firebase errors after the fix.
- Deployment details: [OPPORTUNITY_RADAR_VERCEL_DEPLOYMENT.md](../OPPORTUNITY_RADAR_VERCEL_DEPLOYMENT.md).
- Product scope and source coverage: [OPPORTUNITY_RADAR_SCOPE_ALIGNMENT.md](../OPPORTUNITY_RADAR_SCOPE_ALIGNMENT.md).

## Not yet complete

- GitHub Actions has no `APP_BASE_URL` or `CRON_SECRET` secrets and has never
  run.
- Telegram linking and delivery are untested live.
- Multi-user isolation is untested (one account available).
- Firestore contains no opportunities, so save/apply and eligibility have not
  been exercised against real data.
- The Supabase-to-Firestore data import has not run.
- Development-scope Vercel variables and reviewer access are not configured.

## Validation

- `npm run lint` passed.
- `npm run typecheck` passed.
- `npm test -- --runInBand` passed: 10 suites, 50 tests.
- `npm run build` passed.
- `npm run validate` passed.
- Admin `verifyIdToken` + `createSessionCookie` passed locally.
- Preview and Production session creation returned `200`; authenticated pages
  returned `200`.
- A temporary Firestore write/read/delete probe passed and was cleaned up.

## Next actions

1. Rotate the service-account key (it was shared in chat), update the Vercel
   variable, and redeploy.
2. Configure GitHub Actions secrets and run both workflows manually.
3. Configure reviewer emails/IDs and validate evidence review.
4. Validate Telegram with an approved test destination.
5. Run the migration preflight and import only after a verified backup.
