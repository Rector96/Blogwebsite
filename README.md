# RWDNEWS

Source-backed **global news · trends · briefings** platform.

## Reach ~$1k/month (infrastructure)

| Piece | Status |
|-------|--------|
| Premium news UI | Done |
| RSS + AI + cron ingest | Done (`/api/cron/ingest`) |
| Supabase articles + newsletter + **sponsors** + clicks + sales leads | **Run `supabase_master.sql`** |
| Labeled partner slots | Done (DB-driven when connected) |
| Media kit lead form | Done |

You still need: **production secrets**, **cron ingestion**, **AdSense approval or real sponsors**, and **traffic**. Revenue is a target, not a guarantee.

See `docs/PATH_TO_1K.md` and `docs/GROWTH_AND_CRON.md`.

## 1. SQL (required)

Supabase → SQL Editor → paste **entire** file:

**`supabase_master.sql`**

## 2. Env

```bash
cp .env.example .env
```

```
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
GEMINI_API_KEY=
CRON_SECRET=
```

## 3. Run

```bash
npm install
npm run dev
```

Production:

```bash
npm run build && npm start
```

## 4. cron-job.org

```
https://YOUR_HOST/api/cron/ingest?secret=YOUR_CRON_SECRET
```

Every 30–60 minutes.

## 5. Sell inventory

Edit rows in Supabase table **`sponsors`** (headline, cta_url, monthly_fee_usd, active).
Watch **`sponsor_clicks`** and **`sales_leads`**.


## Admin

The private dashboard is at `/admin`. It uses a server-side password and HttpOnly session cookie; never put the admin password in a Vite `VITE_*` variable.

Required Netlify variables:
- `ADMIN_PASSWORD`
- `ADMIN_SESSION_SECRET`
- `SUPABASE_SERVICE_ROLE_KEY`

The dashboard shows engagement totals, sponsor inventory and advertiser leads.

## Ads

RWDNEWS now has real AdSense-ready slots, but ads remain disabled until the site has an approved AdSense account and real publisher/ad-unit IDs. Do not invent publisher IDs or ads.txt entries.

Google requires site approval before ads can serve, and global traffic may require a certified consent-management setup for personalized ads in the EEA, UK and Switzerland.

