# RWDNEWS

Global source-backed news platform covering World, Europe, Middle East, Asia, Africa, Nigeria, Ghana, Sports, Business, Tech, Crypto and Entertainment.

## Current production

- Site: https://rwdnews.netlify.app
- Main branch: `main`
- Netlify production deploys from GitHub `main`
- News ingestion: RSS + GDELT with scheduled refresh
- Sports desk: live scores/fixtures, sports news and AI-assisted statistical commentary
- Research Desk: admin-only source-backed research and draft generation
- Editorial publishing: WIRE, DEVELOPING and RWDNEWS ORIGINAL
- Admin: private password/session protected operations, editorial, analytics, monetization, audience, newsletter and security areas
- Article pages: source attribution, original-source CTA, sharing, engagement tracking, related stories and NewsArticle structured data
- SEO: robots.txt and sitemap include the main sports routes

## Important environment variables

Configure these in Netlify for the appropriate production/runtime scopes:

```text
VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
ADMIN_PASSWORD
ADMIN_SESSION_SECRET
GEMINI_API_KEY
OPENAI_API_KEY
```

Never commit secret values to GitHub.

## AI usage

AI is used for source-bounded summaries, research drafts and sports statistical commentary. It must not invent facts, quotes, numbers, events or sources. Sports predictions are probabilistic commentary, not guarantees or betting advice.

## Editorial and image policy

- Keep publisher/source attribution visible.
- Send readers to the original publisher for the complete report.
- Use RWDNEWS-owned, licensed or otherwise rights-cleared images for original/editorial material.
- Do not present generated images as real event photographs.
- Sponsored material must be clearly labeled.

## Local development

```bash
npm install
npm run dev
npm run build
```

The production build should pass before merging or deploying.

## Operations

Scheduled functions keep the news wire refreshed. Admin credentials and server-side API keys must remain in Netlify environment variables, never in client code or committed files.
