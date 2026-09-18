import { createClient } from "@supabase/supabase-js";

const RSS_FEEDS = [
  { url: "https://finance.yahoo.com/news/rssindex", source: "Yahoo Finance" },
  { url: "https://www.finextra.com/rss/headlines.aspx", source: "Finextra" },
  {
    url: "https://feeds.content.dowjones.io/public/rss/mw_topstories",
    source: "MarketWatch",
  },
  { url: "https://www.coindesk.com/arc/outboundfeeds/rss/", source: "CoinDesk" },
  {
    url: "https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=10000664",
    source: "CNBC",
  },
  { url: "https://www.techmeme.com/feed.xml", source: "Techmeme" },
  {
    url: "https://feeds.bbci.co.uk/news/business/rss.xml",
    source: "BBC Business",
  },
  {
    url: "https://rss.nytimes.com/services/xml/rss/nyt/Business.xml",
    source: "NYTimes Business",
  },
];

const IMAGES = [
  "https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1559526324-4b87b5e36e44?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1590283603385-17ffb3a7f29f?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1563986768609-322da13575f3?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1526304640581-d334cdbbf45e?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1551836022-d5d88e9218df?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1579621970563-ebec7560ff3e?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&w=1200&q=80",
];

function stripTags(s) {
  return String(s || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parseRssItems(xml, source) {
  const items = [];
  const blocks = String(xml).split(/<item[\s>]/i).slice(1);
  for (const block of blocks.slice(0, 6)) {
    const title =
      block.match(/<title[^>]*><!\[CDATA\[([\s\S]*?)\]\]><\/title>/i)?.[1] ||
      block.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ||
      "";
    const link =
      block.match(/<link[^>]*><!\[CDATA\[([\s\S]*?)\]\]><\/link>/i)?.[1] ||
      block.match(/<link[^>]*>([\s\S]*?)<\/link>/i)?.[1] ||
      block.match(/<guid[^>]*>([\s\S]*?)<\/guid>/i)?.[1] ||
      "";
    const description =
      block.match(
        /<description[^>]*><!\[CDATA\[([\s\S]*?)\]\]><\/description>/i,
      )?.[1] ||
      block.match(/<description[^>]*>([\s\S]*?)<\/description>/i)?.[1] ||
      "";
    const pubDate = block.match(/<pubDate[^>]*>([\s\S]*?)<\/pubDate>/i)?.[1];
    const t = stripTags(title);
    const l = stripTags(link);
    if (t && l && l.startsWith("http")) {
      items.push({
        title: t,
        link: l,
        description: stripTags(description).slice(0, 500),
        pubDate: pubDate ? stripTags(pubDate) : undefined,
        source,
      });
    }
  }
  return items;
}

async function fetchFeeds() {
  const out = [];
  await Promise.all(
    RSS_FEEDS.map(async (feed) => {
      try {
        const res = await fetch(feed.url, {
          headers: {
            "User-Agent": "RWDNEWS/1.0 (+https://rwdnews.netlify.app)",
            Accept: "application/rss+xml, application/xml, text/xml, */*",
          },
          signal: AbortSignal.timeout(6000),
        });
        if (!res.ok) return;
        const xml = await res.text();
        out.push(...parseRssItems(xml, feed.source));
      } catch {
        /* skip */
      }
    }),
  );
  const seen = new Set();
  return out
    .filter((i) => {
      if (seen.has(i.link)) return false;
      seen.add(i.link);
      return true;
    })
    .slice(0, 40);
}

function heuristic(title, desc) {
  const lower = `${title} ${desc}`.toLowerCase();
  const tags = [];
  if (lower.includes("bank") || lower.includes("fed")) tags.push("Banking");
  if (lower.includes("stock") || lower.includes("market") || lower.includes("invest"))
    tags.push("Markets");
  if (lower.includes("fintech") || lower.includes("startup")) tags.push("Fintech");
  if (lower.includes("crypto") || lower.includes("bitcoin")) tags.push("Crypto");
  if (lower.includes("pay")) tags.push("Payments");
  if (tags.length < 2) tags.push("Business", "Finance");
  const first =
    desc && desc.length > 20
      ? `${desc.split(".")[0].trim()}.`
      : "A market story with impact for investors and consumers.";
  return {
    ai_hook_title: title.slice(0, 180),
    ai_summary: [
      first,
      "Full briefing on RWDNEWS — no need to leave the site.",
    ],
    tags: tags.slice(0, 4),
  };
}

export async function handler(event) {
  try {
    const secret = process.env.CRON_SECRET || "";
    const q =
      event.queryStringParameters?.secret ||
      (event.headers?.authorization || "").replace(/^Bearer\s+/i, "");

    if (secret && q !== secret) {
      return {
        statusCode: 401,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ok: false, error: "Unauthorized" }),
      };
    }

    const supabaseUrl =
      process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

    if (!supabaseUrl || !serviceKey) {
      return {
        statusCode: 500,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ok: false,
          error: "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY",
        }),
      };
    }

    const sb = createClient(supabaseUrl, serviceKey);
    const raw = await fetchFeeds();

    if (!raw.length) {
      return {
        statusCode: 200,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ok: true, saved: 0, note: "No RSS items" }),
      };
    }

    let saved = 0;
    for (let i = 0; i < raw.length; i++) {
      const item = raw[i];
      const ai = heuristic(item.title, item.description);
      const row = {
        id: `rwd-${Date.now().toString(36)}-${i}`,
        original_url: item.link,
        original_title: item.title,
        original_description: item.description || "",
        ai_hook_title: ai.ai_hook_title,
        ai_summary: ai.ai_summary,
        tags: ai.tags,
        source: item.source,
        image: IMAGES[i % IMAGES.length],
        read_time: "3 min read",
        timestamp: item.pubDate
          ? new Date(item.pubDate).toISOString()
          : new Date(Date.now() - i * 8 * 60 * 1000).toISOString(),
      };
      const { error } = await sb.from("articles").upsert(row, {
        onConflict: "original_url",
      });
      if (!error) saved += 1;
    }

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ok: true,
        brand: "RWDNEWS",
        fetched: raw.length,
        saved,
        at: new Date().toISOString(),
      }),
    };
  } catch (e) {
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ok: false,
        error: e instanceof Error ? e.message : "Server error",
      }),
    };
  }
}
