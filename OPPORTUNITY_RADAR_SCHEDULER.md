# Opportunity Radar scheduler

## Checked-in schedule

Two GitHub Actions workflows are present:

| Workflow | Cadence | App route |
|---|---:|---|
| `.github/workflows/opportunity-discovery.yml` | Every 6 hours at minute 31 UTC | `/api/cron/opportunities` |
| `.github/workflows/daily-digest-dispatcher.yml` | Every 15 minutes | `/api/cron/dispatcher` |

Both also support manual `workflow_dispatch`. Each call uses HTTPS and `Authorization: Bearer <CRON_SECRET>`. The secret is passed from GitHub Actions secrets and is not stored in the repository.

## Setup and constraints

Configure these repository Actions secrets:

- `APP_BASE_URL`: HTTPS origin of the deployed app, without requiring a trailing slash.
- `CRON_SECRET`: same random value configured for the app.

Schedules only become active when workflow files are on the repository's default branch. The repository is public; these workflows use standard GitHub-hosted runners, whose cost/availability depends on GitHub's current public-repository policy and account settings. Scheduled event timing is best-effort; jobs may be delayed or missed. Neither cadence is a real-time guarantee.

Repeated invocations are expected: discovery has canonical URL uniqueness, while digest delivery uses occurrence idempotency and due-time checks. Review Actions logs and app logs for failures. Re-run a missed job manually only after confirming current route behavior and recent run/delivery records.

The workflows are committed to the local working tree only; no GitHub Actions run or remote schedule was verified.
