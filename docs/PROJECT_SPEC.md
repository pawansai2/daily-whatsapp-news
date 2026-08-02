# Project Specification

## Product Requirements
- Private owner login
- Personal settings (interests, language, location, time, limits)
- Digest preview
- Deterministic AI-optional news processing
- WhatsApp settings control

## Architecture & Data Flow
Vercel -> Next.js -> Supabase -> Meta WhatsApp API
- Daily Cron invokes `/api/cron/daily-news`
- Webhook receives from Meta at `/api/whatsapp/webhook`

## Database Model (Supabase)
- `personal_settings`: One row, owner config.
- `personal_interests`: Many rows per owner.
- `sent_article_hashes`: 7-day retention.
- `deliveries`: 14-day retention.
- `inbound_messages`: Command deduplication.
- `pending_confirmations`: Operations requiring user confirmation.

## WhatsApp Commands
- `LIST INTERESTS`, `ADD INTERESTS`, `REMOVE INTERESTS`, `UPDATE INTERESTS`
- `LIST LANGUAGES`, `UPDATE LANGUAGE <language>`
- `UPDATE LOCATION <location>`
- `UPDATE TIME <HH:MM>`
- `PAUSE`, `RESUME`, `STATUS`, `HELP`

## Retention Boundaries
- 7 days for article hashes
- 14 days for delivery logs
