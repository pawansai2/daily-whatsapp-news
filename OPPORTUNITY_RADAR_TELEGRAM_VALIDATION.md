# Opportunity Radar Telegram validation

## Implemented behavior

Qualified opportunities are included in the existing user's daily Telegram news digest; they are not sent as immediate push alerts. Each user must enable the opportunity digest and have an active verified Telegram connection. The user's profile threshold is applied, eligibility must be `eligible` or `likely_eligible`, and at most three matches are included. The digest labels these as matches with official-source evidence, not as whole-opportunity certification, and includes the title, score, eligibility label, deadline (or unknown), and HTTPS source.

The digest permits an opportunity-only message. If news retrieval fails, the dispatcher still attempts an opportunity digest; if neither news nor opportunities are available, the delivery is marked failed or skipped according to the fetch result. Existing delivery occurrence idempotency is preserved.

## Configuration and validation

- App environment variable: `TELEGRAM_BOT_TOKEN`.
- The existing global `NEWS_DIGEST_ENABLED=true` gate and Supabase server configuration are also required for the dispatcher route.
- Users must separately enable their daily digest, opportunity digest, and verified Telegram channel.
- Unit tests cover digest text, IDs, score/source display, Telegram length limits, and verification input parsing.

No Telegram token, bot API request, real chat, or live delivery/retry was tested. Do not send a bot token or private chat ID in chat. For live validation, configure a dedicated test bot and destination through the deployment's secret manager, then send only a user-approved test message.

## Not provided

- Immediate new-match push.
- Deadline, closing-soon, or material-change notifications.
- Independent opportunity alert retry worker. Failed daily sends use the existing delivery retry/idempotency behavior.
