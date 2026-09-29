/**
 * Push story payloads to Make.com (or any webhook URL).
 * Env:
 *   MAKE_WEBHOOK_URL  — Custom webhook from Make.com scenario
 *   APP_URL           — your current public RockBrief URL (for absolute links)
 *   SOCIAL_MAX_POSTS  — max stories per run (default 3)
 */

function siteBase() {
  return (process.env.APP_URL || process.env.URL || "").replace(/\/$/, "");
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
    `Read the RockBrief briefing → ${storyPath(article)}`,
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



function socialMode() {
  if (process.env.META_PAGE_ID && process.env.META_PAGE_ACCESS_TOKEN) return "meta";
  if (process.env.X_USER_ACCESS_TOKEN) return "x";
  if (process.env.MAKE_WEBHOOK_URL || process.env.MAKE_COM_WEBHOOK_URL) return "make";
  return "none";
}

async function postToMeta(article, payload) {
  const pageId = process.env.META_PAGE_ID || "";
  const token = process.env.META_PAGE_ACCESS_TOKEN || "";
  const endpoint = "https://graph.facebook.com/v23.0/" + encodeURIComponent(pageId) + "/feed";
  const r = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      message: payload.caption,
      link: payload.url,
      access_token: token,
    }),
    signal: AbortSignal.timeout(15000),
  });
  const data = await r.json().catch(() => ({}));
  return { ok: r.ok && Boolean(data.id), platform: "facebook", status: r.status, post_id: data.id || null, error: data.error?.message || null };
}

async function postToX(article, payload) {
  const token = process.env.X_USER_ACCESS_TOKEN || "";
  const text = (payload.title + "\n\n" + payload.summary + "\n\n" + payload.url).slice(0, 280);
  const r = await fetch("https://api.x.com/2/tweets", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer " + token,
    },
    body: JSON.stringify({ text }),
    signal: AbortSignal.timeout(15000),
  });
  const data = await r.json().catch(() => ({}));
  return { ok: r.ok && Boolean(data.data?.id), platform: "x", status: r.status, post_id: data.data?.id || null, error: data.errors?.[0]?.message || data.detail || null };
}

/**
 * POST up to N stories to Make.com webhook.
 * Make scenario should start with "Custom webhook" and map fields:
 *   title, caption, url, image, category
 */
export async function dispatchToMake(articles, eventKey = "initial") {
  const mode = socialMode();
  const max = Math.max(1, Math.min(10, Number(process.env.SOCIAL_MAX_POSTS || 3)));
  const list = (Array.isArray(articles) ? articles : [])
    .filter((a) => a && (a.ai_hook_title || a.original_title) && a.id)
    .slice(0, max);
  if (!list.length) return { ok: true, sent: 0, reason: "no articles" };

  if (mode === "meta" || mode === "x") {
    const results = [];
    for (const article of list) {
      const payload = { ...toSocialPayload(article), event_key: eventKey };
      try {
        const result = mode === "meta" ? await postToMeta(article, payload) : await postToX(article, payload);
        results.push({ id: payload.id, event_key: eventKey, ...result, title: payload.title.slice(0, 80) });
      } catch (e) {
        results.push({ id: payload.id, event_key: eventKey, platform: mode === "meta" ? "facebook" : "x", ok: false, error: e instanceof Error ? e.message : "send failed" });
      }
      await new Promise((res) => setTimeout(res, 500));
    }
    return { ok: results.some((x) => x.ok), sent: results.filter((x) => x.ok).length, platform: mode, results };
  }

  const webhook = process.env.MAKE_WEBHOOK_URL || process.env.MAKE_COM_WEBHOOK_URL || "";
  if (!webhook) return { ok: false, skipped: true, reason: "No social publishing credentials configured" };

  const results = [];
  for (const article of list) {
    const payload = { ...toSocialPayload(article), event_key: eventKey };
    try {
      const r = await fetch(webhook, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(12000),
      });
      results.push({
        id: payload.id,
        event_key: eventKey,
        status: r.status,
        ok: r.ok,
        title: payload.title.slice(0, 80),
      });
      // Gentle delay so free Make tiers are not rate-limited
      await new Promise((res) => setTimeout(res, 400));
    } catch (e) {
      results.push({
        id: payload.id,
        event_key: eventKey,
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
