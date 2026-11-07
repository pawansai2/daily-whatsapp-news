# Opportunity Radar — Firebase validation

**Status date:** 2026-11-07
**Result:** Firebase Admin, session cookies, Firestore reads, and a Firestore write are verified in Production. Telegram, multi-user isolation, opportunity save/apply, and the Supabase import remain unverified.

## 1. Configuration

| Variable | Workspace | Vercel Production | Vercel Preview |
|---|---|---|---|
| `FIREBASE_ADMIN_SERVICE_ACCOUNT_JSON` | Not in `.env.local` | Present | Added during this repair |
| `NEXT_PUBLIC_FIREBASE_API_KEY` | Missing (public fallback used) | Not set (public fallback used) | Not set (public fallback used) |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | Missing (fallback) | Not set (fallback) | Not set (fallback) |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | Missing (fallback) | Not set (fallback) | Not set (fallback) |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | Missing (fallback) | Not set (fallback) | Not set (fallback) |

The committed fallback resolves to the correct Firebase project (`daily-whatsapp-news`) and web app, so the deployed client works. The Admin credential was used locally only from the owner-supplied file, never written into the repository.

## 2. Verified checks

### Local

| Check | Result |
|---|---|
| `npm run lint` | Pass |
| `npm run typecheck` | Pass |
| `npx jest --runInBand` | Pass — 9 suites, 42 tests |
| `npm run build` | Pass — 21 routes |
| `npm run validate` | Pass |
| Admin `verifyIdToken` with a real ID token | Pass |
| Admin `createSessionCookie` | Pass |
| Firestore read (collection list and counts) | Pass |
| Temporary Firestore write/read/delete (`_integration_probe`) | Pass; cleaned up |

### Preview deployment

| Check | Result |
|---|---|
| Build and deploy | Pass |
| Unauthenticated `/api/telegram/status` | `401` (previously `500`) |
| `POST /api/auth/session` with a real ID token | `200 {"status":"signed-in"}` |
| Authenticated `/dashboard`, `/settings`, `/opportunities`, `/settings/opportunities` | `200` |
| Runtime logs | No Firebase errors |

### Production deployment

| Check | Result |
|---|---|
| Deployment and alias update | Pass (`daily-whatsapp-news-3d5j.vercel.app`) |
| `/login` | `200` |
| `/dashboard` without session | `307 → /login` |
| `/api/telegram/status` without session | `401` |
| `POST /api/auth/session` | `200` |
| `/api/telegram/status` with session | `200 {"connected":false,"username":null}` |
| Authenticated `/dashboard`, `/settings`, `/opportunities`, `/settings/opportunities` | `200` |
| `/admin/opportunities` | `307` — signed-in account is not a configured reviewer |
| Playwright browser sign-in | Pass; dashboard rendered with "Telegram not connected" |
| Settings save through the UI | Pass; one `personal_settings` document created and read back |
| Runtime logs | No errors; only Google Auth deprecation warnings |

## 3. Firestore state observed

- Before validation: no top-level collections.
- After the settings save: `personal_settings` contains one document owned by the signed-in account.
- No opportunities, sources, evidence, delivery records, or Telegram channels exist yet.
- A temporary `_integration_probe` document was created and deleted; it no longer exists.

## 4. Not verified

- Telegram linking, bot delivery, and digest inclusion.
- Two-user isolation (only one account is available).
- Opportunity save/apply and eligibility behavior against real opportunity records.
- Scheduled discovery and digest runs (repository Actions secrets are missing).
- The one-time Supabase → Firestore import.
- Development-scope Vercel variables.

## 5. Follow-up required

1. Rotate the service-account key, because it was shared in the chat transcript. Update `FIREBASE_ADMIN_SERVICE_ACCOUNT_JSON` in Vercel and redeploy after rotation.
2. Set GitHub Actions repository secrets `APP_BASE_URL` and `CRON_SECRET`, then run both workflows manually.
3. Configure `OPPORTUNITY_REVIEWER_EMAILS` or `OPPORTUNITY_REVIEWER_IDS` if the signed-in account should review evidence.
4. Validate Telegram with an approved test destination and a user-approved message.
5. Validate isolation with a second test account in a staging project before enabling broader use.
