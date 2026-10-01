# SastraNet Deployment Guide (Vercel)

## 1. Environment Variables
In your Vercel Project Settings, configure:
- `MONGODB_URI`: Production connection string to MongoDB Atlas
- `BETTER_AUTH_SECRET`: Random 32-character base64 secret
- `BETTER_AUTH_URL`: Canonical domain (e.g. `https://workspace.sastranet.com`)
- `NEXT_PUBLIC_APP_URL`: Canonical domain
- `N8N_WEBHOOK_URL`: Your hosted n8n webhook instance URL
- `N8N_WEBHOOK_SECRET`: Shared HMAC signing secret

## 2. Cron Jobs
Configured via `vercel.json`:
- Hourly: `/api/cron/sprint-check`
- Daily: `/api/cron/rust-update`
- Weekdays: `/api/cron/feedback-reminders`

## 3. Database Indexes
Run once against the production cluster:
```bash
npx tsx scripts/setup-indexes.ts
```
