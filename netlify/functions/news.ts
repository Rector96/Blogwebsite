import Parser from "rss-parser";
import { GoogleGenAI, Type } from "@google/genai";
import { createClient } from "@supabase/supabase-js";

export type NewsArticle = {
  id: string;
  original_url: string;
  image: string;
  timestamp: string;
  source: string;
  original_title: string;
  original_description: string;
  ai_hook_title: string;
  ai_summary: string[];
  tags: string[];
  read_time: string;
  category: string;
  trend_score: number;
  trend_label: "Trending" | "Developing" | "Fresh";
  image_credit: string;
  image_license: string;
  image_source_url: string;
  discovered_via: string[];
};

const rss = new Parser({
  headers: {
    "User-Agent": "RWDNEWS/1.0 (+https://rwdnews.netlify.app)",
    Accept: "application/rss+xml, application/xml, text/xml, */*",
  },
  timeout: 3000,
});

const feeds = [
  ["https://finance.yahoo.com/news/rssindex", "Yahoo Finance"],
  ["https://www.finextra.com/rss/headlines.aspx", "Finextra"],
  ["https://feeds.content.dowjones.io/public/rss/mw_topstories", "MarketWatch"],
  ["https://www.aljazeera.com/xml/rss/all.xml", "Al Jazeera"],
  ["https://techcrunch.com/feed/", "TechCrunch"],
  ["https://www.coindesk.com/arc/outboundfeeds/rss/", "CoinDesk"],
] as const;

const queries = [
  ["(finance OR markets OR banking OR economy OR companies)", "Business"],
  ['("artificial intelligence" OR AI OR technology OR cybersecurity OR chips)', "Tech"],
  ["(geopolitics OR diplomacy OR conflict OR election OR government)", "World"],
  ["(Africa OR Nigeria OR Kenya OR Ghana OR SouthAfrica OR Egypt)", "Africa"],
] as const;

const stop = new Set([
  "the","and","for","with","from","that","this","after","before","into","over","under",
  "about","will","would","could","should","says","said","have","has","been","are","was",
  "were","their","they","them","than","then","what","when","where","while","which","who",
  "how","why","new","latest","news","report","reports","according","amid","more","most",
]);

const clean = (value: unknown) =>
  String(value || "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();

const words = (text: string) =>
  clean(text)
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .filter((x) => x.length >= 4 && !stop.has(x));

function category(text: string, hint?: string) {
  if (hint) return hint;
  const x = text.toLowerCase();
  if (/\b(ai|artificial intelligence|chip|semiconductor|software|cyber|robot|technology|tech)\b/.test(x)) return "Tech";
  if (/\b(africa|nigeria|kenya|ghana|south africa|egypt|lagos|abuja)\b/.test(x)) return "Africa";
  if (/\b(bitcoin|crypto|ethereum|blockchain)\b/.test(x)) return "Crypto";
  if (/\b(election|president|government|minister|parliament|diplomacy|war|conflict|sanction)\b/.test(x)) return "World";
  return "Business";
}

function svgImage(title: string, section: string) {
  const t = clean(title).slice(0, 78).replace(/&/g, "and");
  const svg =
    "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1600 900'>" +
    "<defs><linearGradient id='g' x1='0' x2='1'><stop stop-color='#071a2d'/><stop offset='1' stop-color='#0f766e'/></linearGradient></defs>" +
    "<rect width='1600' height='900' fill='url(#g)'/>" +
    "<text x='90' y='120' fill='#f59e0b' font-family='Arial' font-size='30' font-weight='700'>RWDNEWS · " +
    section.toUpperCase() +
    "</text><text x='90' y='760' fill='white' font-family='Arial' font-size='56' font-weight='700'>" +
    t +
    "</text></svg>";
  return "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(svg);
}

function rssImage(item: any) {
  return [
    item?.enclosure?.url,
    item?.["media:content"]?.url,
    item?.["media:thumbnail"]?.url,
    item?.image?.url,
  ].find((x) => typeof x === "string" && /^https?:\/\//i.test(x)) || "";
}

async function getRss() {
  const results = await Promise.allSettled(
    feeds.map(async ([url, source]) => {
      try {
        const feed = await rss.parseURL(url);
        return (feed.items || []).slice(0, 7).map((item: any) => ({
          title: clean(item.title),
          link: String(item.link || item.guid || ""),
          desc: clean(item.contentSnippet || item.content || item.summary).slice(0, 500),
          date: item.isoDate || item.pubDate,
          source,
          image: rssImage(item),
          category: category(clean(item.title) + " " + clean(item.contentSnippet || ""), undefined),
        }));
      } catch {
        return [];
      }
    }),
  );
  return results.flatMap((r) => (r.status === "fulfilled" ? r.value : []));
}

async function getGdelt() {
  const results = await Promise.allSettled(
    queries.map(async ([query, section]) => {
      const u = new URL("https://api.gdeltproject.org/api/v2/doc/doc");
      u.searchParams.set("query", query);
      u.searchParams.set("mode", "artlist");
      u.searchParams.set("maxrecords", "15");
      u.searchParams.set("timespan", "3h");
      u.searchParams.set("sort", "datedesc");
      u.searchParams.set("format", "json");
      const r = await fetch(u, {
        headers: { "User-Agent": "RWDNEWS/1.0 news-discovery" },
        signal: AbortSignal.timeout(5000),
      });
      if (!r.ok) return [];
      const data = await r.json() as any;
      return (Array.isArray(data?.articles) ? data.articles : []).map((a: any) => ({
        title: clean(a.title),
        link: String(a.url || ""),
        desc: "",
        date: a.seendate,
        source: clean(a.domain || "GDELT source"),
        image: String(a.socialimage || a.urlsocialimage || a.image || ""),
        category: section,
      }));
    }),
  );
  return results.flatMap((r) => (r.status === "fulfilled" ? r.value : []));
}

function similarity(a: string, b: string) {
  const aa = new Set(words(a));
  const bb = new Set(words(b));
  if (!aa.size || !bb.size) return 0;
  let common = 0;
  for (const w of aa) if (bb.has(w)) common++;
  return common / Math.min(aa.size, bb.size);
}

function scoreItems(items: any[]) {
  return items.map((item) => {
    const cluster = items.filter((other) => similarity(item.title, other.title) >= 0.42);
    const domains = new Set(cluster.map((x) => {
      try { return new URL(x.link).hostname.replace(/^www\./, ""); } catch { return x.source; }
    }));
    const published = new Date(item.date || Date.now()).getTime();
    const age = Number.isNaN(published) ? 0 : Math.max(0, (Date.now() - published) / 3600000);
    const freshness = Math.max(0, 38 - age * 4);
    const score = Math.round(Math.min(100, freshness + domains.size * 8 + cluster.length * 7));
    return {
      ...item,
      trendScore: score,
      trendLabel: cluster.length >= 3 || score >= 70 ? "Trending" : cluster.length >= 2 || score >= 48 ? "Developing" : "Fresh",
      sources: Array.from(new Set(cluster.map((x) => x.source))).slice(0, 5),
    };
  });
}

async function aiBrief(title: string, desc: string) {
  const fallback = {
    ai_hook_title: title.replace(/^(\[.*?\]|BREAKING:?)/i, "").trim(),
    ai_summary: [
      clean(desc).split(/(?<=[.!?])\s+/)[0] || "RWDNEWS is tracking this story from published reports.",
      "The original source remains the reference for the full report and additional context.",
    ],
    tags: ["#World"],
  };
  const key = Netlify.env.get("GEMINI_API_KEY");
  if (!key) return fallback;
  try {
    const ai = new GoogleGenAI({ apiKey: key });
    const response = await Promise.race([
      ai.models.generateContent({
        model: "gemini-2.0-flash",
        contents:
          "RWDNEWS editorial assistant. Use ONLY the supplied title and description. Never invent facts, numbers, names, dates or causes. Write a clear non-clickbait headline and exactly two concise factual bullets. Return JSON. TITLE: " +
          title +
          " DESCRIPTION: " +
          desc,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              ai_hook_title: { type: Type.STRING },
              ai_summary: { type: Type.ARRAY, items: { type: Type.STRING } },
              tags: { type: Type.ARRAY, items: { type: Type.STRING } },
            },
            required: ["ai_hook_title", "ai_summary", "tags"],
          },
        },
      }),
      new Promise<null>((_, reject) => setTimeout(() => reject(new Error("AI timeout")), 3500)),
    ]);
    const text = (response as any)?.text;
    if (!text) return fallback;
    const parsed = JSON.parse(text);
    return {
      ai_hook_title: clean(parsed.ai_hook_title) || fallback.ai_hook_title,
      ai_summary: [
        clean(parsed.ai_summary?.[0]) || fallback.ai_summary[0],
        clean(parsed.ai_summary?.[1]) || fallback.ai_summary[1],
      ],
      tags: (Array.isArray(parsed.tags) ? parsed.tags : fallback.tags).map((x: string) =>
        x.startsWith("#") ? x : "#" + x,
      ).slice(0, 4),
    };
  } catch {
    return fallback;
  }
}

function dedupe(items: any[]) {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (!item.title || !item.link) return false;
    try {
      const u = new URL(item.link);
      u.hash = "";
      const key = u.toString().replace(/\/$/, "");
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    } catch {
      return false;
    }
  });
}

async function buildArticles(): Promise<NewsArticle[]> {
  const [rssItems, gdeltItems] = await Promise.all([getRss(), getGdelt()]);
  const items = scoreItems(dedupe([...rssItems, ...gdeltItems]))
    .sort((a, b) => b.trendScore - a.trendScore)
    .slice(0, 20);

  const results = await Promise.all(items.map(async (item) => {
    const section = category(item.title + " " + item.desc, item.category);
    const brief = await aiBrief(item.title, item.desc);
    const image = item.image && /^https?:\/\//i.test(item.image) ? item.image : svgImage(item.title, section);
    return {
      id: "news-" + Buffer.from(item.link).toString("base64url").slice(0, 28),
      original_url: item.link,
      image,
      timestamp: item.date && !Number.isNaN(new Date(item.date).getTime())
        ? new Date(item.date).toISOString()
        : new Date().toISOString(),
      source: item.source,
      original_title: item.title,
      original_description: item.desc,
      ai_hook_title: brief.ai_hook_title,
      ai_summary: brief.ai_summary,
      tags: brief.tags,
      read_time: Math.max(2, Math.ceil((item.title + " " + item.desc).split(/\s+/).length / 180)) + " min read",
      category: section,
      trend_score: item.trendScore,
      trend_label: item.trendLabel,
      image_credit: item.image ? item.source : "RWDNEWS editorial graphic",
      image_license: item.image ? "Publisher feed image — verify rights before commercial reuse" : "RWDNEWS generated",
      image_source_url: item.image ? item.link : "",
      discovered_via: item.sources,
    } satisfies NewsArticle;
  }));
  return results;
}

async function persist(articles: NewsArticle[]) {
  const url = Netlify.env.get("SUPABASE_URL") || Netlify.env.get("VITE_SUPABASE_URL");
  const key = Netlify.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) return 0;
  const db = createClient(url, key);
  let saved = 0;
  for (const a of articles) {
    const { error } = await db.from("articles").upsert({
      id: a.id,
      original_url: a.original_url,
      original_title: a.original_title,
      original_description: a.original_description,
      ai_hook_title: a.ai_hook_title,
      ai_summary: a.ai_summary,
      tags: a.tags,
      source: a.source,
      image: a.image,
      read_time: a.read_time,
      timestamp: a.timestamp,
    }, { onConflict: "original_url" });
    if (!error) saved++;
  }
  return saved;
}

export async function runIngest() {
  const articles = await buildArticles();
  const saved = articles.length ? await persist(articles) : 0;
  return { articles, saved, generatedAt: new Date().toISOString() };
}

export default async (req: Request) => {
  const url = new URL(req.url);
  if (url.pathname.includes("/cron-ingest")) {
    const secret = Netlify.env.get("CRON_SECRET") || "";
    const supplied = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") || url.searchParams.get("secret") || "";
    if (!secret || supplied !== secret) {
      return new Response(JSON.stringify({ ok: false, error: "Unauthorized" }), { status: 401 });
    }
  }

  try {
    const result = await runIngest();
    return new Response(JSON.stringify({
      articles: result.articles,
      count: result.articles.length,
      saved: result.saved,
      generatedAt: result.generatedAt,
    }), {
      headers: { "content-type": "application/json; charset=utf-8", "cache-control": "public, max-age=60, stale-while-revalidate=300" },
    });
  } catch (error) {
    console.error("[RWDNEWS] live ingest failed", error);
    return new Response(JSON.stringify({
      articles: [],
      error: "Live news sources are temporarily unavailable.",
    }), {
      status: 503,
      headers: { "content-type": "application/json; charset=utf-8" },
    });
  }
};
