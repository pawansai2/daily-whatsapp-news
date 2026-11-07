# Opportunity Radar verification workflow

## Trust model

RSS/Atom discovery creates unverified leads. A reachable HTTPS page or an official-looking URL is not verification. No automated web search, page parsing, or machine-generated evidence is used to mark facts verified.

## Human review

The reviewer queue is available at `/admin/opportunities` to authenticated UUIDs listed in `OPPORTUNITY_REVIEWER_IDS` as comma-separated values. Access is not granted by self-registration. Reviewers record one fact, a source name, an HTTPS evidence URL, source type, a short excerpt, and a decision. A verified decision is accepted only for an `official` source type. Third-party reports, conflicts, and unverified findings are stored separately and do not overwrite existing fact values.

The action writes evidence, provenance, change history, and opportunity state through separate Supabase requests rather than one database transaction. A later write failure can leave earlier review records persisted; the action reports an error and logs the failed write code. Check review history before retrying.

## Fact input rules

- Lists: comma-separated values; enter `none` to explicitly verify no restriction/items.
- Graduation years: comma-separated integers from 1950 through 2100.
- Booleans: `true` or `false`.
- Team size: `min,max`, either bound may be omitted, or `none` to explicitly confirm no team-size limit.
- Dates: valid `YYYY-MM-DD`; submission deadline requires an ISO timestamp with timezone.
- Fees: enter a confirmed numeric amount, including `0` only when the official evidence confirms it is free.
- Experience restrictions: enter the quoted/faithful restriction or explicitly enter `none`, `no restrictions`, or `not applicable`.
- URLs: HTTPS only.

Reviewer validation checks shape and bounds, not whether an excerpt truly supports a value. That remains a human responsibility.

## Eligibility and digest gating

Eligibility requires verified education, graduation-year, branch, country, team-size, participation-mode, required-skill, and experience-restriction facts, plus sufficient user profile details. Unknown values remain unknown; free-text experience restrictions remain unresolved. Daily digest inclusion requires a source-backed opportunity, the user's explicit opportunity-digest preference, minimum score, and an `eligible` or `likely_eligible` result. The reviewer UI only marks individual fields as `official_source_partial`; it does not mark a whole opportunity `officially_verified`.

No live reviewer account or real evidence submission was tested.
