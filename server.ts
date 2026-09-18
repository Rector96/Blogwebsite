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
}

const rssParser = new Parser({
  headers: {
    "User-Agent":
      "Mozilla/5.0 (compatible; FinSignal/1.0; +https://finsignal.news)",
    Accept: "application/rss+xml, application/xml, text/xml, */*",
  },
  timeout: 2500,
});

const RSS_FEED_URLS = [
  { url: "https://finance.yahoo.com/news/rssindex", source: "Yahoo Finance" },
  { url: "https://www.finextra.com/rss/headlines.aspx", source: "Finextra" },
  {
    url: "https://feeds.content.dowjones.io/public/rss/mw_topstories",
    source: "MarketWatch",
  },
];

const EDITORIAL_FINANCE_IMAGES = [
  "https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1559526324-4b87b5e36e44?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1590283603385-17ffb3a7f29f?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1563986768609-322da13575f3?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1526304640581-d334cdbbf45e?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1551836022-d5d88e9218df?auto=format&fit=crop&w=1200&q=80",
];

const INITIAL_SEED_ARTICLES: EnrichedArticle[] = [
  {
    id: "news-seed-1",
    original_url:
      "https://www.marketwatch.com/personal-finance/banking/high-yield-cash-sweeps",
    image: EDITORIAL_FINANCE_IMAGES[0],
    timestamp: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
    source: "MarketWatch",
    original_title:
      "Treasury Yield Inversion Normalizes as Neobanks Shift Savings Sweep Yields to 5.15%",
    original_description:
      "Digital banking platforms leverage multi-bank custodial networks to deliver elevated cash yields.",
    ai_hook_title:
      "High-yield cash sweeps hit 5.15% as fintechs compete for uninvested deposits",
    ai_summary: [
      "Cash yields have detached from near-zero legacy savings rates.",
      "Multi-bank sweeps can extend deposit insurance while keeping liquidity.",
    ],
    tags: ["#Banking", "#PersonalFinance", "#Fintech"],
    read_time: "3 min read",
  },
  {
    id: "news-seed-2",
    original_url:
      "https://www.consumerfinance.gov/about-us/newsroom/cfpb-finalizes-personal-financial-data-rights/",
    image: EDITORIAL_FINANCE_IMAGES[1],
    timestamp: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
    source: "CFPB",
    original_title:
      "CFPB Rule 1033 Mandates Consumer Financial Data Portability",
    original_description:
      "Open banking rules phase out screen-scraping in favor of secure APIs.",
    ai_hook_title:
      "Open banking Rule 1033: secure API portability aims to end password scraping",
    ai_summary: [
      "Regulators prefer signed bank tokens over shared credentials.",
      "Budget apps can connect accounts with less friction when banks comply.",
    ],
    tags: ["#Regulation", "#Fintech", "#Banking"],
    read_time: "4 min read",
  },
];

let cachedArticles: EnrichedArticle[] = [...INITIAL_SEED_ARTICLES];
let lastFetchTimestamp = 0;
const CACHE_TTL_MS = 10 * 60 * 1000;

function adminSupabase() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

async function fetchRawRssItems() {
  const collected: {
    title: string;
    link: string;
    contentSnippet: string;
    pubDate?: string;
    source: string;
  }[] = [];

  const feedPromises = RSS_FEED_URLS.map(async (feedConfig) => {
    try {
      const feed = await Promise.race([
        rssParser.parseURL(feedConfig.url),
        new Promise<null>((_, reject) =>
          setTimeout(() => reject(new Error("timeout")), 2000),
        ),
      ]);
      if (feed?.items?.length) {
        return feed.items.slice(0, 4).map((item) => ({
          title: (item.title || "").trim(),
          link: item.link || item.guid || "https://finance.yahoo.com",
          contentSnippet: (item.contentSnippet || item.content || "")
            .slice(0, 280)
            .trim(),
          pubDate: item.pubDate,
          source: feedConfig.source,
        }));
      }
    } catch {
      /* resilient */
    }
    return [];
  });

  const results = await Promise.allSettled(feedPromises);
  results.forEach((res) => {
    if (res.status === "fulfilled") collected.push(...res.value);
  });

  return collected.slice(0, 12);
}

function heuristicAI(title: string, desc: string) {
  const lower = `${title} ${desc}`.toLowerCase();
  const tags: string[] = [];
  if (lower.includes("bank")) tags.push("#Banking");
  if (lower.includes("invest") || lower.includes("yield")) tags.push("#Investing");
  if (lower.includes("fintech") || lower.includes("app")) tags.push("#Fintech");
  if (lower.includes("pay")) tags.push("#Payments");
  if (lower.includes("credit") || lower.includes("loan")) tags.push("#Credit");
  if (tags.length < 2) tags.push("#PersonalFinance", "#Fintech");
  return {
    ai_hook_title: title.replace(/^(\[.*?\]|BREAKING:?)/i, "").trim(),
    ai_summary: [
      desc?.split(".")[0]
        ? `${desc.split(".")[0].trim()}.`
        : "Material for household cash, credit, or investment decisions.",
      "Verify details on the original publisher before acting.",
    ] as [string, string],
    tags: tags.slice(0, 3),
  };
}

async function processArticleWithAI(title: string, description: string) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return heuristicAI(title, description);

  try {
    const ai = new GoogleGenAI({ apiKey });
    const prompt = `Finance news. Title: "${title}". Description: "${description}". Return JSON: {"ai_hook_title":"...","ai_summary":["why it matters 1","why it matters 2"],"tags":["#Tag1","#Tag2"]}`;
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
      new Promise<null>((_, reject) =>
        setTimeout(() => reject(new Error("AI timeout")), 2500),
      ),
    ]);
    if (response && (response as { text?: string }).text) {
      const parsed = JSON.parse((response as { text: string }).text);
      if (parsed.ai_hook_title && Array.isArray(parsed.ai_summary)) {
        return {
          ai_hook_title: String(parsed.ai_hook_title).trim(),
          ai_summary: [
            String(parsed.ai_summary[0] || "").trim(),
            String(parsed.ai_summary[1] || "See original source for full context.").trim(),
          ] as [string, string],
          tags: (parsed.tags || ["#Fintech"])
            .map((t: string) => (t.startsWith("#") ? t : `#${t}`))
            .slice(0, 3),
        };
      }
    }
  } catch {
    /* fallback */
  }
  return heuristicAI(title, description);
}

async function aggregateAndEnrichNews(): Promise<EnrichedArticle[]> {
  const rawItems = await fetchRawRssItems();
  if (!rawItems.length) return cachedArticles.length ? cachedArticles : INITIAL_SEED_ARTICLES;

  const enriched: EnrichedArticle[] = [];
  for (let i = 0; i < rawItems.length; i++) {
    const raw = rawItems[i];
    if (!raw.title || !raw.link) continue;
    const aiData = await processArticleWithAI(raw.title, raw.contentSnippet);
    const words = `${raw.title} ${raw.contentSnippet}`.split(/\s+/).length;
    enriched.push({
      id: `news-${Date.now().toString(36)}-${i}`,
      original_url: raw.link,
      image: EDITORIAL_FINANCE_IMAGES[i % EDITORIAL_FINANCE_IMAGES.length],
      timestamp: raw.pubDate
        ? new Date(raw.pubDate).toISOString()
        : new Date(Date.now() - i * 20 * 60 * 1000).toISOString(),
      source: raw.source,
      original_title: raw.title,
      original_description: raw.contentSnippet,
      ai_hook_title: aiData.ai_hook_title,
      ai_summary: aiData.ai_summary,
      tags: aiData.tags,
      read_time: `${Math.max(2, Math.ceil(words / 200))} min read`,
    });
  }
  return enriched.length ? enriched : cachedArticles;
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
  const persist = await persistToSupabase(articles);
  return { articles, cached: false, persist };
}

app.get("/api/news", async (req: Request, res: Response) => {
  try {
    const force = String(req.query.refresh || "") === "true";
    const result = await runIngest(force);
    res.json({ articles: result.articles, cached: result.cached });
  } catch (e) {
    console.error(e);
    res.json({ articles: cachedArticles.length ? cachedArticles : INITIAL_SEED_ARTICLES });
  }
});

/** cron-job.org → every 30–60 min */
app.get("/api/cron/ingest", async (req: Request, res: Response) => {
  if (!assertCronAuth(req)) {
    res.status(401).json({ ok: false, error: "Unauthorized" });
    return;
  }
  try {
    const result = await runIngest(true);
    res.json({
      ok: true,
      count: result.articles.length,
      persist: result.persist,
      at: new Date().toISOString(),
    });
  } catch (e) {
    res.status(500).json({
      ok: false,
      error: e instanceof Error ? e.message : "Ingest failed",
    });
  }
});

app.post("/api/cron/ingest", async (req: Request, res: Response) => {
  if (!assertCronAuth(req)) {
    res.status(401).json({ ok: false, error: "Unauthorized" });
    return;
  }
  try {
    const result = await runIngest(true);
    res.json({
      ok: true,
      count: result.articles.length,
      persist: result.persist,
      at: new Date().toISOString(),
    });
  } catch (e) {
    res.status(500).json({
      ok: false,
      error: e instanceof Error ? e.message : "Ingest failed",
    });
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
        let template = await vite.transformIndexHtml(
          url,
          await (await import("fs")).promises.readFile(
            path.resolve("index.html"),
            "utf-8",
          ),
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
    console.log(`FinSignal on http://localhost:${PORT}`);
  });
}

start();
