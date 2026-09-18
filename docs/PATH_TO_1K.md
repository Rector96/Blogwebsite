# FinSignal — path to ~$1,000 / month

## Honest equation

```
Revenue ≈ (Sponsored slots sold) + (Affiliate commissions) + (Newsletter sponsors)
```

Code stores content, captures emails, serves labeled ads, and tracks clicks.
**You still need traffic + sales outreach.**

## Monthly model (example)

| Line item | Qty | Price | Total |
|-----------|-----|-------|-------|
| Sidebar sponsor | 2 | $250 | $500 |
| In-feed sponsor | 1 | $300 | $300 |
| Affiliate | — | — | $100–200 |
| Newsletter mention | 1 | $150 | $150 |
| **Total** | | | **~$1,050–1,150** |

## What the SQL gives you

| Table | Purpose |
|-------|--------|
| `articles` | Live wire from cron + RSS |
| `newsletter_subscribers` | List to monetize |
| `sponsors` | Paid offers (edit in Supabase) |
| `sponsor_clicks` | Which CTAs work |
| `sales_leads` | Media-kit inquiries |

## Operating cadence

1. **Daily:** cron keeps articles fresh.
2. **Weekly:** send brief to list (Resend/Buttondown later).
3. **Weekly:** pitch 3–5 fintech/finance brands for a slot.
4. **Monthly:** review `sponsor_clicks` + swap weak offers.

## Pricing you can quote today

- Sidebar 30 days: **$200–300**
- In-feed 30 days: **$250–400**
- Newsletter one-mention: **$100–200** (until list is larger)

Raise prices as traffic and list grow.
