import Parser from "rss-parser";
import { GLOBAL_NEWS_SOURCES } from "./news-sources";
import { GoogleGenAI, Type } from "@google/genai";
import { createClient } from "@supabase/supabase-js";
import { resolveSafeCover } from "./safe-image.mjs";

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
  timeout: 6000,
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
  if (/\b(sport|football|soccer|nba|premier league|fifa|uefa|nfl|tennis|cricket)\b/.test(x)) return "Sports";
  if (/\b(bitcoin|crypto|ethereum|blockchain)\b/.test(x)) return "Crypto";
  if (/\b(ai|technology|tech|software|cyber|iphone|google|apple|microsoft)\b/.test(x)) return "Tech";
  if (/\b(market|stock|bank|economy|finance|oil|petrol|fed |ecb|inflation)\b/.test(x) || hint === "Business")
    return "Business";
  if (/\bnigeria|lagos|abuja|anambra|jigawa\b/.test(x)) return "Nigeria";
  if (/\bghana|accra\b/.test(x)) return "Ghana";
  if (/\bkenya|south africa|ethiopia|senegal|africa\b/.test(x) || region === "Africa") return "Africa";
  if (hint === "Nigeria" && /\b(lagos|abuja|nigeria)\b/.test(x)) return "Nigeria";
  if (hint === "Ghana" && /\b(ghana|accra)\b/.test(x)) return "Ghana";
  if (hint === "Africa") return "Africa";
  if (hint === "Sports" || hint === "Tech" || hint === "Crypto" || hint === "Business") return hint;
  if (hint === "World") return "World";
  if (region === "Nigeria" || region === "Ghana") {
    if (!/\bnigeria|ghana|lagos|abuja|accra\b/.test(x)) return "World";
  }
  if (hint) return hint;
  return "World";
}

function readingTime(words: number) {
  return `${Math.max(1, Math.ceil(Math.max(words, 1) / 180))} min read`;
}

const TREND_STOP = new Set([
  "about","after","again","also","been","being","before","could","from","have","into","more","over",
  "said","than","that","their","there","these","they","this","through","what","when","where","which",
  "while","with","would","will","news","report","reports","latest","today","world","official",
]);

function trendTokens(text: string) {
  return [...new Set(
    clean(text)
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[^a-z0-9\s-]/g, " ")
      .split(/\s+/)
      .filter((x) => x.length >= 4 && !TREND_STOP.has(x)),
  )].slice(0, 14);
}

function scoreTrend(item: any, all: any[]) {
  const baseTerms = new Set(trendTokens(item.title + " " + item.desc));
  const related = all.filter((other) => {
    if (other === item || other.category !== item.category) return false;
    const shared = trendTokens(other.title + " " + other.desc).filter((t) => baseTerms.has(t)).length;
    return shared >= Math.max(2, Math.min(3, Math.ceil(baseTerms.size / 5)));
  });
  const sources = [...new Set([item.source, ...related.map((x) => x.source)])];
  const ageHours = Math.max(0, (Date.now() - new Date(item.date).getTime()) / 3600000);
  const freshness = Math.max(0, 22 - ageHours * 1.2);
  const sourceSignal = Math.min(48, sources.length * 10);
  const velocity = Math.min(20, related.length * 4);
  return {
    score: Math.min(100, Math.round(25 + freshness + sourceSignal + velocity)),
    sources,
    related: related.slice(0, 6),
  };
}

function diversifyCandidates(
  items: Array<{
    title: string;
    link: string;
    desc: string;
    date: string;
    source: string;
    category: string;
    region: string;
    rssImage?: string;
  }>,
  limit = 28,
) {
  const buckets: Record<string, typeof items> = {
    World: [],
    Africa: [],
    Nigeria: [],
    Ghana: [],
    Business: [],
    Tech: [],
    Crypto: [],
    Sports: [],
  };
  const sorted = [...items].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  for (const item of sorted) {
    const key = buckets[item.category] ? item.category : "World";
    buckets[key].push(item);
  }
  const quotas: Record<string, number> = {
    World: 6,
    Africa: 3,
    Nigeria: 4,
    Ghana: 2,
    Business: 4,
    Tech: 4,
    Crypto: 2,
    Sports: 5,
  };
  const picked: typeof items = [];
  const used = new Set<string>();
  for (const [cat, max] of Object.entries(quotas)) {
    for (const item of buckets[cat] || []) {
      if (picked.length >= limit) break;
      if (used.has(item.link)) continue;
      used.add(item.link);
      picked.push(item);
      if (picked.filter((p) => p.category === cat).length >= max) break;
    }
  }
  for (const item of sorted) {
    if (picked.length >= limit) break;
    if (used.has(item.link)) continue;
    used.add(item.link);
    picked.push(item);
  }
  return picked.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

function extractRssImage(item: any): string {
  const enc = item.enclosure?.url || item.enclosures?.[0]?.url || "";
  if (enc && /^https?:\/\//i.test(enc) && /\.(jpe?g|png|webp|gif)/i.test(enc))
    return String(enc);
  const media =
    item["media:content"]?.$
      ?.url ||
    item["media:thumbnail"]?.$?.url ||
    item.image?.url ||
    "";
  if (media && /^https?:\/\//i.test(media)) return String(media);
  return "";
}

async function fetchFeedItems() {
  const feeds = GLOBAL_NEWS_SOURCES.map((s) => [s.url, s.name, s.region, s.category] as const);
  const results = await Promise.allSettled(
    feeds.map(async ([url, source, region, feedCategory]) => {
      try {
        const feed = await rss.parseURL(url);
        return (feed.items || []).slice(0, 8).map((item: any) => {
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
            rssImage: extractRssImage(item),
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
    image_query: title,
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
          "(2) body: 550-800 words in clear, natural language using only supported facts; explain what happened and why it matters. " +
          "(3) ai_summary: exactly 4 bullets 30-55 words each. " +
          "(4) tags: 2-4 hashtags. " +
          "(5) image_query: 3-8 precise words identifying the real person, event, place, product or subject shown in the story; do not invent a person or event. " +
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
              image_query: { type: Type.STRING },
            },
            required: ["ai_hook_title", "body", "ai_summary", "tags", "image_query"],
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
      image_query: clean(parsed.image_query) || fallback.image_query,
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

  const eligible = fresh.filter((i) => stripJunk(i.desc).length >= 60);
  const candidates = diversifyCandidates(
    eligible
      .map((item) => ({ item, trend: scoreTrend(item, eligible) }))
      .sort((a, b) => b.trend.score - a.trend.score)
      .map(({ item }) => item),
    28,
  );

  const maxAi = Math.max(0, Math.min(12, Number(process.env.GEMINI_MAX_NEW_STORIES_PER_INGEST || 8)));
  // Cap stock image API calls so cron stays under Netlify time limits
  const maxImages = Math.max(0, Math.min(12, Number(process.env.MAX_STOCK_IMAGES_PER_INGEST || 10)));
  let aiCalls = 0;
  let imageCalls = 0;
  const articles: NewsArticle[] = [];

  for (const item of candidates) {
    const existingArt = existingByUrl.get(item.link);
    if (existingArt) {
      const needsImageRepair = !existingArt.image || /rwdnews-logo\.svg/i.test(existingArt.image);
      if (!needsImageRepair) {
        articles.push(existingArt);
        continue;
      }
      if (imageCalls < maxImages) {
        try {
          const repair = await resolveSafeCover({
            title: existingArt.ai_hook_title || item.title,
            category: existingArt.category || item.category,
            preferredQuery: existingArt.ai_hook_title || item.title,
            preferStock: true,
          });
          if (repair.image && !/rwdnews-logo\.svg/i.test(repair.image)) {
            existingArt.image = repair.image;
            existingArt.image_credit = repair.image_credit || existingArt.image_credit;
            existingArt.image_license = repair.image_license || existingArt.image_license;
            existingArt.image_source_url = repair.image_source_url || existingArt.image_source_url;
            imageCalls++;
          }
        } catch {}
      }
      articles.push(existingArt);
      continue;
    }
    const trend = scoreTrend(item, eligible);
    let brief = {
      ai_hook_title: item.title,
      body: "",
      ai_summary: [item.desc.slice(0, 200)].filter(Boolean),
      tags: ["#" + (item.category || "World")],
      image_query: item.title,
    };
    if (aiCalls < maxAi) {
      brief = await aiBrief(item.title, item.desc);
      aiCalls++;
    }

    let image = PLACEHOLDER_IMAGE;
    let image_credit = item.source;
    let image_license = "Editorial";
    let image_source_url = item.link;

    if (imageCalls < maxImages) {
      try {
        const cover = await resolveSafeCover({
          title: brief.ai_hook_title || item.title,
          category: item.category,
          preferredQuery: brief.image_query || "",
          preferStock: true,
        });
        image = cover.image || PLACEHOLDER_IMAGE;
        image_credit = cover.image_credit || item.source;
        image_license = cover.image_license || "Editorial";
        image_source_url = cover.image_source_url || item.link;
        imageCalls++;
      } catch {
        /* keep placeholder */
      }
    }

    const bodyWords = brief.body.split(/\s+/).filter(Boolean).length;
    const id = "wire-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8);
    const publishedAt = new Date(item.date).toISOString();
    articles.push({
      id,
      original_url: item.link,
      image,
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
      trend_score: trend.score,
      trend_label: trend.score >= 82 ? "Breaking" : trend.score >= 65 ? "Trending" : trend.score >= 50 ? "Developing" : "Fresh",
      image_credit,
      image_license,
      image_source_url,
      discovered_via: trend.sources,
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
