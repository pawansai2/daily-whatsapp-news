# Opportunity Radar — Zero-Cost Assessment

**Constraint:** strictly ₹0. No paid API, paid AI model, Firebase Blaze migration, paid Vercel feature, paid scheduler or new paid dependency was enabled in this pass.

## Service-by-service assessment

| Service | Current use | Plan verification | Free limits / cost risk | ₹0 verdict |
|---|---|---|---|---|
| GitHub Actions | Discovery + digest workflows | Repository is PUBLIC; zero runs, zero secrets | Standard runners are free for public repositories within fair-use limits | **₹0 likely** |
| Vercel hosting/functions | Production Next.js deployment | Plan not queried; no billing check performed | Hobby is free but non-commercial; function duration/bandwidth limits apply. No Vercel Cron is configured | **₹0 plausible, plan unverified** |
| Firebase Authentication | Owner sign-in | Plan/billing not queried | Email/password is usable on the free tier; one Auth user observed | **₹0 likely** |
| Cloud Firestore | Settings; opportunity tables empty | Plan/billing not queried | Free quota applies on Spark; no Blaze migration was made. Full-collection scans increase reads as data grows | **₹0 likely today, unverified** |
| Telegram Bot API | Digest delivery and linking | Free service | No API charge; message limits apply | **₹0** |
| NASA / GOV.UK / We Work Remotely / Remotive RSS | Source collection | Public feeds, live-tested | No direct charge. Third-party terms/rate limits still apply | **₹0** |
| News provider | Existing news digest | `NEWS_PROVIDER_MODE` present but its value was not inspected | A paid NewsAPI tier is possible; this is the main external cost risk | **UNVERIFIED** |
| AI/localization | Existing optional adapter | No AI variables appeared in the Production environment listing | Must remain optional; do not add a paid model | **₹0 currently, unverified code path** |
| Vercel Cron | Not used | No `vercel.json` | Avoids a potential paid scheduling feature | **₹0** |

## Evidence

- Repository visibility: **PUBLIC**.
- GitHub Actions runs: **0**; repository secrets: **0**.
- Vercel production deployment: existing build only; no new deployment in this pass.
- Firestore: one `personal_settings` document; all opportunity/tracking/delivery collections are empty.
- Telegram bot identity and webhook were valid in the prior audit; no message was sent.
- No new package was added. The existing dependency set was used.

## Cost risks that must be confirmed manually

1. Firebase project plan and whether billing is enabled.
2. Vercel plan and whether the account is commercial/Hobby-eligible.
3. The actual `NEWS_PROVIDER_MODE` value and whether it selects a paid provider tier.
4. Firestore read growth once discovery persists feeds; the adapter currently reads whole collections.
5. Third-party job-board terms if collection frequency increases.

## Conclusion

**₹0 operation is plausible and no paid feature was enabled, but it is not certified.** Without access to the Firebase billing console, Vercel plan and the news-provider configuration, the safe statement is: **no known charge was introduced; plan-level ₹0 remains unverified.**
