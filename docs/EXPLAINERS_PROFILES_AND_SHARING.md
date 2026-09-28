# Explainers, Profiles & professional sharing

## What we built

1. **`/explainers`** — hub of explainer articles  
2. **`/profiles`** — hub of biography / profile articles  
3. **Edge OG cards** — WhatsApp / Facebook / X / LinkedIn bots get title + description + **image** (not a bare link)  
4. Same **Admin** and **Story page** for all types  

## How to publish an Explainer (e.g. Hormuz piece)

1. Open **Admin** → create article  
2. **Title** — clear, searchable  
3. **Body** — full HTML / rich text, **400+ words**  
4. **Category** — set exactly: `Explainers`  
5. **Tags** — include `#Explainer`  
6. **Image** — upload a **JPG or PNG** (not SVG). Ideal ~1200×630 for share cards  
7. Status **published**  

It appears on `/explainers` and as a normal story at `/news/...`

## How to publish a Profile / Biography

1. Admin → new article  
2. Category: `Profiles`  
3. Tags: `#Biography` or `#Profile`  
4. Structure body: Who they are → Why they matter → Timeline → Related context  
5. Strong portrait or relevant **JPG/PNG** image  
6. Publish  

Appears on `/profiles`.

## Professional sharing (image + title + text)

Social apps read **Open Graph** tags from the HTML they fetch.

- **Humans** load the React app  
- **WhatsApp / Facebook / Telegram / Slack bots** hit our **edge function** on `/news/*` and get full `og:title`, `og:description`, `og:image`  

### Requirements for a nice card

| Need | Detail |
|------|--------|
| Image format | **JPG or PNG** (WhatsApp often ignores SVG) |
| Size | Prefer **1200×630** |
| URL | Public HTTPS URL on the article |
| Fallback | Add `public/og-default.png` (1200×630 RockBrief branded) |

After publishing, test with:

- [Facebook Sharing Debugger](https://developers.facebook.com/tools/debug/)  
- [Twitter Card Validator](https://cards-dev.twitter.com/validator)  
- Send the link to yourself on WhatsApp  

If an old preview is cached, use “Scrape Again” in Facebook Debugger.

## Menu

Users can open:

- https://rwdnews.netlify.app/explainers  
- https://rwdnews.netlify.app/profiles  

Add these links to your homepage nav when you next edit `AppHome` / header.

## SQL optional (story_type column)

```sql
alter table public.articles
  add column if not exists story_type text default 'WIRE';

create index if not exists articles_story_type_idx
  on public.articles (story_type);
```

Values: `WIRE` | `EXPLAINER` | `BIO` | `FEATURE` | `COMMENTARY`

Until the admin UI has a dropdown, **category + tags** are enough for hubs to work.
