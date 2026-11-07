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
Vercel-hosted Next.js app -> Firebase Authentication and Cloud Firestore -> scheduled jobs -> News API/RSS -> Telegram/Meta WhatsApp Cloud API

### Firebase backend

The app source now uses Firebase Authentication for email/password login and Firestore for server-side application data. Set the Firebase Admin service-account JSON only in an ignored local environment file or deployment secret manager; never commit or paste it into chat. Firestore client rules remain deny-all because application reads/writes use the verified server session and Admin SDK.

The one-time migration from Supabase is not yet run. The migration utility matches existing accounts by email, remaps their data ownership to Firebase UIDs, and refuses conflicting destination data. It requires the Firebase Admin credential and the Supabase source credentials; review [FIREBASE_SETUP.md](./FIREBASE_SETUP.md) before running it. Do not remove the source database until the import and verification succeed.

## Local Development & Validation
- Mock mode must work without credentials
- Run `npm run validate` for checks
- Run `npm test` for tests

## Security
- Protected pages and user routes verify Firebase session cookies
- Firestore client rules deny direct client access
- WhatsApp webhooks validated using Meta signature
- Daily cron requires authentication secret
- Admin SDK operations scope user data to the verified Firebase UID
