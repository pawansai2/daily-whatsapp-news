# Personal Daily Intelligence Assistant

## Product Objective
A private, single-owner Personal Daily Intelligence Assistant that delivers a daily personalized news digest via WhatsApp.

## Scope (Version 1)
- Private owner login
- One personal settings profile
- One saved WhatsApp number
- Configurable news interests and language
- Daily delivery time and story limits
- WhatsApp digest with original source links

## Architecture
Vercel-hosted Next.js app -> Supabase (current auth and existing app data; staged cutover) + Firebase Authentication/Cloud Firestore (new integration foundation) -> scheduled jobs -> News API/RSS -> Telegram/Meta WhatsApp Cloud API

### Firebase foundation

Firebase client and Admin SDK setup is being introduced for Authentication and Cloud Firestore. The registered `daily-whatsapp-news` web app's public configuration is the default; `NEXT_PUBLIC_FIREBASE_*` values can override it for another environment. Follow [FIREBASE_SETUP.md](./FIREBASE_SETUP.md) before configuring server-side Admin access. Store service-account JSON only in the deployment's secret manager or an untracked local environment file; never commit it. The initial [Firestore rules](./firestore.rules) deny all client access until a collection and authorization model is deliberately added.

The current login and existing Supabase-backed settings/news data remain unchanged during this foundation phase. No user or data migration has occurred. Firebase/Supabase account identity mapping and the eventual cutover must be planned before switching existing sign-in or protected data access.

## Local Development & Validation
- Mock mode must work without credentials
- Run `npm run validate` for checks
- Run `npm test` for tests

## Security
- All settings protected by Supabase RLS
- WhatsApp webhooks validated using Meta signature
- Daily cron requires authentication secret
- Strict rate limiting and input validation
