# Opportunity Radar — database validation

**Status date:** 2026-11-07
**Result:** The runtime database is Cloud Firestore. Admin connectivity, read access, and a write/read/delete probe were validated on 2026-11-07, and an application-level settings write was verified in Production.

## 1. Active runtime database: Firestore

The application now reads and writes through the Firebase Admin SDK (`src/lib/firebase/store.ts`) against Cloud Firestore. Collections retain the former table names: settings, interests, delivery records, inbound messages, user channels, Telegram link tokens, opportunity profiles/tracking, sources, evidence, changes, and collection runs.

Verified:

- Firebase project `daily-whatsapp-news` exists and matches the committed web app configuration.
- Firestore Native database `projects/daily-whatsapp-news/databases/(default)` exists.
- Client rules are deny-all: an unauthenticated REST read returns `403`.
- Admin SDK connectivity works: collection listing and document reads succeeded with the runtime service account.
- A temporary `_integration_probe` document was created, read back, and deleted. It no longer exists.
- A settings save through the production UI created one `personal_settings` document owned by the signed-in account.

Not verified:

- Collection contents beyond the settings document, document ownership fields, or index requirements.
- Read/write/update/delete through the adapter with a real credential.
- Two-user isolation, session-scoped queries, or migration completeness.
- Delivery occurrence idempotency against live documents.

The only persistent change was the account's own settings document created through the application. The temporary probe document was removed.

## 2. Historical Supabase schema (not the runtime database)

The SQL files under `supabase/migrations/` are retained as the historical source definition for the one-time Firebase import. They are **not applied to any confirmed live database** and are not used by the running application.

- `20260802110457_initial_schema.sql`
- `20260807213417_delivery_occurrence_model.sql`
- `20260809213053_multi_user_foundation.sql`
- `20260809214617_secure_telegram_linking.sql`
- `20261106230000_opportunity_data_foundation.sql`
- `20261106231000_seed_opportunity_rss_sources.sql`

Static risks documented previously still apply if the Supabase path is ever exercised:

- `20260807213417` drops a unique constraint after backfilling delivery occurrence fields; confirm behavior before applying.
- The opportunity foundation enables RLS and reserves writes for `service_role`; applying it without those grants would break the reviewer flow.
- Rolling back by dropping opportunity tables would delete evidence, history, profile, and tracking data.
- `supabase db reset` must never target a database containing user data.

## 3. Migration safety

`scripts/migrate-supabase-to-firestore.mjs` remains a dry-run-first, additive importer that maps Supabase user IDs to Firebase UIDs by email. It has not been run. It must not be run until:

1. every source account exists in Firebase Authentication with the same email;
2. the Firestore target is empty or exactly matches the source;
3. a verified backup/export exists;
4. record counts and critical fields are compared after import;
5. user ownership and date fields are spot-checked;
6. the source remains available until verification completes.

No destructive production database action is authorized.

## 4. Required before database sign-off

1. Configure the Admin service account in the deployment environment.
2. Run an authenticated read of each collection and compare counts with the source.
3. Exercise settings, delivery history, Telegram link tokens, opportunity profile, and saved/applied tracking.
4. Verify user A cannot read or modify user B's documents.
5. Confirm client access remains denied.
6. Record the results here with dates and counts (no personal data).
