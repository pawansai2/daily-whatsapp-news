# Project Specification

## Product Requirements
- Private owner login
- Personal settings (interests, language, location, time, limits)
- Digest preview
- Deterministic AI-optional news processing
- WhatsApp settings control

## Architecture & Data Flow
Vercel -> Next.js -> Firebase Authentication / Cloud Firestore -> Telegram and Meta WhatsApp APIs
- Daily Cron invokes `/api/cron/daily-news`
- Webhook receives from Meta at `/api/whatsapp/webhook`

## Firestore Collections

The server-side Firebase data client retains the existing collection names and
row fields to preserve application behavior. User-owned documents are scoped
to the verified Firebase UID:

- `personal_settings`: One settings document per owner.
- `personal_interests`: Topic rows per owner.
- `sent_article_hashes`: Sent-story deduplication.
- `deliveries`: Delivery attempts and idempotency records.
- `inbound_messages`: Inbound command deduplication.
- `pending_confirmations`: Operations requiring user confirmation.
- `user_channels` and `telegram_link_tokens`: Telegram account linking.
- `opportunity_profiles` and `user_opportunity_tracking`: Private
  Opportunity Radar preferences and saved state.
- Opportunity source, evidence, and run collections: shared server-managed
  discovery data.

The Firestore client rules deny direct access. Server routes verify the
Firebase session cookie before using the Admin SDK for user-facing operations.
The Supabase-to-Firestore data import remains pending; see
[`FIREBASE_SETUP.md`](../FIREBASE_SETUP.md).

## WhatsApp Commands
- `LIST INTERESTS`, `ADD INTERESTS`, `REMOVE INTERESTS`, `UPDATE INTERESTS`
- `LIST LANGUAGES`, `UPDATE LANGUAGE <language>`
- `UPDATE LOCATION <location>`
- `UPDATE TIME <HH:MM>`
- `PAUSE`, `RESUME`, `STATUS`, `HELP`

## Retention Boundaries
- 7 days for article hashes
- 14 days for delivery logs
