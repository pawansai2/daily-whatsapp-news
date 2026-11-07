# Opportunity Radar — Security Report

**Scope:** current workspace implementation, read-only production checks already performed, and the changes in this pass.
**Secret handling:** names only; no secret values are reproduced here.

## Implemented controls

| Control | Status | Evidence |
|---|---|---|
| Firebase authentication | IMPLEMENTED / LIVE VERIFIED (prior pass) | Email/password sign-in and session creation worked against production. |
| Owner authorization | IMPLEMENTED / LOCALLY TESTED | `src/lib/auth/authorization.ts`; `OWNER_EMAIL` and/or `OWNER_UID`; fails closed. |
| Session issuance gate | IMPLEMENTED | `/api/auth/session` returns 403 for an authenticated but non-owner account. |
| Session re-check | IMPLEMENTED | `createClient().auth.getClaims()` rejects a non-owner session before any page/action data access. |
| Reviewer consistency | IMPLEMENTED | Admin page and action both use `isReviewerClaims`; owner is a reviewer. |
| Firestore client isolation | LIVE VERIFIED (prior pass) | `firestore.rules` denies direct client reads/writes; server uses Admin SDK. |
| Cron authentication | LIVE VERIFIED (prior pass) | Unauthenticated cron calls return 401 `INVALID_CRON_CREDENTIAL`; constant-time comparison. |
| Same-origin session POST | LIVE VERIFIED (prior pass) | Cross-origin POST returned 403. |
| Evidence URL validation | IMPLEMENTED | HTTPS only; credentials in URL rejected; reviewer decision required. |
| Lifecycle changes | IMPLEMENTED | Reason required; previous/new values written to `opportunity_changes`. |
| Secret separation | IMPLEMENTED | Admin credential is server-only; public Firebase config is separate; no `.env` tracked. |

## Environment secret-name checklist

Present or referenced by name only:

- `FIREBASE_ADMIN_SERVICE_ACCOUNT_JSON` — server-only Admin credential.
- `NEXT_PUBLIC_FIREBASE_*` — public client configuration (Production currently relies on the code fallback).
- `OWNER_EMAIL` / optional `OWNER_UID` — server-side owner allowlist.
- `OPPORTUNITY_REVIEWER_IDS` / `OPPORTUNITY_REVIEWER_EMAILS` — optional reviewer allowlist; not a substitute for owner login.
- `CRON_SECRET` — scheduler bearer secret.
- `TELEGRAM_BOT_TOKEN` — server-only bot credential.
- `TELEGRAM_CHAT_ID` — legacy single-chat identifier.
- `TELEGRAM_WEBHOOK_SECRET` — webhook verification.
- `PHONE_ENCRYPTION_KEY` — 32-character encryption key.
- `NEWS_PROVIDER_MODE`, `NEWS_DIGEST_ENABLED` — provider/feature configuration.
- Supabase legacy names remain in environments but Supabase is not used at runtime.

## Findings

### Resolved in this pass

- **HIGH:** any authenticated Firebase account could obtain a session. Now owner allowlist is enforced at issuance and on every server session check.
- **HIGH:** admin page and action used different reviewer rules. Now both use one helper.
- **HIGH:** reviewer page crashed on missing `first_discovered_at`. Discovery now writes it and the page formats safely.
- **MEDIUM:** reviewer configuration was required even for the owner. The owner is now a reviewer, so verification is reachable in the private deployment once deployed.

### New findings from this pass

- **LOW / INFO:** Devpost is a third-party API adapter with the public endpoint; its open-hackathon responses are labeled third-party and pending verification. It carries no auth key and is rate-limited at the platform level.
- **LOW / INFO:** Codeforces is a public, no-auth API. Responses are publicly scheduled contests; no platform identity is claimed.
- **MEDIUM:** Firestore adapter loads whole collections and applies filters/sorts in memory. No indexes or pagination. This is a scale and read-cost risk now that 56 opportunities persist.
- **MEDIUM:** no per-account rate limiting on authenticated Server Actions/API routes. The cron secret is the only scheduler gate.
- **MEDIUM:** production has no `NEXT_PUBLIC_FIREBASE_*`; the hardcoded public fallback hides project-configuration drift.

## Blocked / unverified

- **BLOCKED:** no production verification of the new owner gate because this release candidate is not deployed.
- **BLOCKED:** no authorized Telegram delivery test (zero linked users).

## Security acceptance

- **No secret leakage found.**
- **Owner-only access is implemented and locally tested.**
- **Production enforcement is not verified** until the release candidate is deployed and a non-owner account is tested and rejected.
- **Emulator-only:** Firestore persistence, ordering and replay were verified against a local emulator; client rules were not re-tested in this pass.
