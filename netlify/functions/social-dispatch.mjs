/**
 * Native social publishing for RockBrief — no Make.com required.
 *
 * META_PAGE_ID + META_PAGE_ACCESS_TOKEN → Facebook
 * X_API_KEY + X_API_SECRET + X_ACCESS_TOKEN + X_ACCESS_SECRET → X
 *
 * Only posts high-trend stories with 300+ word bodies and 4 bullets.
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
  return siteBase() + "/news/" + title + "--" + encodeURIComponent(String(article.id));
}

function isPublishableSocialArticle(article) {
  const title = String(article?.ai_hook_title || article?.original_title || "").trim();
  const bodyWords = String(article?.body || "").split(/\s+/).filter(Boolean).length;
  const bullets = Array.isArray(article?.ai_summary)
    ? article.ai_summary.map(String).map((x) => x.trim()).filter(Boolean)
    : [];
  const sourceUrl = String(article?.original_url || "");
  const image = String(article?.image || "");
  const placeholder = /rwdnews-logo\.svg(?:$|[?#])/i.test(image);
  const imageReady =
    placeholder ||
    (/^https?:\/\//i.test(String(article?.image_source_url || "")) &&
      String(article?.image_credit || "").trim().length > 0);
  return (
    title.length >= 20 &&
    bodyWords >= 300 &&
    bullets.length === 4 &&
    bullets.every((b) => b.split(/\s+/).filter(Boolean).length >= 15) &&
    /^https?:\/\//i.test(sourceUrl) &&
    imageReady
  );
}

function buildCaption(article, maxLen) {
  if (maxLen == null) maxLen = 1800;
  const title = String(article.ai_hook_title || article.original_title || "").trim();
  const hook = Array.isArray(article.ai_summary) ? String(article.ai_summary[0] || "").trim() : "";
  const tags = Array.isArray(article.tags) ? article.tags.map(String).slice(0, 3).join(" ") : "#News";
  const url = storyPath(article);
  return [title, "", hook ? hook.slice(0, 220) : "Full briefing on RockBrief — sources credited.", "", "Read → " + url, "", tags]
    .join("\n")
    .slice(0, maxLen);
}

function buildXText(article) {
  const title = String(article.ai_hook_title || article.original_title || "").trim();
  const url = storyPath(article);
  const maxTitle = 240;
  const t = title.length > maxTitle ? title.slice(0, maxTitle - 1) + "…" : title;
  return t + "\n\n" + url;
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
    url: url,
    image: String(article.image || ""),
    category: String(article.category || "World"),
    source: String(article.source || "Wire"),
    caption: buildCaption(article),
    x_text: buildXText(article),
    hashtags: Array.isArray(article.tags)
      ? article.tags.map(String).slice(0, 4).join(" ")
      : "#" + String(article.category || "News").replace(/\s+/g, ""),
  };
}

function hasMeta() {
  return Boolean(process.env.META_PAGE_ID && process.env.META_PAGE_ACCESS_TOKEN);
}

function hasXOauth1() {
  return Boolean(
    process.env.X_API_KEY &&
      process.env.X_API_SECRET &&
      process.env.X_ACCESS_TOKEN &&
      process.env.X_ACCESS_SECRET,
  );
}

function hasXBearer() {
  return Boolean(process.env.X_USER_ACCESS_TOKEN);
}

async function oauth1Header(method, url, consumerKey, consumerSecret, token, tokenSecret) {
  const crypto = await import("node:crypto");
  const nonce = crypto.randomBytes(16).toString("hex");
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const params = {
    oauth_consumer_key: consumerKey,
    oauth_nonce: nonce,
    oauth_signature_method: "HMAC-SHA1",
    oauth_timestamp: timestamp,
    oauth_token: token,
    oauth_version: "1.0",
  };
  const paramString = Object.keys(params)
    .sort()
    .map(function (k) {
      return encodeURIComponent(k) + "=" + encodeURIComponent(params[k]);
    })
    .join("&");
  const base = [method.toUpperCase(), encodeURIComponent(url), encodeURIComponent(paramString)].join("&");
  const signingKey = encodeURIComponent(consumerSecret) + "&" + encodeURIComponent(tokenSecret);
  const signature = crypto.createHmac("sha1", signingKey).update(base).digest("base64");
  params.oauth_signature = signature;
  return (
    "OAuth " +
    Object.keys(params)
      .sort()
      .map(function (k) {
        return encodeURIComponent(k) + "=\"" + encodeURIComponent(params[k]) + "\"";
      })
      .join(", ")
  );
}

async function postToMeta(payload) {
  const pageId = process.env.META_PAGE_ID || "";
  const token = process.env.META_PAGE_ACCESS_TOKEN || "";
  const endpoint = "https://graph.facebook.com/v21.0/" + encodeURIComponent(pageId) + "/feed";
  const r = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message: payload.caption, link: payload.url, access_token: token }),
    signal: AbortSignal.timeout(15000),
  });
  const data = await r.json().catch(function () {
    return {};
  });
  return {
    ok: r.ok && Boolean(data.id),
    platform: "facebook",
    status: r.status,
    post_id: data.id || null,
    post_url: data.id ? "https://facebook.com/" + data.id : null,
    error: data.error && data.error.message ? data.error.message : null,
  };
}

async function postToX(payload) {
  const text = String(payload.x_text || payload.caption).slice(0, 280);
  const url = "https://api.x.com/2/tweets";
  if (hasXOauth1()) {
    const auth = await oauth1Header(
      "POST",
      url,
      process.env.X_API_KEY,
      process.env.X_API_SECRET,
      process.env.X_ACCESS_TOKEN,
      process.env.X_ACCESS_SECRET,
    );
    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: auth },
      body: JSON.stringify({ text: text }),
      signal: AbortSignal.timeout(15000),
    });
    const data = await r.json().catch(function () {
      return {};
    });
    return {
      ok: r.ok && Boolean(data.data && data.data.id),
      platform: "x",
      status: r.status,
      post_id: data.data && data.data.id ? data.data.id : null,
      post_url: data.data && data.data.id ? "https://x.com/i/web/status/" + data.data.id : null,
      error: (data.errors && data.errors[0] && data.errors[0].message) || data.detail || null,
    };
  }
  if (hasXBearer()) {
    const r = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + process.env.X_USER_ACCESS_TOKEN,
      },
      body: JSON.stringify({ text: text }),
      signal: AbortSignal.timeout(15000),
    });
    const data = await r.json().catch(function () {
      return {};
    });
    return {
      ok: r.ok && Boolean(data.data && data.data.id),
      platform: "x",
      status: r.status,
      post_id: data.data && data.data.id ? data.data.id : null,
      post_url: data.data && data.data.id ? "https://x.com/i/web/status/" + data.data.id : null,
      error: (data.errors && data.errors[0] && data.errors[0].message) || data.detail || null,
    };
  }
  return { ok: false, platform: "x", error: "X credentials not configured" };
}

export async function dispatchToMake(articles, eventKey) {
  if (eventKey == null) eventKey = "initial";
  return dispatchNative(articles, eventKey);
}

export async function dispatchNative(articles, eventKey) {
  if (eventKey == null) eventKey = "initial";
  const max = Math.max(1, Math.min(10, Number(process.env.SOCIAL_MAX_POSTS || 3)));
  const list = (Array.isArray(articles) ? articles : [])
    .filter(function (a) {
      return a && (a.ai_hook_title || a.original_title) && a.id;
    })
    .filter(isPublishableSocialArticle)
    .slice(0, max);

  if (!list.length) return { ok: true, sent: 0, reason: "no publishable articles" };

  const targets = [];
  if (hasMeta()) targets.push("facebook");
  if (hasXOauth1() || hasXBearer()) targets.push("x");
  const makeUrl = process.env.MAKE_WEBHOOK_URL || process.env.MAKE_COM_WEBHOOK_URL || "";
  if (!targets.length && makeUrl) targets.push("make");

  if (!targets.length) {
    return {
      ok: false,
      skipped: true,
      reason:
        "No social credentials. Set META_PAGE_ID + META_PAGE_ACCESS_TOKEN and/or X_API_KEY + X_API_SECRET + X_ACCESS_TOKEN + X_ACCESS_SECRET",
    };
  }

  const results = [];
  for (let i = 0; i < list.length; i++) {
    const article = list[i];
    const payload = Object.assign({}, toSocialPayload(article), { event_key: eventKey });
    for (let j = 0; j < targets.length; j++) {
      const platform = targets[j];
      try {
        let result;
        if (platform === "facebook") result = await postToMeta(payload);
        else if (platform === "x") result = await postToX(payload);
        else {
          const r = await fetch(makeUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
            signal: AbortSignal.timeout(12000),
          });
          result = { ok: r.ok, platform: "make", status: r.status, post_id: null, error: r.ok ? null : "webhook failed" };
        }
        results.push(Object.assign({ id: payload.id, event_key: eventKey, title: payload.title.slice(0, 80) }, result));
      } catch (e) {
        results.push({
          id: payload.id,
          event_key: eventKey,
          platform: platform,
          ok: false,
          error: e instanceof Error ? e.message : "send failed",
        });
      }
      await new Promise(function (res) {
        setTimeout(res, 600);
      });
    }
  }

  return {
    ok: results.some(function (x) {
      return x.ok;
    }),
    sent: results.filter(function (x) {
      return x.ok;
    }).length,
    platforms: targets,
    results: results,
  };
}

export async function handler(event) {
  const secret = process.env.CRON_SECRET || process.env.BOT_MANUAL_SECRET || "";
  const auth = (event.headers && (event.headers.authorization || event.headers.Authorization)) || "";
  const supplied =
    auth.replace(/^Bearer\s+/i, "") ||
    (event.headers && event.headers["x-rockbrief-bot-secret"]) ||
    (event.queryStringParameters && event.queryStringParameters.secret) ||
    "";

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
    if (!articles.length) {
      const base = siteBase();
      const r = await fetch(base + "/api/news", {
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(15000),
      });
      if (r.ok) {
        const d = await r.json();
        articles = Array.isArray(d.articles) ? d.articles.slice(0, 8) : [];
      }
    }
    const result = await dispatchNative(articles);
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
