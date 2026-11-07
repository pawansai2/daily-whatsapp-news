# Opportunity Radar — test report

**Status date:** 2026-11-07
**Scope:** Local validation, preview deployment validation, and production end-to-end checks.

## Local checks

| Check | Result | Notes |
|---|---|---|
| `npm run lint` | Pass | Full-repository ESLint |
| `npm run typecheck` | Pass | `tsc --noEmit` |
| `npx jest --runInBand` | Pass | 10 suites, 50 tests |
| `npm run build` | Pass | 21 routes; proxy detected |
| `npm run validate` | Pass | lint + typecheck + tests + build |
| `npm ls jose` | Pass | `jose@4.15.9 overridden` under `firebase-admin → jwks-rsa` |
| Admin `verifyIdToken` + `createSessionCookie` with a real token | Pass | Confirms the credential and `jose` override |
| Temporary Firestore write/read/delete | Pass | `_integration_probe` cleaned up |
| Taxonomy classification tests | Pass | 9 categories, subcategories, domains, source hints, unknown stays null |
| Browse view/filter tests | Pass | Closing soon, verified, saved, expired, category, domain, fee, format, geography, deadline, query |

## Preview checks

| Check | Result |
|---|---|
| Build and deploy | Pass |
| Unauthenticated Telegram status | `401` (previously `500`) |
| Session creation with a real ID token | `200 {"status":"signed-in"}` |
| Authenticated dashboard, settings, opportunities, eligibility profile | `200` |
| Runtime logs | No Firebase errors |

## Production checks

| Check | Result |
|---|---|
| Deployment and alias | Pass |
| `/login` | `200` |
| `/dashboard` without session | `307 → /login` |
| Telegram status without session | `401` |
| Session creation | `200` |
| Telegram status with session | `200 {"connected":false,"username":null}` |
| Authenticated pages | `200`; `/admin/opportunities` `307` (not a reviewer) |
| Playwright sign-in | Pass; dashboard rendered |
| Settings save through the UI | Pass; `personal_settings` document created |
| Runtime logs | No errors; only Google Auth deprecation warnings |
| Firestore client access without auth | `403` |

## Regression coverage added

`test/firebase-server.test.ts`:

1. `createClient()` + `getClaims()` returns `AUTH_REQUIRED` with no session cookie and no Admin credential.
2. A stale session cookie without the Admin credential returns `INVALID_SESSION` instead of throwing.

Both pass. The auth boundary is evaluated before privileged initialization.

## Baseline comparison

The reported baseline was 29 passing tests. The current suite has **50** passing tests across **10** suites. No assertions were weakened.

## Not run

- Live Telegram linking, bot delivery, and digest sending.
- Two-user isolation (one account available).
- Opportunity save/apply against real opportunity data (none exists).
- GitHub Actions scheduled runs (repository secrets are not configured).
- Supabase → Firestore data import.

## Scope note

The category/domain taxonomy, unified views, extended filters, dashboard summary, and source seeding are covered by [OPPORTUNITY_RADAR_SCOPE_ALIGNMENT.md](./OPPORTUNITY_RADAR_SCOPE_ALIGNMENT.md). Category source coverage for non-research categories remains an operational gap, not a test failure.

## Notes

- The root-cause fix (`jose` override) is a dependency resolution change, not an application workaround; no TypeScript, lint, or build settings were disabled.
- The service-account key used for validation was supplied by the owner and is not committed. It should be rotated because it was shared in chat.
