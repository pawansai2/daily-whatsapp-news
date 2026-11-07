# Opportunity Radar database validation

**Status date:** 2026-11-06  
**Result:** Static review only. No migration was applied and no live schema was inspected.

## Migrations in scope

- `supabase/migrations/20261106230000_opportunity_data_foundation.sql`
- `supabase/migrations/20261106231000_seed_opportunity_rss_sources.sql`

The foundation migration adds opportunity, source, source-record, field-evidence, change-history, collection-run, profile, tracking, and alert-history tables. It enables RLS, grants authenticated users read access to public opportunity records, restricts profile/tracking rows by `auth.uid()`, reserves writes for `service_role`, and grants the lifecycle refresh function only to `service_role`. The source seed adds curated official feeds and no sample opportunities.

The lifecycle function uses only dates marked in `verified_fields`, preserves terminal cancelled/expired/postponed/closed states, and logs lifecycle changes. PostgreSQL execution, permissions, constraints, and query plans remain untested.

## Static risks and validation limits

- The Supabase CLI local status check failed because Docker Desktop's Linux engine pipe was unavailable. The SQL was not parsed or executed by PostgreSQL in this environment.
- No live database URL, migration history, schema, RLS behavior, database backup, or restore test was inspected.
- A pre-existing migration, `20260807213417_delivery_occurrence_model.sql`, backfills delivery occurrence fields and drops the old unique constraint matching owner, delivery type, and local delivery date. This is a meaningful constraint removal; confirm its deployed status and validate existing-row behavior before applying pending migrations.
- Rolling back the new foundation by dropping its tables would delete opportunity records, reviewer evidence, history, and user profile/tracking data. No rollback SQL is provided.
- Do not run `supabase db reset` against any database containing user data.

## Required before any apply

1. Select and explicitly approve a staging target.
2. Take and verify a restorable backup; record the current migration history.
3. Validate both migrations against the project's PostgreSQL/Supabase version in an isolated database.
4. Test anon/authenticated/service-role access, including two distinct users and row isolation.
5. Test the lifecycle function on representative verified and unknown date cases.
6. Review resulting schema and data before considering production application.

No action above was performed. See [deployment prerequisites](./OPPORTUNITY_RADAR_DEPLOYMENT.md).
