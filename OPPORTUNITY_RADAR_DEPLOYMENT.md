# Opportunity Radar deployment checklist

**Status date:** 2026-11-07

## Current state

The repaired application is deployed to Vercel Production at `https://daily-whatsapp-news-3d5j.vercel.app`. Sign-in, session creation, Firestore reads, and a settings write are verified. The original production failure was `ERR_REQUIRE_ESM` from `firebase-admin@14` → `jwks-rsa@4` → ESM-only `jose@6`; it is fixed by the `jose@4.15.9` override in `package.json`.

Remaining: GitHub Actions secrets are not configured and the workflows have never run; Telegram and multi-user isolation are untested; the Supabase import has not run.

See the detailed reports:

- [Firebase + Vercel audit](./OPPORTUNITY_RADAR_FIREBASE_VERCEL_AUDIT.md)
- [Firebase validation](./OPPORTUNITY_RADAR_FIREBASE_VALIDATION.md)
- [Vercel deployment status](./OPPORTUNITY_RADAR_VERCEL_DEPLOYMENT.md)
- [Database validation](./OPPORTUNITY_RADAR_DATABASE_VALIDATION.md)
- [Test report](./OPPORTUNITY_RADAR_TEST_REPORT.md)

## Required configuration (names only)

Configure through the hosting provider's secret/environment manager; never commit values:

- `FIREBASE_ADMIN_SERVICE_ACCOUNT_JSON` (server-only)
- `NEXT_PUBLIC_FIREBASE_API_KEY`
- `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
- `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
- `NEXT_PUBLIC_FIREBASE_APP_ID`
- `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` (optional)
- `CRON_SECRET`
- `TELEGRAM_BOT_TOKEN` (when Telegram delivery is enabled)
- `NEWS_DIGEST_ENABLED=true` when the dispatcher is approved for use
- `OPPORTUNITY_REVIEWER_EMAILS` (preferred) and/or `OPPORTUNITY_REVIEWER_IDS`
- `APP_BASE_URL` (GitHub Actions repository secret)

The historical Supabase runtime variables are needed only for the one-time data import described in [FIREBASE_SETUP.md](./FIREBASE_SETUP.md).

## Follow-up sequence

1. Rotate the service-account key (it was shared in chat), update the Vercel variable, and redeploy.
2. Back up/export Firestore and record current collection counts before any migration.
3. Configure GitHub Actions secrets `APP_BASE_URL` (production alias) and `CRON_SECRET`; run both workflows manually and inspect logs.
4. Configure reviewer access, then verify evidence review with a non-allowlisted account denied.
5. Verify one Telegram test destination with a user-approved message.
6. Confirm repeated digest invocations do not duplicate deliveries.
7. Run the Supabase import only after the source counts and destination backup are reviewed; verify UID ownership after import.

## Rollback and recovery

If a deployment fails, revert the Vercel deployment while preserving Firestore data. Do not drop collections as a rollback: opportunity evidence, profiles, and tracking data may exist. Restore from a verified export or plan a reviewed forward fix. Pause schedules by disabling the workflows or setting `NEWS_DIGEST_ENABLED=false`, then verify the result in Actions and application logs.
