# Security & Setup

## Security controls

- Server-rendered pages, server actions, and user API routes verify Firebase
  session cookies with the Admin SDK.
- Firestore client rules deny direct client reads and writes. The Admin SDK
  bypasses these rules, so all user-owned queries and writes must be scoped to
  the verified Firebase UID.
- Firebase Admin service-account JSON is server-only and must be stored in an
  ignored local environment file or deployment secret manager.
- Meta WhatsApp webhook signatures and Telegram webhook secret tokens are
  validated.
- Scheduled routes require a cron bearer secret; delivery occurrences use
  deterministic Firestore document IDs and transactional updates.
- Opportunity reviewer access is restricted by configured reviewer emails or
  Firebase UIDs.

## Firebase setup

1. Enable Email/Password in Firebase Authentication.
2. Set `NEXT_PUBLIC_FIREBASE_API_KEY`, `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`,
   `NEXT_PUBLIC_FIREBASE_PROJECT_ID`, and `NEXT_PUBLIC_FIREBASE_APP_ID`.
3. Store `FIREBASE_ADMIN_SERVICE_ACCOUNT_JSON` privately for local development
   and in the deployment secret manager.
4. Configure Telegram, WhatsApp, scheduled jobs, and any optional AI/news
   providers through environment variables.
5. Follow [FIREBASE_SETUP.md](../FIREBASE_SETUP.md) for the guarded, one-time
   Supabase data import and its verification requirements.

The Supabase database and source credentials must remain available until the
import is complete and verified. Do not delete the source data as part of the
application code cutover.

## Final live test checklist

- [ ] Sign in with an existing Firebase Authentication account.
- [ ] Verify settings are scoped to that Firebase UID.
- [ ] Link, test, and disconnect a Telegram account.
- [ ] Verify migrated delivery history and user-owned records.
- [ ] Run scheduled delivery and opportunity jobs with their secrets configured.
- [ ] Confirm Firestore client access remains denied.
