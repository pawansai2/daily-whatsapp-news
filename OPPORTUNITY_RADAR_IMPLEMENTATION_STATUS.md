# Opportunity Radar implementation status

**Status date:** 2026-11-06  
**Scope:** Repository implementation and local validation only. No database migration or production operation was performed.

## Implemented in the working tree

- Official RSS/Atom source registry and source-isolated discovery, canonicalization, duplicate protection, and collection run history.
- Additive Supabase schema for canonical opportunities, source provenance, field evidence, changes, user profiles, tracking, and notification preferences.
- Profile-based eligibility evaluation and explainable scoring; unknown facts remain unknown rather than being inferred.
- Authenticated opportunity browsing, profile editing, and private saved/applied tracking.
- Reviewer allowlist and field-by-field manual verification with HTTPS source citation, excerpt, and review history. Individual facts may be partially verified; whole-opportunity official verification is intentionally not exposed.
- Verified, eligible opportunity matches in the daily Telegram digest, including opportunity-only messages and a fallback when news retrieval fails.
- Lifecycle refresh based only on verified dates.
- GitHub Actions schedule definitions for discovery and due digest dispatch.

## Not implemented or not proven

- Database migrations have not been applied; the production schema, RLS policies, and stored function are not live-validated.
- No live RSS source collection, Telegram Bot API send, GitHub Actions schedule, staging deployment, or production deployment was verified.
- No automatic source verification, web scraping, immediate deadline/change alerts, cross-source fuzzy merge, or active alert retry worker is provided.
- `officially_verified` for an entire opportunity is not assigned by the reviewer UI; field-level partial verification can qualify only if the eligibility evaluator has sufficient verified data.
- Email, reviewer UUID, and Telegram bot environment configuration are documented by variable name only and have not been verified.

## Operational blockers

- The local Supabase CLI could not connect because Docker Desktop's Linux engine was unavailable.
- A production or staging target and backup strategy have not been approved. Do not apply migrations without those prerequisites.
- GitHub scheduled workflows require `APP_BASE_URL` and `CRON_SECRET` repository secrets, and must be installed on the default branch before they can run.
- Live Telegram validation requires an explicitly configured test bot and destination; never paste credentials into chat or commit them.

See [database validation](./OPPORTUNITY_RADAR_DATABASE_VALIDATION.md), [verification workflow](./OPPORTUNITY_RADAR_VERIFICATION.md), [Telegram validation](./OPPORTUNITY_RADAR_TELEGRAM_VALIDATION.md), [scheduler](./OPPORTUNITY_RADAR_SCHEDULER.md), [deployment](./OPPORTUNITY_RADAR_DEPLOYMENT.md), and [test report](./OPPORTUNITY_RADAR_TEST_REPORT.md).
