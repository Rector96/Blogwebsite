# FinSignal

Global **markets · fintech · personal finance** news wire.

- Real RSS (Yahoo Finance, Finextra, MarketWatch) + AI headlines (Gemini)
- Premium reading UI (not a local brochure layout)
- Supabase article store + newsletter capture
- Labeled sponsored / affiliate slots
- Cron-ready ingest: `GET/POST /api/cron/ingest?secret=...`

## Quick start

```bash
cp .env.example .env
# fill GEMINI_API_KEY, VITE_SUPABASE_*, CRON_SECRET, SUPABASE_SERVICE_ROLE_KEY
npm install
npm run dev
```

## Supabase

1. Run `supabase_schema.sql`
2. Run `supabase_newsletter.sql`

## cron-job.org

Point a job every 30–60 min at:

```
https://YOUR_HOST/api/cron/ingest?secret=YOUR_CRON_SECRET
```

Requires the **Node server** (`npm start` after build), not static-only Netlify unless you add Functions.

See `docs/GROWTH_AND_CRON.md` for the $1k/mo revenue path.
