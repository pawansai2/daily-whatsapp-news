# Opportunity Radar — Vercel deployment status

**Status date:** 2026-11-07

## 1. Current state

- Project: `pawansai/daily-whatsapp-news-3d5j`, linked to GitHub `pawansai2/daily-whatsapp-news`.
- Production branch: `main`. Production alias: `https://daily-whatsapp-news-3d5j.vercel.app`.
- The repaired build (lazy Firebase client + CommonJS-compatible `jose`) was deployed to Production on 2026-11-07 and the alias was updated successfully.
- The Opportunity Radar scope extension (taxonomy, unified views, extended filters, dashboard summary, source seeding) was then deployed to Preview and Production; the alias was updated again after an authenticated Preview check.
- Sign-in, session creation, Firestore reads, authenticated Opportunity Radar pages, and a settings write are verified on the production alias.
- Deployment Protection (Vercel Authentication) remains enabled for deployment-specific URLs; the public production alias is reachable.
- Node runtime: 24.x. No `vercel.json` overrides; Next.js defaults are used.

## 2. Deployments from this repair

| Deployment | Result | Notes |
|---|---|---|
| Preview 1 | Failed at runtime | Reproduced `ERR_REQUIRE_ESM` in `firebase-admin/auth`; used to confirm the root cause. |
| Preview 2 | Pass | `jose@4.15.9` override; session creation and authenticated pages returned `200`. |
| Production | Pass | Same build promoted; alias updated; Playwright sign-in and settings save verified. |
| Scope extension Preview | Pass | Taxonomy tabs, unified views, extended filters, and dashboard summary rendered; authenticated routes returned `200`. |
| Scope extension Production | Pass | Alias updated; `/opportunities`, `/dashboard`, `/settings/opportunities` returned `200` with the new views visible. |

## 3. Validation performed

- `vercel inspect` / runtime logs: no Firebase errors after the fix, only Google Auth deprecation warnings.
- `vercel curl` on the protected preview: unauthenticated `401`, authenticated `200` across the main app routes.
- Production public alias: same checks, plus a real Playwright browser sign-in and a settings save.
- Firestore client rules remain deny-all; unauthenticated REST access returns `403`.
- A temporary Firestore write/read/delete probe was cleaned up.

## 4. Environment scopes

| Variable | Production | Preview | Development |
|---|---|---|---|
| `FIREBASE_ADMIN_SERVICE_ACCOUNT_JSON` | Present | Present | Not set |
| `NEXT_PUBLIC_FIREBASE_*` | Not set (public fallback) | Not set (public fallback) | Not set |
| `CRON_SECRET` | Present | Not set | Not set |
| `TELEGRAM_BOT_TOKEN` | Present | Not set | Not set |
| `NEWS_DIGEST_ENABLED` | Present | Not set | Not set |

Variable changes apply only to new deployments. Redeploy after changing them.

## 5. Remaining deployment work

1. Rotate the service-account key (it was shared in the chat transcript), update `FIREBASE_ADMIN_SERVICE_ACCOUNT_JSON` in Production and Preview, and redeploy.
2. Add GitHub Actions repository secrets `APP_BASE_URL` (the production alias) and `CRON_SECRET`; run both workflows manually and inspect logs.
3. Configure `OPPORTUNITY_REVIEWER_EMAILS` or `OPPORTUNITY_REVIEWER_IDS` for the reviewer pages.
4. Run the Supabase → Firestore import only after confirming a backup and the source counts.
5. For future code changes, commit and push to `main` (or deploy with the Vercel CLI) so the GitHub integration keeps production current.

## 6. Rollback

Revert to the previous Vercel deployment while preserving Firestore data. Do not drop collections. Pause schedules by disabling the workflows or setting `NEWS_DIGEST_ENABLED=false`.

## 7. Cost

No paid Vercel feature, Firebase plan, Cloud Functions, or add-on was enabled. The deployment uses the existing free-tier configuration.
