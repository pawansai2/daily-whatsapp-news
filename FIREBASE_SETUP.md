# Firebase integration foundation

Firebase project `daily-whatsapp-news` is provisioned on the Spark plan. A web app named `daily-whatsapp-news-web` is registered, Email/Password Authentication is enabled, and the default Standard Firestore database was created in `asia-south1` (Mumbai) using production-mode rules. Google Analytics and Gemini were left disabled. The database is empty; no users or application data have been migrated.

The existing app still authenticates with Supabase and reads its current data from Supabase. Firebase is not yet a drop-in replacement backend.

## Configuration for another Firebase project

1. Create a Firebase project in the Firebase console and record its project ID.
2. Register a Web app in that project. Copy the API key, auth domain, project ID, and app ID into the `NEXT_PUBLIC_FIREBASE_*` variables in the local environment or deployment secret/configuration manager.
3. In Authentication, enable Email/Password only if that is the intended sign-in method. Do not change the active login page yet.
4. Create the default Cloud Firestore database in a selected region. Region choice is difficult to change later; choose based on the app's users and hosting region.
5. Keep Firestore locked down. The checked-in `firestore.rules` denies all client access until collection-specific rules and tests are added.
6. For server-side Firebase Admin use, create a dedicated service account with the minimum required project permissions and store its JSON in `FIREBASE_ADMIN_SERVICE_ACCOUNT_JSON` using a deployment secret manager or ignored local environment file. Do not commit the credential or paste it into chat.
7. Keep the service account project ID equal to `NEXT_PUBLIC_FIREBASE_PROJECT_ID`. The server helper rejects a mismatch.

## Available code

- `src/lib/firebase/client.ts` initializes a named Firebase app and exports client Auth and Firestore accessors.
- `src/lib/firebase/admin.ts` lazily initializes the Firebase Admin SDK and exports server Auth and Firestore accessors.
- `src/lib/firebase/config.ts` contains the registered app's public web configuration, supports complete environment overrides, and parses Admin service account JSON without logging credential values. Firebase Web API keys are public identifiers; access control must come from Auth and restrictive Firestore rules, not secrecy of this key.
- `firestore.rules` currently denies all client reads and writes.

The Admin SDK bypasses Firestore Security Rules. Before adding any Admin SDK operation, verify Firebase ID tokens or session cookies on the server, scope every query to the authenticated user, and test authorization boundaries. Never pass Admin SDK credentials to client code.

## Cutover prerequisites

Supabase email/password hashes cannot simply be reused by Firebase Authentication. Before replacing login, choose a user transition (approved account import/reset or a temporary staged login), decide how Firebase UIDs map to existing Supabase UUID rows, and decide how to preserve or intentionally leave behind settings and delivery history. No such decision or data movement is part of this foundation.

Before moving an existing collection from Supabase to Firestore, define document IDs, ownership rules, indexes, retention/rollback, and export/import validation. Use the Firebase Emulator Suite and staging project before any production writes. This repository does not yet include emulator tests, Firestore data repositories, or a migration script.
