# Security & Setup

## Threat Model & Security Controls
- RLS on Supabase (owner-only access)
- Meta WhatsApp Webhook signature validation
- Cron secret authentication
- Rate limiting and size limits
- Strict CSP and Security Headers
- AI isolation from sensitive data
- Idempotency locks for cron

## Supabase Setup
- Run SQL migration for tables and RLS
- Create owner account, disable public signup

## Meta Application Setup
- Configure phone number ID and access token
- Setup webhook with signature secret
- Create WhatsApp template for digest

## External Setup
- News API / Trusted RSS setup
- Optional AI config
- Vercel Env variables and Cron activation

## Final Live Test Checklist
- [ ] Preview mock digest
- [ ] Receive WhatsApp test message
- [ ] Reply with command to update settings
- [ ] Verify cron delivery
