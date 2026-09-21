# RWDNEWS → Make.com social posting (Step 5)

This connects your news ingest to Facebook / X / Instagram / LinkedIn via **Make.com**.

You do **not** paste other people’s full articles. Each post is:

- Your **RWDNEWS headline**
- Short **bullet briefing** (your summary)
- Link to **your** story page (`rwdnews.netlify.app/news/...`)
- Optional image from the feed thumbnail / Unsplash (hotlinked, not re-hosted as your photo)

---

## 1. Create a Make.com scenario

1. Go to [https://www.make.com](https://www.make.com) and sign in.
2. **Create a new scenario**.
3. Click the big **+** and search for **Webhooks → Custom webhook**.
4. Click **Add** → name it `RWDNEWS Social` → **Save**.
5. Click **Copy address to clipboard**.  
   It looks like:  
   `https://hook.eu2.make.com/xxxxxxxxxxxxxxxx`

Leave this browser tab open.

---

## 2. Add the webhook URL to Netlify

1. Netlify → your site → **Site configuration** → **Environment variables**.
2. Add:

| Key | Value |
|-----|--------|
| `MAKE_WEBHOOK_URL` | the URL you copied from Make |
| `APP_URL` | `https://rwdnews.netlify.app` |
| `SOCIAL_MAX_POSTS` | `3` (optional; default is 3) |
| `API_FOOTBALL_KEY` | your API-Football key (you already added this) |

3. **Save** and **trigger a new deploy** (or wait for the next git deploy).

Also keep:

- `CRON_SECRET` — for cron-job.org
- `SUPABASE_*` / `GEMINI_API_KEY` as before

---

## 3. Finish the Make scenario (Facebook example)

After the **Custom webhook** module:

1. Add **Facebook Pages → Create a Page Post** (or **Instagram**, **X/Twitter**, etc.).
2. Connect your Facebook Page account when Make asks.
3. Map fields from the webhook:

| Facebook field | Make data |
|----------------|-----------|
| Message | `caption` |
| Link | `url` |
| (optional) Photo URL | `image` |

Webhook JSON RWDNEWS sends:

```json
{
  "id": "news-...",
  "title": "Headline on RWDNEWS",
  "summary": "Short text...",
  "bullets": ["...", "..."],
  "url": "https://rwdnews.netlify.app/news/slug--id",
  "image": "https://...",
  "category": "Sports",
  "source": "BBC",
  "caption": "Headline\n\n• bullet\n\nRead the RWDNEWS briefing → https://...",
  "hashtags": "#Sports #World"
}
```

4. Turn the scenario **ON** (schedule: **Immediately** as data arrives).

### Optional: post only Sports

Add a **Filter** after the webhook:

- `category` **Equal to** `Sports`

Or use a **Router** for Sports vs News pages.

---

## 4. Test once

### A) Manual test from Netlify function

After deploy, open (replace SECRET):

```text
https://rwdnews.netlify.app/api/social-dispatch?secret=YOUR_CRON_SECRET
```

You should see JSON like `{ "ok": true, "sent": 3, ... }`.

In Make → scenario → **History**, a green run should appear.

### B) Automatic (with news ingest)

Your cron already hits `/api/cron/ingest`. After each successful ingest, RWDNEWS now also calls Make with the top stories.

Make sure cron-job.org is **enabled** again and the URL is:

```text
https://rwdnews.netlify.app/api/cron/ingest?secret=YOUR_CRON_SECRET
```

---

## 5. Rules so you stay safe on social

- Post **your** caption + **your** URL — not a full copy of the publisher article.
- Prefer the feed image URL or Unsplash; do not claim others’ photos as yours.
- Do not spam: `SOCIAL_MAX_POSTS=2` or `3` is enough per ingest cycle.
- Facebook/Meta may require a business Page and app review for some actions — follow Make’s connection wizard.

---

## 6. Troubleshooting

| Symptom | Fix |
|---------|------|
| `{ "skipped": true, "reason": "MAKE_WEBHOOK_URL not set" }` | Add env var and redeploy |
| Make history empty | Scenario must be **ON**; webhook URL must match exactly |
| Facebook error | Reconnect Page in Make; check Page roles |
| Cron still 502 | Fix ingest first; social runs only after successful ingest |
| Too many posts | Set `SOCIAL_MAX_POSTS=1` |

---

## Flow diagram

```text
cron-job.org
    → /api/cron/ingest
        → fetch RSS + AI briefings + save Supabase
        → dispatchToMake (top 3 stories)
            → MAKE_WEBHOOK_URL
                → Make scenario
                    → Facebook / X / Instagram
```
