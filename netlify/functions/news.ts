import Parser from "rss-parser";
import { GLOBAL_NEWS_SOURCES } from "./news-sources";
import { GoogleGenAI, Type } from "@google/genai";
import { createClient } from "@supabase/supabase-js";
import { resolveSafeCover } from "./safe-image.mjs";
import { enhancedAiBrief, MIN_BODY_WORDS, MIN_BULLET_WORDS, BULLET_COUNT } from "./ai-brief-enhanced.mjs";

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

function validatePublishableArticle(article: NewsArticle) {
  const bodyWords = String(article.body || "").split(/\s+/).filter(Boolean).length;
  const title = clean(article.ai_hook_title || article.original_title);
  const sourceUrl = String(article.original_url || "");
  const summary = Array.isArray(article.ai_summary)
    ? article.ai_summary.map((x) => clean(x)).filter(Boolean)
    : [];
  const hasRealImage =
    Boolean(article.image) && !String(article.image).toLowerCase().includes("rwdnews-logo.svg");
  const hasImageEvidence = Boolean(article.image_source_url) && Boolean(article.image_credit);
  const validUrl = sourceUrl.startsWith("http://") || sourceUrl.startsWith("https://");
  const minBody = typeof MIN_BODY_WORDS === "number" ? MIN_BODY_WORDS : 500;
  const minBullet = typeof MIN_BULLET_WORDS === "number" ? MIN_BULLET_WORDS : 35;
  const needBullets = typeof BULLET_COUNT === "number" ? BULLET_COUNT : 4;
  const safeSummary =
    summary.length >= needBullets &&
    summary
      .slice(0, needBullets)
      .every((x) => x.split(/\s+/).filter(Boolean).length >= Math.min(20, minBullet));
  return Boolean(
    title &&
      title.length >= 20 &&
      validUrl &&
      bodyWords >= minBody &&
      safeSummary &&
      (hasRealImage ? hasImageEvidence : true),
  );
}

function needsBodyRepair(article: NewsArticle) {
  const bodyWords = String(article.body || "").split(/\s+/).filter(Boolean).length;
  const summary = Array.isArray(article.ai_summary) ? article.ai_summary.filter(Boolean) : [];
  const minBody = typeof MIN_BODY_WORDS === "number" ? MIN_BODY_WORDS : 500;
  return bodyWords < minBody || summary.length < 4;
}

const rss = new Parser({
  headers: {
    "User-Agent": "RockBrief/1.0 (+https://rwdnews.netlify.app)",
    Accept: "application/rss+xml, application/xml, text/xml, */*",
  },
  timeout: 6000,
});

const clean = (value: unknown) =>
  String(value || "")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

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
  "about", "after", "again", "also", "been", "being", "before", "could", "from", "have", "into", "more", "over",
  "said", "than", "that", "their", "there", "these", "they", "this", "through", "what", "when", "where", "which",
  "while", "with", "would", "will", "news", "report", "reports", "latest", "today", "world", "official",
]);

function trendTokens(text: string) {
  return [
    ...new Set(
      clean(text)
        .toLowerCase()
        .normalize("NFKD")
        .replace(/[^a-z0-9\s-]/g, " ")
        .split(/\s+/)
        .filter((x) => x.length >= 4 && !TREND_STOP.has(x)),
    ),
  ].slice(0, 14);
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
  if (enc && /^https?:\/\//i.test(enc) && /\.(jpe?g|png|webp|gif)/i.test(enc)) return String(enc);
  const media =
    item["media:content"]?.$?.url || item["media:thumbnail"]?.$?.url || item.image?.url || "";
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

async function aiBrief(title: string, desc: string, related: any[] = [], useGrounding = false) {
  // Always returns non-empty structured body (Gemini or deterministic fallback)
  return await enhancedAiBrief(title, desc, related, useGrounding);
}

export async function generateDevelopingUpdate(input: {
  title: string;
  previousBody: string;
  reports: Array<{ title: string; description: string; source: string; timestamp: string }>;
}) {
  const key = process.env["GEMINI_API_KEY"] || "";
  if (!key || !input.previousBody || !input.reports.length) return null;
  try {
    const ai = new GoogleGenAI({ apiKey: key });
    const response = await Promise.race([
      ai.models.generateContent({
        model: "gemini-2.0-flash",
        contents:
          "You are the RockBrief developing-story editor. Produce a factual update using only supported information. " +
          "updated_body must be 650-900 words. JSON only. " +
          "EXISTING TITLE: " +
          input.title +
          " EXISTING ARTICLE: " +
          input.previousBody +
          " NEW REPORTS: " +
          JSON.stringify(input.reports.slice(0, 6)),
        config: {
          tools: [{ googleSearch: {} }],
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              meaningful_update: { type: Type.BOOLEAN },
              updated_title: { type: Type.STRING },
              updated_body: { type: Type.STRING },
              update_summary: { type: Type.STRING },
            },
            required: ["meaningful_update", "updated_title", "updated_body", "update_summary"],
          },
        },
      }),
      new Promise<null>((_, reject) => setTimeout(() => reject(new Error("update timeout")), 28000)),
    ]);
    const parsed = JSON.parse((response as any)?.text || "{}");
    const body = stripJunk(String(parsed.updated_body || ""));
    const minBody = typeof MIN_BODY_WORDS === "number" ? MIN_BODY_WORDS : 500;
    const meaningful = Boolean(parsed.meaningful_update) && body.split(/\s+/).filter(Boolean).length >= minBody;
    if (!meaningful) return null;
    return {
      updated_title: clean(parsed.updated_title) || input.title,
      updated_body: body.slice(0, 16000),
      update_summary: stripJunk(String(parsed.update_summary || "")),
    };
  } catch {
    return null;
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
    discovered_via:
      Array.isArray(a.discovered_via) && a.discovered_via.length
        ? a.discovered_via.map(String)
        : [String(a.source || "RockBrief")],
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
    // Keep thin rows so ingest can repair empty bodies
    return data.map(mapRow);
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
  const maxImages = Math.max(0, Math.min(12, Number(process.env.MAX_STOCK_IMAGES_PER_INGEST || 10)));
  let aiCalls = 0;
  let imageCalls = 0;
  const articles: NewsArticle[] = [];
  const repairedExisting: NewsArticle[] = [];
  const minBody = typeof MIN_BODY_WORDS === "number" ? MIN_BODY_WORDS : 500;

  for (const item of candidates) {
    const existingArt = existingByUrl.get(item.link);
    const trend = scoreTrend(item, eligible);
    if (existingArt) {
      if (needsBodyRepair(existingArt) && aiCalls < maxAi) {
        try {
          aiCalls++;
          const brief = await aiBrief(
            existingArt.ai_hook_title || item.title,
            item.desc || existingArt.original_description || "",
            trend.related || [],
            false,
          );
          const bw = String(brief?.body || "").split(/\s+/).filter(Boolean).length;
          if (brief?.body && bw >= minBody) {
            existingArt.body = brief.body;
            if (Array.isArray(brief.ai_summary) && brief.ai_summary.length >= 4) {
              existingArt.ai_summary = brief.ai_summary;
            }
            if (brief.ai_hook_title) existingArt.ai_hook_title = brief.ai_hook_title;
            if (brief.image_query) existingArt.subject = brief.image_query;
            existingArt.read_time = readingTime(bw);
            repairedExisting.push(existingArt);
          }
        } catch {
          /* keep existing */
        }
      }
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
            preferredQuery: existingArt.subject || existingArt.ai_hook_title || item.title,
            rssImage: item.rssImage || "",
            preferStock: true,
            preferCrest: true,
          });
          if (repair.image && !/rwdnews-logo\.svg/i.test(repair.image)) {
            existingArt.image = repair.image;
            existingArt.image_credit = repair.image_credit || existingArt.image_credit;
            existingArt.image_license = repair.image_license || existingArt.image_license;
            existingArt.image_source_url = repair.image_source_url || existingArt.image_source_url;
            imageCalls++;
            repairedExisting.push(existingArt);
          }
        } catch {
          /* keep */
        }
      }
      articles.push(existingArt);
      continue;
    }

    if (aiCalls >= maxAi) continue;
    aiCalls++;
    let brief: any;
    try {
      brief = await aiBrief(item.title, item.desc, trend.related || [], false);
    } catch {
      continue;
    }
    if (!brief?.body || String(brief.body).split(/\s+/).filter(Boolean).length < minBody) continue;

    let image = PLACEHOLDER_IMAGE;
    let image_credit = item.source;
    let image_license = "";
    let image_source_url = item.link;
    if (imageCalls < maxImages) {
      try {
        const cover = await resolveSafeCover({
          title: brief.ai_hook_title || item.title,
          category: item.category,
          preferredQuery: brief.image_query || item.title,
          rssImage: item.rssImage || "",
          preferStock: true,
          preferCrest: /sport/i.test(item.category),
        });
        if (cover.image) {
          image = cover.image;
          image_credit = cover.image_credit || image_credit;
          image_license = cover.image_license || "";
          image_source_url = cover.image_source_url || item.link;
          imageCalls++;
        }
      } catch {
        /* placeholder */
      }
    }

    const id = Buffer.from(item.link).toString("base64url").slice(0, 24);
    const bodyWords = String(brief.body).split(/\s+/).filter(Boolean).length;
    articles.push({
      id,
      original_url: item.link,
      image,
      timestamp: item.date || new Date().toISOString(),
      source: item.source,
      original_title: item.title,
      original_description: item.desc,
      ai_hook_title: brief.ai_hook_title || item.title,
      ai_summary: brief.ai_summary || [],
      tags: brief.tags || ["#World"],
      read_time: readingTime(bodyWords),
      category: item.category,
      region: item.region,
      trend_score: trend.score,
      trend_label: trend.score >= 75 ? "Trending" : trend.score >= 55 ? "Developing" : "Fresh",
      image_credit,
      image_license,
      image_source_url,
      discovered_via: trend.sources?.length ? trend.sources : [item.source],
      body: brief.body,
      story_type: "WIRE",
      author_name: "RockBrief Wire",
      subject: brief.image_query || "",
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
        trend_score: a.trend_score,
        trend_label: a.trend_label,
        discovered_via: a.discovered_via,
        image_credit: a.image_credit,
        image_license: a.image_license,
        image_source_url: a.image_source_url,
        author_name: a.author_name,
        subject: a.subject || "",
      }));
      const repairRows = repairedExisting.map((a) => ({
        id: a.id,
        original_url: a.original_url,
        image: a.image,
        image_credit: a.image_credit,
        image_license: a.image_license,
        image_source_url: a.image_source_url,
        body: a.body || "",
        ai_summary: a.ai_summary || [],
        ai_hook_title: a.ai_hook_title || "",
        read_time: a.read_time || "",
        subject: a.subject || "",
      }));
      if (rows.length || repairRows.length) {
        const { error } = await db.from("articles").upsert([...rows, ...repairRows], {
          onConflict: "original_url",
        });
        if (!error) saved = rows.length + repairRows.length;
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
    const publishable = articles.filter(validatePublishableArticle);
    const outgoing = publishable.length
      ? publishable
      : articles.filter((a) => String(a.body || "").split(/\s+/).filter(Boolean).length >= 200);
    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": refresh ? "no-store" : "public, max-age=60, stale-while-revalidate=300",
      },
      body: JSON.stringify({
        articles: (outgoing.length ? outgoing : articles).slice(0, 60),
        generatedAt: new Date().toISOString(),
        quality: {
          total: articles.length,
          publishable: publishable.length,
          minBodyWords: typeof MIN_BODY_WORDS === "number" ? MIN_BODY_WORDS : 500,
        },
      }),
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
