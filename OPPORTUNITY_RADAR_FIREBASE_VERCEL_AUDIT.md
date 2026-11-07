# Opportunity Radar — Firebase + Vercel integration audit

**Audit date:** 2026-11-07
**Result:** Repaired and deployed. Production sign-in, session creation, Firestore reads, and a settings write now work. The original failure was a Firebase Admin v14 / `jose` ESM incompatibility in the Vercel CommonJS runtime, not a bad credential.

No secret values appear in this document.

## 1. Repository baseline

- Repository root: this project. Remote: `pawansai2/daily-whatsapp-news` (public).
- Branch: `main`, commit `0614c4b` before this session.
- Framework: Next.js 16.2.12 (App Router), React 19.2.8.
- Firebase SDKs: `firebase` 13.2.0 (Web), `firebase-admin` 14.5.0 (server).
- Supabase packages remain only for the one-time data importer.
- Git working tree was clean at the start of the audit.

## 2. Firebase architecture

| Layer | File | Behaviour |
|---|---|---|
| Web SDK | `src/lib/firebase/client.ts` | Client-only singleton for Auth and Firestore. |
| Web config | `src/lib/firebase/config.ts` | Reads `NEXT_PUBLIC_FIREBASE_*`, with a hardcoded public web config fallback for `daily-whatsapp-news`. |
| Admin SDK | `src/lib/firebase/admin.ts` | Server-only singleton; reads `FIREBASE_ADMIN_SERVICE_ACCOUNT_JSON`, validates fields, converts escaped newlines, and checks the project ID. |
| Session | `src/lib/firebase/server.ts` | Verifies the `__session` cookie and creates the Firestore client lazily. |
| Data access | `src/lib/firebase/store.ts` | Server-side Firestore adapter; privileged access depends on explicit ownership scoping in routes. |
| Rules | `firestore.rules` | Deny-all for client access; verified live (`403`). |

Authentication flow: Firebase Web SDK sign-in → ID token → `/api/auth/session` → Admin SDK `verifyIdToken` + `createSessionCookie` → HTTP-only cookie → server verification on protected routes.

## 3. Vercel architecture

- Project: `pawansai/daily-whatsapp-news-3d5j` (team `pawansai`), linked to the GitHub repository.
- Production alias: `https://daily-whatsapp-news-3d5j.vercel.app`.
- Deployment Protection (Vercel Authentication) remains enabled for deployment-specific URLs. Protected previews were verified with the CLI-authenticated `vercel curl`.
- Node runtime: 24.x. No `vercel.json` overrides; Next.js defaults are used.
- Vercel CLI was initially unauthenticated (invalid token). It was authenticated through the device flow for this repair, and the project was linked locally.
- Environment inventory (names only):
  - `FIREBASE_ADMIN_SERVICE_ACCOUNT_JSON` — present in Production (created before this session) and added to Preview during this repair.
  - `CRON_SECRET`, `TELEGRAM_BOT_TOKEN`, `NEWS_DIGEST_ENABLED`, `NEWS_PROVIDER_MODE`, and the legacy Supabase variables — present in Production.
  - `NEXT_PUBLIC_FIREBASE_*` — not set in Vercel; the committed public web config fallback is used.
  - GitHub Actions repository secrets `APP_BASE_URL` and `CRON_SECRET` — **not set**.

## 4. Root cause

### 4.1 Primary: `ERR_REQUIRE_ESM` in the Vercel runtime

Production and Preview runtime logs showed:

```
firebase_session_create_failed {
  message: 'Failed to load external module firebase-admin-…/auth:
  Error [ERR_REQUIRE_ESM]: require() of ES Module …/node_modules/jose/dist/webapi/index.js
  from …/node_modules/jwks-rsa/src/utils.js not supported.'
}
```

Chain: `firebase-admin@14.5.0` → `jwks-rsa@4.1.0` → `jose@6` (ESM-only). `jwks-rsa` loads `jose` with CommonJS `require()`. Vercel's serverless bundle externalizes `firebase-admin` and loads it from a CommonJS context where `require()` of that ESM module fails. Loading `firebase-admin/auth` is enough to trigger the import, so every session verification and Firestore-backed authenticated route failed.

Local Node 24 supports `require()` of ESM, which is why the defect did not reproduce locally and why the production build succeeded.

### 4.2 Secondary: eager privileged initialization

`createClient()` constructed the Firestore data client eagerly, before checking the session cookie. Unauthenticated requests therefore crashed with `500` instead of returning `401`. Repaired by lazy initialization.

### 4.3 Not a credential problem

`FIREBASE_ADMIN_SERVICE_ACCOUNT_JSON` was present in Production, and the supplied service account authenticates and has Firestore read/write access. The earlier `401` on `/api/auth/session` was the ESM failure being caught by the route's error handler.

## 5. Repair

1. `package.json`: added `"jose": "4.15.9"` to `overrides`. This resolves `jwks-rsa`'s `jose` dependency to the CommonJS-compatible v4 line while keeping `firebase-admin@14.5.0`. Regenerated `package-lock.json`; `npm ls jose` confirms `jose@4.15.9 overridden` under `firebase-admin → jwks-rsa`.
2. `src/lib/firebase/server.ts`: lazy Firestore client construction, so authentication is checked first.
3. `test/firebase-server.test.ts`: regression tests for unauthenticated and stale-session requests without Admin configuration.
4. Added the Admin credential to the Vercel **Preview** environment (Production already had it) so the repaired build could be validated before production.
5. Deployed a Preview, validated it, then deployed to Production and verified the alias.

## 6. Live validation evidence

| Check | Result |
|---|---|
| Admin SDK `verifyIdToken` + `createSessionCookie` (local, real credential) | Pass |
| Preview unauthenticated `/api/telegram/status` | `401` (was `500`) |
| Preview session creation with a real ID token | `200 {"status":"signed-in"}` |
| Preview authenticated `/dashboard`, `/settings`, `/opportunities`, `/settings/opportunities` | `200` |
| Production `POST /api/auth/session` | `200` |
| Production authenticated `/api/telegram/status` | `200 {"connected":false,"username":null}` |
| Production authenticated pages | `200`; `/admin/opportunities` `307` (account is not a reviewer) |
| Playwright browser sign-in on production | Pass; dashboard renders |
| Settings save through the app | Pass; `personal_settings` document created |
| Temporary Firestore write/read/delete probe | Pass; cleaned up |
| Runtime logs after the fix | No errors (only Google Auth library deprecation warnings) |

## 7. Security findings and required follow-up

- **The service-account private key was pasted into the chat transcript by the owner.** It is not committed to the repository, but it should be considered exposed. Rotate the key in Google Cloud IAM after the integration is confirmed, update `FIREBASE_ADMIN_SERVICE_ACCOUNT_JSON` in Vercel, redeploy, and delete the downloaded JSON file.
- No private key, service-account JSON, bearer secret, or bot token is present in the tracked tree or git history.
- The hardcoded Firebase **web** configuration is a public client configuration, not a secret. Firestore rules remain deny-all and were verified live.
- The repository is public. The web API key can be restricted in Google Cloud Console if desired; authorization does not depend on it.
- The production app's settings document was created by the owner's own settings save during validation. No fake opportunities were inserted.

## 8. Remaining limitations

1. GitHub Actions has no `APP_BASE_URL` or `CRON_SECRET` repository secrets and has never run, so discovery and digest schedules are inactive.
2. Telegram linking/delivery was not exercised live.
3. User isolation was not tested with two accounts; only one account is available.
4. Opportunity save/apply and digest eligibility were not exercised live because Firestore contains no opportunities.
5. The one-time Supabase → Firestore import has not run. The Firestore database was empty before the settings save.
6. Development-scope Vercel variables were not configured; only Production and Preview were needed for the deployed app.
