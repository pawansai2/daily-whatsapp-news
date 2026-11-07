# Firebase application backend

The application uses Firebase Authentication for email/password sign-in and
Cloud Firestore for application data. Server-side reads and writes use the
Firebase Admin SDK; Firestore client rules remain deny-all in
[`firestore.rules`](./firestore.rules). The Admin SDK bypasses those rules, so
authenticated server routes must verify the Firebase session cookie and scope
user data to the verified Firebase UID.

## Required configuration

Set these variables in an ignored local environment file and in the deployment
secret manager:

- `NEXT_PUBLIC_FIREBASE_API_KEY`
- `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
- `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
- `NEXT_PUBLIC_FIREBASE_APP_ID`
- `FIREBASE_ADMIN_SERVICE_ACCOUNT_JSON`

The web configuration for the provisioned Firebase app is available as a
fallback, but configuring the public variables explicitly is recommended.
The Admin service-account JSON is private. Never commit it, print it, or paste
it into chat. Its project ID must match `NEXT_PUBLIC_FIREBASE_PROJECT_ID`.

Email/Password Authentication must be enabled in Firebase Authentication.
Server-side app requests require the Admin credential to verify session
cookies; login will not complete if that credential is unavailable.
Set `OPPORTUNITY_REVIEWER_EMAILS` to a comma-separated list of reviewer
emails for the evidence-review page. `OPPORTUNITY_REVIEWER_IDS` may still be
used when it contains current Firebase UIDs.

## Data migration from Supabase

The migration utility is a one-time source importer, not a production runtime
dependency. It copies application collections, remaps `owner_id` and `user_id`
references from Supabase UUIDs to Firebase UIDs by matching account email, and
verifies imported documents and collection counts. It does not delete or alter
the Supabase source.

Firebase Auth passwords are not copied. Every Supabase account must already
exist in Firebase Authentication with the same email address before importing.
Existing Firebase accounts keep their existing credentials.

1. Keep the Supabase project and source data available during migration.
2. Set `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SECRET_KEY` locally, along with
   the Firebase variables above. Do not put these secrets in chat or source
   control.
3. Ensure Firestore is empty, or contains only documents that exactly match
   the source. The importer refuses to overwrite different data or delete
   extra documents.
4. Run `npm run migrate:firebase` for a read-only preflight. It reports counts
   without writing.
5. After reviewing the counts, run
   `npm run migrate:firebase -- --apply`. The import is additive and can be
   rerun safely when the existing documents match the source.
6. Confirm post-import collection counts and test sign-in, user settings,
   Telegram linking, delivery history, and scheduled jobs in staging.
7. After production verification, remove the Supabase source credentials and
   migration-only dependency/tooling in a separate cleanup.

The migration stops before writing if a source collection cannot be read, an
account has no matching Firebase user, or the target contains conflicting
documents. No production migration should be claimed complete until the
preflight, import, and post-import verification succeed.

## Authentication and ownership

The login form signs in with the Firebase Web SDK and exchanges the ID token
for an HTTP-only, secure-in-production session cookie. Server components,
actions, and API routes verify that cookie with Firebase Admin. Firestore
collections retain the existing table names and row fields; user-owned rows
must use the verified Firebase UID in their ownership fields.

`src/lib/firebase/client.ts` initializes the Web SDK.
`src/lib/firebase/admin.ts` initializes the Admin SDK.
`src/lib/firebase/server.ts` verifies server sessions and exposes the
server-only Firestore data client.

## Vercel runtime dependency note

`firebase-admin@14` depends on `jwks-rsa@4`, which loads the ESM-only `jose@6`
with CommonJS `require()`. Vercel's serverless runtime loads `firebase-admin`
as an external CommonJS module, so that import fails with `ERR_REQUIRE_ESM` and
every Auth route breaks. `package.json` therefore pins `jose` to `4.15.9` via
`overrides`. Do not remove this override while `firebase-admin` remains on v14;
re-test Production sign-in before changing either package.
