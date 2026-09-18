import type { Config, Context } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";

const RSS_FEEDS = [
  { url: "https://finance.yahoo.com/news/rssindex", source: "Yahoo Finance" },
  { url: "https://www.finextra.com/rss/headlines.aspx", source: "Finextra" },
  {
    url: "https://feeds.content.dowjones.io/public/rss/mw_topstories",
    source: "MarketWatch",
  },
];

const IMAGES = [
  "https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1559526324-4b87b5e36e44?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1590283603385-17ffb3a7f29f?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1563986768609-322da13575f3?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1526304640581-d334cdbbf45e?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1551836022-d5d88e9218df?auto=format&fit=crop&w=1200&q=80",
];

function stripTags(s: string) {
  return s.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function parseRssItems(xml: string, source: string) {
  const items: { title: string; link: string; description: string; pubDate?: string }[] =
    [];
  const blocks = xml.split(/<item[\s>]/i).slice(1);
  for (const block of blocks.slice(0, 4)) {
    const title =
      block.match(/<title[^>]*><!\[CDATA\[([\s\S]*?)\]\]><\/title>/i)?.[1] ||
      block.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ||
      "";
    const link =
      block.match(/<link[^>]*><!\[CDATA\[([\s\S]*?)\]\]><\/link>/i)?.[1] ||
      block.match(/<link[^>]*>([\s\S]*?)<\/link>/i)?.[1] ||
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
    if (t && l) {
      items.push({
        title: t,
        link: l,
        description: stripTags(description).slice(0, 280),
        pubDate: pubDate ? stripTags(pubDate) : undefined,
      });
    }
  }
  return items.map((i) => ({ ...i, source }));
}

async function fetchFeeds() {
  const out: {
    title: string;
    link: string;
    description: string;
    pubDate?: string;
    source: string;
  }[] = [];
  await Promise.all(
    RSS_FEEDS.map(async (feed) => {
      try {
        const res = await fetch(feed.url, {
          headers: { "User-Agent": "FinSignalBot/1.0" },
          signal: AbortSignal.timeout(4000),
        });
        if (!res.ok) return;
        const xml = await res.text();
        out.push(...parseRssItems(xml, feed.source));
      } catch {
        /* skip feed */
      }
    }),
  );
  return out.slice(0, 12);
}

function heuristic(title: string, desc: string) {
  const lower = `${title} ${desc}`.toLowerCase();
  const tags: string[] = [];
  if (lower.includes("bank")) tags.push("#Banking");
  if (lower.includes("invest") || lower.includes("yield")) tags.push("#Investing");
  if (lower.includes("fintech")) tags.push("#Fintech");
  if (lower.includes("pay")) tags.push("#Payments");
  if (tags.length < 2) tags.push("#PersonalFinance", "#Fintech");
  return {
    ai_hook_title: title.slice(0, 160),
    ai_summary: [
      desc.split(".")[0] ? `${desc.split(".")[0].trim()}.` : "Market development worth tracking.",
      "Verify details on the original publisher before acting.",
    ],
    tags: tags.slice(0, 3),
  };
}

export default async function handler(req: Request, _context: Context) {
  const url = new URL(req.url);
  const secret = process.env.CRON_SECRET || "";
  const q = url.searchParams.get("secret") || "";
  const auth = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");

  if (secret && q !== secret && auth !== secret) {
    return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const supabaseUrl =
    process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

  if (!supabaseUrl || !serviceKey) {
    return Response.json(
      {
        ok: false,
        error: "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY",
      },
      { status: 500 },
    );
  }

  const sb = createClient(supabaseUrl, serviceKey);
  const raw = await fetchFeeds();

  if (!raw.length) {
    return Response.json({ ok: true, saved: 0, note: "No RSS items fetched" });
  }

  let saved = 0;
  for (let i = 0; i < raw.length; i++) {
    const item = raw[i];
    const ai = heuristic(item.title, item.description);
    const row = {
      id: `netlify-${Date.now().toString(36)}-${i}`,
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
        : new Date(Date.now() - i * 15 * 60 * 1000).toISOString(),
    };
    const { error } = await sb.from("articles").upsert(row, {
      onConflict: "original_url",
    });
    if (!error) saved += 1;
  }

  return Response.json({
    ok: true,
    fetched: raw.length,
    saved,
    at: new Date().toISOString(),
  });
}

export const config: Config = {
  path: "/api/cron/ingest",
};
