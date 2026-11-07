# Opportunity Radar deployment checklist

## Current state

Implementation files and schedule definitions are in the local working tree. No migration was applied, no deployment was performed, and no remote scheduler or Telegram operation was tested.

## App configuration

Configure through the hosting provider's secret/environment manager; do not commit values:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SECRET_KEY`
- `CRON_SECRET`
- `NEWS_DIGEST_ENABLED=true` when the shared daily dispatcher is approved for use
- `TELEGRAM_BOT_TOKEN` for Telegram delivery
- `OPPORTUNITY_REVIEWER_IDS` with approved authenticated user UUIDs, comma-separated
- `APP_BASE_URL` for the scheduler workflow's GitHub Actions secret

Configure `NEWS_PROVIDER_MODE` and optional localization variables according to the existing digest deployment. No credentials were inspected or validated.

## Safe release sequence

1. Approve a staging project and backup/restore strategy.
2. Validate migrations and RLS in an isolated database; see [database validation](./OPPORTUNITY_RADAR_DATABASE_VALIDATION.md).
3. Deploy app code to staging, configure secrets, and confirm cron authentication rejects missing/invalid credentials.
4. Test reviewer access with an allowlisted account and denial with a non-allowlisted account.
5. Test one approved Telegram bot/chat, using a clear test destination and user-approved message.
6. Install the two workflows on the default branch and configure repository secrets; verify a manual run and inspect app/Actions logs.
7. Confirm a due digest and repeated invocation do not create duplicate deliveries before production rollout.
8. Apply production migrations only after explicit approval and a verified backup. No production migration is authorized by this document.

## Rollback and recovery

If app deployment fails, revert the app deployment while preserving database state. If a migration has already been applied, do not drop tables as an automatic rollback: opportunity/evidence/profile data may exist. Restore from a verified backup or plan a reviewed forward fix. Pause schedules by disabling the workflows or set the approved app gate to false; verify the result in Actions and application logs.
