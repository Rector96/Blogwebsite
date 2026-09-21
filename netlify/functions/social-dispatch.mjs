/**
 * Push story payloads to Make.com (or any webhook URL).
 * Env:
 *   MAKE_WEBHOOK_URL  — Custom webhook from Make.com scenario
 *   APP_URL           — https://rwdnews.netlify.app (for absolute links)
 *   SOCIAL_MAX_POSTS  — max stories per run (default 3)
 */

function siteBase() {
  return (process.env.APP_URL || process.env.URL || "https://rwdnews.netlify.app").replace(/\/$/, "");
}

function storyPath(article) {
  const title = String(article.ai_hook_title || article.original_title || "story")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 90);
  return `${siteBase()}/news/${title}--${encodeURIComponent(String(article.id))}`;
}

function buildCaption(article) {
  const title = String(article.ai_hook_title || article.original_title || "").trim();
  const bullets = Array.isArray(article.ai_summary)
    ? article.ai_summary.map(String).filter(Boolean).slice(0, 3)
    : [];
  const lines = [
    title,
    "",
    ...bullets.map((b) => `• ${b}`),
    "",
    `Read the RWDNEWS briefing → ${storyPath(article)}`,
    "",
    "Source credited on site. Summary only — full report with the publisher.",
  ];
  return lines.join("\n").slice(0, 1800);
}

export function toSocialPayload(article) {
  const url = storyPath(article);
  return {
    id: String(article.id),
    title: String(article.ai_hook_title || article.original_title || ""),
    summary: Array.isArray(article.ai_summary)
      ? article.ai_summary.map(String).slice(0, 5).join(" ")
      : String(article.original_description || "").slice(0, 400),
    bullets: Array.isArray(article.ai_summary) ? article.ai_summary.map(String).slice(0, 5) : [],
    url,
    image: String(article.image || ""),
    category: String(article.category || "World"),
    source: String(article.source || "Wire"),
    caption: buildCaption(article),
    // Fair-use style: our caption + link to our page (not full republish)
    hashtags: Array.isArray(article.tags)
      ? article.tags.map(String).slice(0, 4).join(" ")
      : `#${String(article.category || "News").replace(/\s+/g, "")}`,
  };
}

/**
 * POST up to N stories to Make.com webhook.
 * Make scenario should start with "Custom webhook" and map fields:
 *   title, caption, url, image, category
 */
export async function dispatchToMake(articles) {
  const webhook = process.env.MAKE_WEBHOOK_URL || process.env.MAKE_COM_WEBHOOK_URL || "";
  if (!webhook) {
    return { ok: false, skipped: true, reason: "MAKE_WEBHOOK_URL not set" };
  }

  const max = Math.max(1, Math.min(10, Number(process.env.SOCIAL_MAX_POSTS || 3)));
  const list = (Array.isArray(articles) ? articles : [])
    .filter((a) => a && (a.ai_hook_title || a.original_title) && a.id)
    .slice(0, max);

  if (!list.length) {
    return { ok: true, sent: 0, reason: "no articles" };
  }

  const results = [];
  for (const article of list) {
    const payload = toSocialPayload(article);
    try {
      const r = await fetch(webhook, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(12000),
      });
      results.push({
        id: payload.id,
        status: r.status,
        ok: r.ok,
        title: payload.title.slice(0, 80),
      });
      // Gentle delay so free Make tiers are not rate-limited
      await new Promise((res) => setTimeout(res, 400));
    } catch (e) {
      results.push({
        id: payload.id,
        ok: false,
        error: e instanceof Error ? e.message : "send failed",
      });
    }
  }

  return {
    ok: results.some((x) => x.ok),
    sent: results.filter((x) => x.ok).length,
    results,
  };
}

/** Netlify function: POST /api/social-dispatch  (optional manual/test trigger) */
export async function handler(event) {
  const secret = process.env.CRON_SECRET || "";
  const auth = event.headers?.authorization || event.headers?.Authorization || "";
  const supplied =
    auth.replace(/^Bearer\s+/i, "") || event.queryStringParameters?.secret || "";

  if (secret && supplied !== secret) {
    return {
      statusCode: 401,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ok: false, error: "Unauthorized" }),
    };
  }

  try {
    let articles = [];
    if (event.body) {
      const body = JSON.parse(event.body);
      articles = Array.isArray(body.articles) ? body.articles : body.article ? [body.article] : [];
    }

    // If no body, pull latest from news API internally
    if (!articles.length) {
      const base = siteBase();
      const r = await fetch(`${base}/api/news`, {
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(15000),
      });
      if (r.ok) {
        const d = await r.json();
        articles = Array.isArray(d.articles) ? d.articles.slice(0, 5) : [];
      }
    }

    const result = await dispatchToMake(articles);
    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(result),
    };
  } catch (e) {
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ok: false,
        error: e instanceof Error ? e.message : "dispatch failed",
      }),
    };
  }
}
