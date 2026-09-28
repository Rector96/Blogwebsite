import Parser from "rss-parser";
import { GLOBAL_NEWS_SOURCES } from "./news-sources";
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
  region: string;
  trend_score: number;
  trend_label: "Breaking" | "Trending" | "Developing" | "Fresh";
  image_credit: string;
  image_license: string;
  image_source_url: string;
  discovered_via: string[];
  body?: string;
  story_type?: string;
  author_name?: string;
  subject?: string;
  editorial_status?: string;
  featured?: boolean;
  pinned?: boolean;
};

const PLACEHOLDER_IMAGE = "/rwdnews-logo.svg";

const rss = new Parser({
  headers: {
    "User-Agent": "RockBrief/1.0 (+https://rwdnews.netlify.app)",
    Accept: "application/rss+xml, application/xml, text/xml, */*",
  },
  timeout: 4000,
});

const clean = (value: unknown) =>
  String(value || "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();

function stripJunk(value: unknown) {
  let x = clean(value);
  x = x.replace(/\s*Read\s*More\s*:?\s*https?:\/\/\S+/gi, "");
  x = x.replace(/https?:\/\/\S+/gi, "");
  return x.replace(/\s+/g, " ").trim();
}

function category(text: string, hint?: string, region?: string) {
  const x = text.toLowerCase();
  if (/\b(sport|football|soccer|nba|premier league|fifa|uefa)\b/.test(x)) return "Sports";
  if (/\b(bitcoin|crypto|ethereum)\b/.test(x)) return "Crypto";
  if (/\b(ai|technology|tech|software|cyber)\b/.test(x)) return "Tech";
  if (/\b(market|stock|bank|economy|finance|oil)\b/.test(x) || hint === "Business") return "Business";
  if (hint === "Nigeria" || /\bnigeria|lagos|abuja\b/.test(x)) return "Nigeria";
  if (hint === "Ghana" || /\bghana|accra\b/.test(x)) return "Ghana";
  if (hint === "Africa" || region === "Africa" || /\bafrica\b/.test(x)) return "Africa";
  if (hint) return hint;
  return "World";
}

function readingTime(words: number) {
  return `${Math.max(1, Math.ceil(Math.max(words, 1) / 180))} min read`;
}

async function fetchFeedItems() {
  const feeds = GLOBAL_NEWS_SOURCES.map((s) => [s.url, s.name, s.region, s.category] as const);
  const results = await Promise.allSettled(
    feeds.map(async ([url, source, region, feedCategory]) => {
      try {
        const feed = await rss.parseURL(url);
        return (feed.items || []).slice(0, 10).map((item: any) => {
          const title = clean(item.title);
          const desc = stripJunk(item.contentSnippet || item.content || item.summary).slice(0, 1200);
          const date = item.isoDate || item.pubDate || new Date().toISOString();
          return {
            title,
            link: String(item.link || item.guid || ""),
            desc,
            date,
            source,
            category: category(title + " " + desc, feedCategory || undefined, region || undefined),
            region: region || "Global",
          };
        });
      } catch {
        return [];
      }
    }),
  );
  return results.flatMap((r) => (r.status === "fulfilled" ? r.value : []));
}

async function aiBrief(title: string, desc: string) {
  const fallback = {
    ai_hook_title: title.replace(/^(\[.*?\]|BREAKING:?)/i, "").trim() || title,
    body: "",
    ai_summary: [desc.slice(0, 280)].filter((x) => x.length > 20),
    tags: ["#World"],
  };
  const key = process.env["GEMINI_API_KEY"] || "";
  if (!key || !desc || desc.length < 40) return fallback;
  try {
    const ai = new GoogleGenAI({ apiKey: key });
    const response = await Promise.race([
      ai.models.generateContent({
        model: "gemini-2.0-flash",
        contents:
          "Create an original RockBrief news report from the source material. JSON only. " +
          "(1) ai_hook_title: factual headline. " +
          "(2) body: 450-650 words in paragraphs using only facts in the material; empty string if insufficient. " +
          "(3) ai_summary: exactly 4 bullets 30-55 words each. " +
          "(4) tags: 2-4 hashtags. " +
          "TITLE: " + title + " DESCRIPTION: " + desc,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              ai_hook_title: { type: Type.STRING },
              body: { type: Type.STRING },
              ai_summary: { type: Type.ARRAY, items: { type: Type.STRING } },
              tags: { type: Type.ARRAY, items: { type: Type.STRING } },
            },
            required: ["ai_hook_title", "body", "ai_summary", "tags"],
          },
        },
      }),
      new Promise<null>((_, reject) => setTimeout(() => reject(new Error("timeout")), 9000)),
    ]);
    const text = (response as any)?.text;
    if (!text) return fallback;
    const parsed = JSON.parse(text);
    const body = stripJunk(String(parsed.body || "")).slice(0, 12000);
    const bodyWords = body.split(/\s+/).filter(Boolean).length;
    return {
      ai_hook_title: clean(parsed.ai_hook_title) || fallback.ai_hook_title,
      body: bodyWords >= 400 ? body : "",
      ai_summary: (Array.isArray(parsed.ai_summary) ? parsed.ai_summary : fallback.ai_summary)
        .map((x: string) => stripJunk(x))
        .filter((x: string) => x.length > 15)
        .slice(0, 4),
      tags: (Array.isArray(parsed.tags) ? parsed.tags : ["#World"])
        .map((x: string) => (String(x).startsWith("#") ? String(x) : "#" + x))
        .slice(0, 4),
    };
  } catch {
    return fallback;
  }
}

function mapRow(a: any): NewsArticle {
  return {
    id: String(a.id),
    original_url: String(a.original_url || ""),
    image: String(a.image || PLACEHOLDER_IMAGE),
    timestamp: a.timestamp || new Date().toISOString(),
    source: String(a.source || "RockBrief"),
    original_title: String(a.original_title || a.ai_hook_title || ""),
    original_description: stripJunk(String(a.original_description || "")),
    ai_hook_title: String(a.ai_hook_title || a.original_title || ""),
    ai_summary: Array.isArray(a.ai_summary) ? a.ai_summary : [],
    tags: Array.isArray(a.tags) ? a.tags : [],
    read_time: String(a.read_time || "3 min read"),
    category: String(a.category || "World"),
    region: String(a.region || "Global"),
    trend_score: Number(a.trend_score || 0),
    trend_label: (a.trend_label as NewsArticle["trend_label"]) || "Fresh",
    image_credit: String(a.image_credit || a.source || ""),
    image_license: String(a.image_license || ""),
    image_source_url: String(a.image_source_url || a.original_url || ""),
    discovered_via: [String(a.source || "RockBrief")],
    body: String(a.body || ""),
    story_type: String(a.story_type || "WIRE"),
    author_name: String(a.author_name || ""),
    subject: String(a.subject || ""),
    editorial_status: String(a.editorial_status || "published"),
    featured: Boolean(a.featured),
    pinned: Boolean(a.pinned),
  };
}

async function getStoredArticles(): Promise<NewsArticle[]> {
  const url = process.env["SUPABASE_URL"] || process.env["VITE_SUPABASE_URL"] || "";
  const key = process.env["SUPABASE_SERVICE_ROLE_KEY"] || "";
  if (!url || !key) return [];
  try {
    const db = createClient(url, key);
    const { data, error } = await db
      .from("articles")
      .select("*")
      .eq("editorial_status", "published")
      .gte("timestamp", new Date(Date.now() - 7 * 24 * 3600000).toISOString())
      .order("timestamp", { ascending: false })
      .limit(80);
    if (error || !Array.isArray(data)) return [];
    return data.filter((a: any) => a?.original_url).map(mapRow);
  } catch {
    return [];
  }
}

export async function runIngest() {
  const existing = await getStoredArticles();
  const existingByUrl = new Map(existing.map((a) => [a.original_url, a]));
  const raw = await fetchFeedItems();
  const cutoff = Date.now() - 48 * 3600000;
  const seen = new Set<string>();
  const fresh = raw.filter((item) => {
    if (!item.title || !item.link) return false;
    const t = new Date(item.date || 0).getTime();
    if (!Number.isFinite(t) || t < cutoff) return false;
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

  const candidates = fresh
    .filter((i) => stripJunk(i.desc).length >= 60)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 24);

  const maxAi = Math.max(0, Math.min(12, Number(process.env.GEMINI_MAX_NEW_STORIES_PER_INGEST || 8)));
  let aiCalls = 0;
  const articles: NewsArticle[] = [];

  for (const item of candidates) {
    const existingArt = existingByUrl.get(item.link);
    if (existingArt) {
      articles.push(existingArt);
      continue;
    }
    let brief = {
      ai_hook_title: item.title,
      body: "",
      ai_summary: [item.desc.slice(0, 200)].filter(Boolean),
      tags: ["#" + (item.category || "World")],
    };
    if (aiCalls < maxAi) {
      brief = await aiBrief(item.title, item.desc);
      aiCalls++;
    }
    const bodyWords = brief.body.split(/\s+/).filter(Boolean).length;
    const id = "wire-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8);
    const publishedAt = new Date(item.date).toISOString();
    articles.push({
      id,
      original_url: item.link,
      image: PLACEHOLDER_IMAGE,
      timestamp: publishedAt,
      source: item.source,
      original_title: item.title,
      original_description: item.desc.slice(0, 500),
      ai_hook_title: brief.ai_hook_title,
      ai_summary: brief.ai_summary,
      tags: brief.tags,
      read_time: readingTime(bodyWords || 120),
      category: item.category,
      region: item.region,
      trend_score: 50,
      trend_label: "Fresh",
      image_credit: item.source,
      image_license: "Editorial",
      image_source_url: item.link,
      discovered_via: [item.source],
      body: brief.body,
      story_type: "WIRE",
      author_name: "RockBrief Wire",
      subject: "",
      editorial_status: "published",
      featured: false,
      pinned: false,
    });
  }

  const map = new Map<string, NewsArticle>();
  for (const a of [...existing, ...articles]) {
    if (a.original_url) map.set(a.original_url, a);
  }
  const merged = Array.from(map.values()).sort(
    (a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp),
  );

  let saved = 0;
  const url = process.env["SUPABASE_URL"] || process.env["VITE_SUPABASE_URL"] || "";
  const key = process.env["SUPABASE_SERVICE_ROLE_KEY"] || "";
  if (url && key) {
    try {
      const db = createClient(url, key);
      const newOnes = articles.filter((a) => !existingByUrl.has(a.original_url));
      if (newOnes.length) {
        const rows = newOnes.map((a) => ({
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
          editorial_status: "published",
          story_type: "WIRE",
          body: a.body || "",
          category: a.category,
          region: a.region,
          image_credit: a.image_credit,
          image_license: a.image_license,
          image_source_url: a.image_source_url,
          author_name: a.author_name,
        }));
        const { error } = await db.from("articles").upsert(rows, { onConflict: "original_url" });
        if (!error) saved = rows.length;
        else console.error("[RockBrief] upsert error", error.message);
      }
    } catch (e) {
      console.error("[RockBrief] save failed", e);
    }
  }

  return { articles: merged.slice(0, 60), saved, generatedAt: new Date().toISOString() };
}

export async function handler(event: any) {
  try {
    const qs = event?.queryStringParameters || {};
    const refresh = qs.refresh === "true" || qs.refresh === "1";
    let articles: NewsArticle[] = await getStoredArticles();
    if (refresh || !articles.length) {
      const result = await runIngest();
      articles = result.articles;
    }
    articles = [...articles].sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp));
    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": refresh ? "no-store" : "public, max-age=60, stale-while-revalidate=300",
      },
      body: JSON.stringify({ articles: articles.slice(0, 60), generatedAt: new Date().toISOString() }),
    };
  } catch (e) {
    return {
      statusCode: 502,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        error: e instanceof Error ? e.message : "News error",
        articles: [],
      }),
    };
  }
}
