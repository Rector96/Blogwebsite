# FinSignal — path to ~$1,000 / month + cron-job.org

## What this product is

**FinSignal** is a global finance & fintech news wire: real RSS sources, AI-polished headlines, clear ads/sponsors, newsletter capture.

It is **not** a local brochure site. Design targets Bloomberg / FT / TechCrunch density and trust.

## Revenue mix (realistic toward $1k/mo)

| Channel | How | Rough path to $1k |
|---------|-----|-------------------|
| **Sponsored slots** | 2–4 labeled partner cards/week | 2 × $150–250 = $300–500 |
| **Affiliate** | High-yield cash, cards, brokerage (geo-compliant) | $100–300 with traffic |
| **Newsletter sponsor** | Weekly brief to email list | $200–400 once list >2–3k |
| **Display ads** | Later (Mediavine/AdSense) after traffic | Top-up |

Traffic needed: consistent publishing + SEO + social. Product alone does not print money without distribution.

## cron-job.org setup

1. Deploy site (Netlify) with env:
   - `CRON_SECRET`
   - `GEMINI_API_KEY` (optional but better headlines)
   - `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` (to persist articles)
   - `VITE_SUPABASE_*` for the frontend

2. Create job on [cron-job.org](https://cron-job.org):
   - **URL:** `https://YOUR_DOMAIN/api/cron/ingest?secret=YOUR_CRON_SECRET`
   - **Method:** GET or POST
   - **Schedule:** every 30 minutes (or hourly)
   - Optional header: `Authorization: Bearer YOUR_CRON_SECRET`

3. Cron hits the server, which:
   - Fetches Yahoo Finance / Finextra / MarketWatch RSS
   - AI-enriches titles
   - Upserts into Supabase `articles` when service role is set
   - Refreshes in-memory cache

**Note:** Pure static Netlify hosting does **not** run Express. Use:
- a Node host for `server.ts`, **or**
- Netlify Functions wrapping the same ingest logic later.

For local/dev: `npm run dev` then hit `http://localhost:3000/api/cron/ingest?secret=...`

## Customer value

- Fast scan of real market stories
- AI “why it matters” bullets
- Save stories (local)
- Newsletter for weekly digest
- Transparent sponsored offers (never disguised as news)

## Next ops checklist

- [ ] Run `supabase_schema.sql` (+ newsletter table)
- [ ] Set Netlify / host env vars
- [ ] Point cron-job.org at `/api/cron/ingest`
- [ ] Replace sample sponsors with real affiliate links
- [ ] Add Google Search Console + analytics
- [ ] Publish consistently; pitch 1 sponsor/week
