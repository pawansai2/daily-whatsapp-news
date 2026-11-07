# Project State

## Current implementation

- Firebase Authentication is wired into the login form and HTTP-only session
  cookie flow.
- Protected pages, server actions, and user API routes verify the Firebase
  session; Firestore access is server-side through the Firebase Admin SDK.
- News settings, delivery history, Telegram linking, and Opportunity Radar
  persistence use Firestore collections.
- Firestore client rules remain deny-all.
- `scripts/migrate-supabase-to-firestore.mjs` provides a dry-run-first,
  non-destructive import that maps Supabase user IDs to existing Firebase UIDs
  by email and verifies imported records.
- Supabase schema files remain as historical source definitions until data
  migration and production verification are complete.

## Not yet complete

- The Supabase-to-Firestore data import has not run.
- Local Firebase Admin configuration was not present at the last environment
  check, so live Firebase Auth, Firestore, and deployment behavior are
  unverified.
- Supabase source credentials and the source database must remain available
  until the import is complete and verified.
- No commit, push, or deployment has been made for this cutover.

## Validation

- `npm run lint` passed.
- `npm run typecheck` passed.
- `npm test -- --runInBand` passed: 7 suites, 37 tests.
- `npm run build` passed before the final lazy-loading adjustment; rerun after
  the remaining changes.
- Migration utility syntax check passed.

## Next actions

1. Add a newly generated Firebase Admin service-account JSON privately to
   ignored `.env.local` and the deployment's Production secret settings.
2. Run the migration preflight, inspect source counts, then run the import.
3. Verify Firebase login, ownership-scoped data, Telegram, delivery jobs, and
   production behavior before removing the temporary Supabase importer and
   source credentials.
