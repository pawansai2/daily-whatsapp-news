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
Vercel-hosted Next.js app -> Supabase (Settings) -> Vercel Cron -> News API/RSS -> Meta WhatsApp Cloud API

## Local Development & Validation
- Mock mode must work without credentials
- Run `npm run validate` for checks
- Run `npm test` for tests

## Security
- All settings protected by Supabase RLS
- WhatsApp webhooks validated using Meta signature
- Daily cron requires authentication secret
- Strict rate limiting and input validation
