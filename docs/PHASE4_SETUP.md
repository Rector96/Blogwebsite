# RWDNEWS Phase 4 setup

## Netlify environment variables

Keep these server-only:
- `PAYSTACK_SECRET_KEY` — Paystack Test Secret Key while testing, then replace with Live Secret Key when ready.
- `SUPABASE_SERVICE_ROLE_KEY`
- `ADMIN_PASSWORD`
- `ADMIN_SESSION_SECRET`

Existing variables:
- `PUBLIC_SITE_URL` — production RWDNEWS URL.
- `SUPABASE_URL` (or `VITE_SUPABASE_URL`)
- `VITE_SUPABASE_ANON_KEY`
- `CRON_SECRET`
- `GEMINI_API_KEY` if used by the live news enrichment.

Never put `PAYSTACK_SECRET_KEY` or the Supabase service-role key in frontend/VITE variables.

## Supabase

Run `supabase/migrations/20260919000100_rwdnews_global_monetization.sql` once in Supabase SQL Editor.

It creates:
- global traffic/event analytics
- country/city/device/browser attribution
- editorial controls
- sponsor payments in USD and NGN
- Paystack references/status
- admin audit logs
- USD + NGN sponsor fee fields

## Paystack webhook

After deploying the production site, set the Paystack webhook URL to:

`https://YOUR-RWDNEWS-DOMAIN/api/paystack/webhook`

The webhook validates Paystack's `x-paystack-signature` with `PAYSTACK_SECRET_KEY`.

## Sponsor payment flow

1. Advertiser selects a fixed RWDNEWS package in USD (global default) or NGN (Nigeria option).
2. RWDNEWS creates a server-side payment reference and initializes Paystack.
3. Paystack processes the payment.
4. RWDNEWS verifies the transaction and listens for `charge.success`.
5. A paid transaction appears in Admin → Monetization.
6. Admin verifies/activates the campaign.
7. The sponsor becomes visible only after activation and within its start/end dates.

## Global rate card

USD is the default public/global rate card. These are RWDNEWS list prices, not an exchange-rate conversion.

- Sidebar: $75 / 30 days
- In-feed: $100 / 30 days
- Homepage Featured: $150 / 30 days
- Homepage + Sidebar: $200 / 30 days
- Sponsored Article / Briefing: $150 / 30 days
- Premium Monthly: $300 / 30 days
- Newsletter sponsorship: $75 / issue by direct agreement

## Nigeria rate card

- Sidebar: ₦75,000 / 30 days
- In-feed: ₦100,000 / 30 days
- Homepage Featured: ₦150,000 / 30 days
- Homepage + Sidebar: ₦200,000 / 30 days
- Sponsored Article / Briefing: ₦150,000 / 30 days
- Premium Monthly: ₦300,000 / 30 days
- Newsletter sponsorship: ₦75,000 / issue by direct agreement

Paystack supports USD for eligible Nigeria-based businesses, but international/USD acceptance must be enabled on the Paystack account. Use Paystack Test Mode first. Do not switch the production key to Live until the complete test payment → webhook → verification → admin activation flow has been confirmed.
