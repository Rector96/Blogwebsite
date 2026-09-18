import express, { Request, Response } from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import Parser from "rss-parser";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT) || 3000;
app.use(express.json());

export interface EnrichedArticle {
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
  category?: string;
  trend_score?: number;
  trend_label?: "Trending" | "Developing" | "Fresh";
  image_credit?: string;
  image_license?: string;
  image_source_url?: string;
  discovered_via?: string[];
}

const rssParser = new Parser({
  headers: {
    "User-Agent":
      "Mozilla/5.0 (compatible; RWDNEWS/1.0; +https://rwdnews.netlify.app)",
    Accept: "application/rss+xml, application/xml, text/xml, */*",
  },
  timeout: 3500,
});

const RSS_FEED_URLS = [
  { url: "https://finance.yahoo.com/news/rssindex", source: "Yahoo Finance" },
  { url: "https://www.finextra.com/rss/headlines.aspx", source: "Finextra" },
  { url: "https://feeds.content.dowjones.io/public/rss/mw_topstories", source: "MarketWatch" },
  { url: "https://www.aljazeera.com/xml/rss/all.xml", source: "Al Jazeera" },
  { url: "https://techcrunch.com/feed/", source: "TechCrunch" },
  { url: "https://www.coindesk.com/arc/outboundfeeds/rss/", source: "CoinDesk" },
];

const GDELT_QUERIES = [
  { query: "(finance OR markets OR banking OR economy OR companies)", category: "Business" },
  { query: '("artificial intelligence" OR AI OR technology OR cybersecurity OR chips)', category: "Tech" },
  { query: "(geopolitics OR diplomacy OR conflict OR election OR government)", category: "World" },
  { query: "(Africa OR Nigeria OR Kenya OR Ghana OR SouthAfrica OR Egypt)", category: "Africa" },
];

const STOP_WORDS = new Set([
  "the","and","for","with","from","that","this","after","before","into","over","under",
  "about","will","would","could","should","says","said","have","has","been","are","was",
  "were","their","they","them","than","then","what","when","where","while","which","who",
  "how","why","new","latest","news","report","reports","according","amid","more","most",
]);

let cachedArticles: EnrichedArticle[] = [];
let lastFetchTimestamp = 0;
const CACHE_TTL_MS = 10 * 60 * 1000;

const imageCache = new Map<string, {
  image: string;
  credit: string;
  license: string;
  sourceUrl: string;
}>();

function adminSupabase() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

function cleanText(value: unknown): string {
  return String(value || "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

function extractRssImage(item: any): string {
  const candidates = [
    item?.enclosure?.url,
    item?.["media:content"]?.url,
    item?.["media:thumbnail"]?.url,
    item?.["media:group"]?.["media:content"]?.url,
    item?.image?.url,
  ];
  return candidates.find((v) => typeof v === "string" && /^https?:\/\//i.test(v)) || "";
}

function normalizeWords(text: string): string[] {
  return cleanText(text)
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .map((word) => word.replace(/^-+|-+$/g, ""))
    .filter((word) => word.length >= 4 && !STOP_WORDS.has(word));
}

function categoryForText(text: string, hint?: string): string {
  if (hint) return hint;
  const lower = text.toLowerCase();
  if (/\b(ai|artificial intelligence|chip|semiconductor|software|cyber|robot|technology|tech)\b/.test(lower)) return "Tech";
  if (/\b(africa|nigeria|kenya|ghana|south africa|egypt|lagos|abuja)\b/.test(lower)) return "Africa";
  if (/\b(election|president|government|minister|parliament|diplomacy|war|conflict|sanction)\b/.test(lower)) return "World";
  if (/\b(bitcoin|crypto|ethereum|blockchain)\b/.test(lower)) return "Crypto";
  if (/\b(bank|fintech|payment|credit|loan|money|inflation|rate|market|stock|economy|company|earnings)\b/.test(lower)) return "Business";
  return "World";
}

function fallbackEditorialImage(title: string, category: string) {
  const safeTitle = cleanText(title).slice(0, 74).replace(/&/g, "and");
  const svg =
    "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1600 900'>" +
    "<defs><linearGradient id='g' x1='0' x2='1'><stop offset='0' stop-color='#071a2d'/><stop offset='1' stop-color='#0f766e'/></linearGradient></defs>" +
    "<rect width='1600' height='900' fill='url(#g)'/>" +
    "<text x='90' y='120' fill='#f59e0b' font-family='Arial' font-size='30' font-weight='700'>RWDNEWS · " +
    category.toUpperCase() +
    "</text><text x='90' y='760' fill='white' font-family='Arial' font-size='58' font-weight='700'>" +
    safeTitle +
    "</text></svg>";
  return "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(svg);
}

async function fetchRawRssItems() {
  const collected: Array<{
    title: string;
    link: string;
    contentSnippet: string;
    pubDate?: string;
    source: string;
    image?: string;
    category: string;
  }> = [];

  const results = await Promise.allSettled(
    RSS_FEED_URLS.map(async (feedConfig) => {
      try {
        const feed = await Promise.race([
          rssParser.parseURL(feedConfig.url),
          new Promise<null>((_, reject) => setTimeout(() => reject(new Error("RSS timeout")), 3200)),
        ]);
        if (!feed?.items?.length) return [];
        return feed.items.slice(0, 8).map((item: any) => ({
          title: cleanText(item.title),
          link: item.link || item.guid || "",
          contentSnippet: cleanText(item.contentSnippet || item.content || item.summary).slice(0, 500),
          pubDate: item.pubDate || item.isoDate,
          source: feedConfig.source,
          image: extractRssImage(item),
          category: categoryForText((item.title || "") + " " + (item.contentSnippet || item.content || "")),
        }));
      } catch {
        return [];
      }
    }),
  );

  for (const result of results) {
    if (result.status === "fulfilled") collected.push(...result.value);
  }
  return collected;
}

async function fetchGdeltItems() {
  const results = await Promise.allSettled(
    GDELT_QUERIES.map(async ({ query, category }) => {
      const url = new URL("https://api.gdeltproject.org/api/v2/doc/doc");
      url.searchParams.set("query", query);
      url.searchParams.set("mode", "artlist");
      url.searchParams.set("maxrecords", "20");
      url.searchParams.set("timespan", "3h");
      url.searchParams.set("sort", "datedesc");
      url.searchParams.set("format", "json");

      const response = await fetch(url, {
        headers: { "User-Agent": "RWDNEWS/1.0 news-discovery" },
        signal: AbortSignal.timeout(5000),
      });
      if (!response.ok) return [];
      const payload = (await response.json()) as any;
      const rows = Array.isArray(payload?.articles) ? payload.articles : [];
      return rows.map((row: any) => ({
        title: cleanText(row.title),
        link: String(row.url || ""),
        contentSnippet: cleanText(row.seendate ? "Published/seen " + row.seendate : ""),
        pubDate: row.seendate,
        source: cleanText(row.domain || "GDELT source"),
        image: String(row.socialimage || row.urlsocialimage || row.image || ""),
        category,
      }));
    }),
  );

  const collected: any[] = [];
  for (const result of results) {
    if (result.status === "fulfilled") collected.push(...result.value);
  }
  return collected;
}

function dedupeItems(items: any[]) {
  const byUrl = new Map<string, any>();
  for (const item of items) {
    if (!item.title || !item.link) continue;
    try {
      const url = new URL(item.link);
      url.hash = "";
      const key = url.toString().replace(/\/$/, "");
      if (!byUrl.has(key)) byUrl.set(key, item);
    } catch {
      /* ignore malformed URLs */
    }
  }
  return Array.from(byUrl.values());
}

function titleSimilarity(a: string, b: string) {
  const aa = new Set(normalizeWords(a));
  const bb = new Set(normalizeWords(b));
  if (!aa.size || !bb.size) return 0;
  let overlap = 0;
  for (const word of aa) if (bb.has(word)) overlap += 1;
  return overlap / Math.max(1, Math.min(aa.size, bb.size));
}

function applyTrendSignals(items: any[]) {
  const now = Date.now();
  return items.map((item) => {
    const cluster = items.filter((other) => titleSimilarity(item.title, other.title) >= 0.42);
    const domains = new Set(
      cluster.map((x) => {
        try {
          return new URL(x.link).hostname.replace(/^www\./, "");
        } catch {
          return x.source;
        }
      }),
    );
    const parsedTime = new Date(item.pubDate || now).getTime();
    const ageHours = Number.isNaN(parsedTime) ? 0 : Math.max(0, (now - parsedTime) / 3600000);
    const freshness = Math.max(0, 36 - ageHours * 4);
    const sourceSignal = Math.min(28, domains.size * 7);
    const clusterSignal = Math.min(35, cluster.length * 7);
    const score = Math.round(Math.min(100, freshness + sourceSignal + clusterSignal));
    const trendLabel =
      cluster.length >= 3 || score >= 70
        ? "Trending"
        : cluster.length >= 2 || score >= 48
          ? "Developing"
          : "Fresh";
    return {
      ...item,
      trend_score: score,
      trend_label: trendLabel,
      discovered_via: Array.from(new Set(cluster.map((x) => x.source))).slice(0, 5),
    };
  });
}

function heuristicAI(title: string, desc: string) {
  const firstSentence = cleanText(desc).split(/(?<=[.!?])\s+/)[0];
  const tags: string[] = [];
  const lower = title + " " + desc;
  if (/\b(ai|technology|tech|chip|cyber)\b/i.test(lower)) tags.push("#Tech");
  if (/\b(bank|fintech|payment|credit|money)\b/i.test(lower)) tags.push("#Fintech");
  if (/\b(bitcoin|crypto|ethereum)\b/i.test(lower)) tags.push("#Crypto");
  if (/\b(africa|nigeria|kenya|ghana)\b/i.test(lower)) tags.push("#Africa");
  if (/\b(market|stock|economy|rate|inflation|company)\b/i.test(lower)) tags.push("#Markets");
  if (!tags.length) tags.push("#World");
  return {
    ai_hook_title: title.replace(/^(\[.*?\]|BREAKING:?)/i, "").trim(),
    ai_summary: [
      firstSentence || "RWDNEWS is tracking this developing story from published sources.",
      "Read the linked source for the full report; RWDNEWS does not treat an unverified claim as established fact.",
    ],
    tags: Array.from(new Set(tags)).slice(0, 4),
  };
}

async function processArticleWithAI(title: string, description: string) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return heuristicAI(title, description);

  try {
    const ai = new GoogleGenAI({ apiKey });
    const prompt =
      "You are an editorial assistant for RWDNEWS. " +
      "Use ONLY the supplied title and description. Do not invent facts, quotes, numbers, people, dates, causes, or outcomes. " +
      "Rewrite the headline to be clear and compelling without clickbait. " +
      "Create exactly two short bullet summaries. If the supplied description is insufficient, explicitly say that more reporting is needed. " +
      "Return JSON. TITLE: " + title + " DESCRIPTION: " + description;

    const aiCall = ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: prompt,
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
    });

    const response = await Promise.race([
      aiCall,
      new Promise<null>((_, reject) => setTimeout(() => reject(new Error("AI timeout")), 3500)),
    ]);

    if (response && (response as { text?: string }).text) {
      const parsed = JSON.parse((response as { text: string }).text);
      if (parsed.ai_hook_title && Array.isArray(parsed.ai_summary)) {
        return {
          ai_hook_title: String(parsed.ai_hook_title).trim(),
          ai_summary: [
            String(parsed.ai_summary[0] || "").trim(),
            String(parsed.ai_summary[1] || "More reporting is needed for additional context.").trim(),
          ],
          tags: (parsed.tags || ["#World"])
            .map((t: string) => (t.startsWith("#") ? t : "#" + t))
            .slice(0, 4),
        };
      }
    }
  } catch {
    /* safe heuristic fallback */
  }
  return heuristicAI(title, description);
}

async function findWikimediaImage(title: string, category: string) {
  const words = normalizeWords(title).slice(0, 5);
  const key = category + ":" + words.join("-");
  const cached = imageCache.get(key);
  if (cached) return cached;

  const queries = [words.join(" "), category].filter(Boolean);

  for (const query of queries) {
    try {
      const url = new URL("https://commons.wikimedia.org/w/api.php");
      url.searchParams.set("action", "query");
      url.searchParams.set("generator", "search");
      url.searchParams.set("gsrsearch", query);
      url.searchParams.set("gsrnamespace", "6");
      url.searchParams.set("gsrlimit", "5");
      url.searchParams.set("prop", "imageinfo");
      url.searchParams.set("iiprop", "url|extmetadata");
      url.searchParams.set("iiurlwidth", "1400");
      url.searchParams.set("format", "json");
      url.searchParams.set("origin", "*");

      const response = await fetch(url, {
        headers: { "User-Agent": "RWDNEWS/1.0 image-discovery" },
        signal: AbortSignal.timeout(3000),
      });
      if (!response.ok) continue;

      const payload = (await response.json()) as any;
      const pages = Object.values(payload?.query?.pages || {}) as any[];
      const allowed = pages.find((page) => {
        const license = cleanText(
          page?.imageinfo?.[0]?.extmetadata?.LicenseShortName?.value,
        ).toLowerCase();
        return /cc0|cc by|cc-by|public domain|pdm/.test(license) && !/non.?commercial/.test(license);
      });
      if (!allowed?.imageinfo?.[0]) continue;

      const info = allowed.imageinfo[0];
      const meta = info.extmetadata || {};
      const result = {
        image: String(info.thumburl || info.url || ""),
        credit: cleanText(meta.Artist?.value || meta.Credit?.value || "Wikimedia Commons"),
        license: cleanText(meta.LicenseShortName?.value || "Open license"),
        sourceUrl: String(info.descriptionurl || info.url || ""),
      };
      if (result.image) {
        imageCache.set(key, result);
        return result;
      }
    } catch {
      /* image discovery is non-blocking */
    }
  }

  const fallback = {
    image: fallbackEditorialImage(title, category),
    credit: "RWDNEWS editorial graphic",
    license: "RWDNEWS generated",
    sourceUrl: "",
  };
  imageCache.set(key, fallback);
  return fallback;
}

async function enrichImages(items: any[]) {
  const results: EnrichedArticle[] = [];
  for (const item of items.slice(0, 24)) {
    const category = categoryForText(item.title + " " + item.contentSnippet, item.category);
    const image =
      item.image && /^https?:\/\//i.test(item.image)
        ? {
            image: item.image,
            credit: item.source,
            license: "Publisher feed image — verify rights before commercial reuse",
            sourceUrl: item.link,
          }
        : await findWikimediaImage(item.title, category);

    const aiData = await processArticleWithAI(item.title, item.contentSnippet);
    const words = (item.title + " " + item.contentSnippet).split(/\s+/).length;

    results.push({
      id: "news-" + Buffer.from(item.link).toString("base64url").slice(0, 28),
      original_url: item.link,
      image: image.image,
      timestamp:
        item.pubDate && !Number.isNaN(new Date(item.pubDate).getTime())
          ? new Date(item.pubDate).toISOString()
          : new Date().toISOString(),
      source: item.source,
      original_title: item.title,
      original_description: item.contentSnippet,
      ai_hook_title: aiData.ai_hook_title,
      ai_summary: aiData.ai_summary,
      tags: aiData.tags,
      read_time: Math.max(2, Math.ceil(words / 180)) + " min read",
      category,
      trend_score: item.trend_score,
      trend_label: item.trend_label,
      image_credit: image.credit,
      image_license: image.license,
      image_source_url: image.sourceUrl,
      discovered_via: item.discovered_via,
    });
  }
  return results;
}

async function aggregateAndEnrichNews(): Promise<EnrichedArticle[]> {
  const [rssItems, gdeltItems] = await Promise.all([fetchRawRssItems(), fetchGdeltItems()]);
  const items = dedupeItems([...rssItems, ...gdeltItems]);
  if (!items.length) return [];

  const trended = applyTrendSignals(items)
    .sort((a, b) => (b.trend_score || 0) - (a.trend_score || 0))
    .slice(0, 24);

  return enrichImages(trended);
}

async function persistToSupabase(articles: EnrichedArticle[]) {
  const sb = adminSupabase();
  if (!sb) return { saved: 0, skipped: true as const };

  let saved = 0;
  for (const a of articles) {
    const { error } = await sb.from("articles").upsert(
      {
        id: a.id,
        original_url: a.original_url,
        original_title: a.original_title,
        original_description: a.original_description || "",
        ai_hook_title: a.ai_hook_title,
        ai_summary: a.ai_summary,
        tags: a.tags,
        source: a.source,
        image: a.image,
        read_time: a.read_time,
        timestamp: a.timestamp,
      },
      { onConflict: "original_url" },
    );
    if (!error) saved += 1;
  }
  return { saved, skipped: false as const };
}

function assertCronAuth(req: Request): boolean {
  const secret = process.env.CRON_SECRET || "";
  if (!secret) return process.env.NODE_ENV !== "production";
  const q = String(req.query.secret || "");
  const header = String(req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  return q === secret || header === secret;
}

async function runIngest(force = false) {
  const now = Date.now();
  if (!force && now - lastFetchTimestamp < CACHE_TTL_MS && cachedArticles.length) {
    return { articles: cachedArticles, cached: true, persist: null };
  }

  const articles = await aggregateAndEnrichNews();
  cachedArticles = articles;
  lastFetchTimestamp = now;
  const persist = articles.length ? await persistToSupabase(articles) : null;
  return { articles, cached: false, persist };
}

app.get("/api/news", async (req: Request, res: Response) => {
  try {
    const force = String(req.query.refresh || "") === "true";
    const result = await runIngest(force);
    res.json({
      articles: result.articles,
      cached: result.cached,
      sourceCount: new Set(result.articles.flatMap((a) => a.discovered_via || [a.source])).size,
      generatedAt: new Date().toISOString(),
    });
  } catch (e) {
    console.error("[RWDNEWS] news ingest failed", e);
    res.status(503).json({
      articles: cachedArticles,
      cached: true,
      error: "Live news sources are temporarily unavailable.",
      generatedAt: new Date().toISOString(),
    });
  }
});

app.get("/api/cron/ingest", async (req: Request, res: Response) => {
  if (!assertCronAuth(req)) {
    res.status(401).json({ ok: false, error: "Unauthorized" });
    return;
  }
  try {
    const result = await runIngest(true);
    res.json({ ok: true, count: result.articles.length, persist: result.persist, at: new Date().toISOString() });
  } catch (e) {
    res.status(500).json({ ok: false, error: e instanceof Error ? e.message : "Ingest failed" });
  }
});

app.post("/api/cron/ingest", async (req: Request, res: Response) => {
  if (!assertCronAuth(req)) {
    res.status(401).json({ ok: false, error: "Unauthorized" });
    return;
  }
  try {
    const result = await runIngest(true);
    res.json({ ok: true, count: result.articles.length, persist: result.persist, at: new Date().toISOString() });
  } catch (e) {
    res.status(500).json({ ok: false, error: e instanceof Error ? e.message : "Ingest failed" });
  }
});

async function start() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "custom",
    });
    app.use(vite.middlewares);
    app.use("*", async (req, res, next) => {
      try {
        const url = req.originalUrl;
        const template = await vite.transformIndexHtml(
          url,
          await (await import("fs")).promises.readFile(path.resolve("index.html"), "utf-8"),
        );
        res.status(200).set({ "Content-Type": "text/html" }).end(template);
      } catch (e) {
        vite.ssrFixStacktrace(e as Error);
        next(e);
      }
    });
  } else {
    app.use(express.static(path.resolve("dist")));
    app.get("*", (_req, res) => {
      res.sendFile(path.resolve("dist", "index.html"));
    });
  }

  app.listen(PORT, () => {
    console.log("RWDNEWS on http://localhost:" + PORT);
  });
}

start();
