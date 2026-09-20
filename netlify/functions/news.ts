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

const PLACEHOLDER_IMAGE = "https://rwdnews.netlify.app/rwdnews-logo.svg";

const rss = new Parser({
  headers: {
    "User-Agent": "RWDNEWS/1.0 (+https://rwdnews.netlify.app)",
    Accept: "application/rss+xml, application/xml, text/xml, */*",
  },
  timeout: 4000,
});

const feeds = GLOBAL_NEWS_SOURCES.map((source) => [source.url, source.name, source.region, source.category] as const);

const queries = [
  [`(breaking OR latest OR developing OR "just in" OR "breaking news")`, "World"],
  ["(Europe OR European OR UK OR Britain OR France OR Germany OR Italy OR Spain OR Poland OR Ukraine OR Russia)", "Europe"],
  ["(Middle East OR Israel OR Palestine OR Gaza OR Lebanon OR Iran OR Iraq OR Syria OR Gulf OR Saudi Arabia OR UAE)", "Middle East"],
  ["(Asia OR China OR Japan OR India OR Korea OR Pakistan OR Indonesia OR Philippines OR Australia)", "Asia"],
  ["(Africa OR Nigeria OR Kenya OR Ghana OR SouthAfrica OR Egypt OR Ethiopia OR Sudan OR Morocco OR Senegal OR Rwanda)", "Africa"],
  ["(Nigeria OR Nigerian OR Lagos OR Abuja OR Kano OR Rivers OR Kaduna OR Enugu OR Oyo OR Tinubu)", "Nigeria"],
  ["(Ghana OR Ghanaian OR Accra OR Kumasi OR Tamale OR Tema)", "Ghana"],
  ["(football OR soccer OR Premier League OR Champions League OR UEFA OR FIFA OR NBA OR NFL OR tennis OR cricket OR Formula 1 OR Olympics)", "Sports"],
  ["(finance OR markets OR banking OR economy OR companies OR stocks OR oil OR trade)", "Business"],
  ['(\"artificial intelligence\" OR AI OR technology OR cybersecurity OR chips OR software OR robotics OR smartphone OR startup)', "Tech"],
] as const;

const stop = new Set([
  "the","and","for","with","from","that","this","after","before","into","over","under",
  "about","will","would","could","should","says","said","have","has","been","are","was",
  "were","their","they","them","than","then","what","when","where","while","which","who",
  "how","why","new","latest","news","report","reports","according","amid","more","most",
]);

const clean = (value: unknown) =>
  String(value || "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();

function stripJunk(value: unknown) {
  let x = clean(value);
  x = x.replace(/\s*Read\s*More\s*:?\s*https?:\/\/\S+/gi, "");
  x = x.replace(/https?:\/\/\S+/gi, "");
  return x.replace(/\s+/g, " ").trim();
}

function isMetaLine(x: string) {
  return /limited to facts|supplied source material|source report remains|not add facts that are not supported|meant to be read on RWDNEWS|without leaving the site|tracking this story from the published source/i.test(x);
}

function sanitizeSummary(items: string[]) {
  return (items || [])
    .map((x) => stripJunk(x))
    .filter(Boolean)
    .filter((x) => !isMetaLine(x))
    .filter((x) => x.length > 25);
}

const words = (text: string) =>
  clean(text)
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .filter((x) => x.length >= 4 && !stop.has(x));

/** Prefer topic (Sports/Tech/Business) then region (Nigeria/Africa), else World */
function category(text: string, hint?: string, region?: string) {
  const x = text.toLowerCase();
  if (/\b(sport|sports|football|soccer|premier league|champions league|uefa|fifa|nba|nfl|mlb|nhl|tennis|cricket|formula\s?1|f1|olympics|athletics|basketball|baseball|rugby|boxing|ufc|transfer)\b/.test(x))
    return "Sports";
  if (/\b(bitcoin|crypto|ethereum|blockchain|token)\b/.test(x)) return "Crypto";
  if (/\b(ai|artificial intelligence|chip|semiconductor|software|cyber|robot|technology|tech|startup|smartphone|app|gadget)\b/.test(x))
    return "Tech";
  if (hint === "Tech" || hint === "Sports" || hint === "Crypto") return hint;
  if (/\b(movie|film|celebrity|actor|actress|music|nollywood|wedding|marriage)\b/.test(x)) return "Entertainment";
  if (/\b(market|stock|bank|economy|finance|oil|trade|gdp|inflation|naira)\b/.test(x) || hint === "Business") return "Business";
  if (hint === "Nigeria" || /\b(nigeria|nigerian|lagos|abuja|kano|tinubu)\b/.test(x)) return "Nigeria";
  if (hint === "Ghana" || /\b(ghana|ghanaian|accra)\b/.test(x)) return "Ghana";
  if (hint === "Africa" || region === "Africa" || /\b(africa|kenya|south africa|egypt|ethiopia|senegal)\b/.test(x)) return "Africa";
  if (region === "Nigeria") return "Nigeria";
  if (region === "Ghana") return "Ghana";
  if (hint) return hint;
  if (/\b(election|president|government|minister|parliament|diplomacy|war|conflict|sanction)\b/.test(x)) return "World";
  return "World";
}

function rssImage(item: any) {
  const candidates = [
    item?.enclosure?.url,
    item?.enclosure?.link,
    item?.["media:content"]?.url,
    item?.["media:content"]?.$?.url,
    item?.["media:thumbnail"]?.url,
    item?.["media:thumbnail"]?.$?.url,
    item?.image?.url,
    item?.image?.link,
  ];
  const direct = candidates.find((x) => typeof x === "string" && /^https?:\/\//i.test(x));
  if (direct) return direct;
  const html = clean(item?.content || item?.["content:encoded"] || item?.summary || item?.description);
  const match = html.match(/<img[^>]+(?:src|data-src)=["'](https?:\/\/[^"' >]+)["']/i);
  return match?.[1] || "";
}

async function fetchArticleImage(link: string) {
  if (!link || !/^https?:\/\//i.test(link)) return "";
  try {
    const response = await fetch(link, { headers: { "User-Agent": "RWDNEWS/1.0" }, signal: AbortSignal.timeout(3500) });
    if (!response.ok) return "";
    const html = await response.text();
    const match =
      html.match(/<meta[^>]+(?:property|name)=["'](?:og:image|twitter:image)["'][^>]+content=["']([^"']+)["']/i) ||
      html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["'](?:og:image|twitter:image)["']/i);
    return match?.[1] ? new URL(match[1], link).toString() : "";
  } catch {
    return "";
  }
}

async function getRss() {
  const results = await Promise.allSettled(
    feeds.map(async ([url, source, region, feedCategory]) => {
      try {
        const feed = await rss.parseURL(url);
        return (feed.items || []).slice(0, 12).map((item: any) => {
          const title = clean(item.title);
          const desc = stripJunk(item.contentSnippet || item.content || item.summary).slice(0, 900);
          return {
            title,
            link: String(item.link || item.guid || ""),
            desc,
            date: item.isoDate || item.pubDate,
            source,
            image: rssImage(item),
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

async function getGdelt() {
  const results = await Promise.allSettled(
    queries.map(async ([query, section]) => {
      const u = new URL("https://api.gdeltproject.org/api/v2/doc/doc");
      u.searchParams.set("query", query);
      u.searchParams.set("mode", "artlist");
      u.searchParams.set("maxrecords", "25");
      u.searchParams.set("timespan", "12h");
      u.searchParams.set("sort", "datedesc");
      u.searchParams.set("format", "json");
      const r = await fetch(u, { headers: { "User-Agent": "RWDNEWS/1.0" }, signal: AbortSignal.timeout(6000) });
      if (!r.ok) return [];
      const data = (await r.json()) as any;
      return (Array.isArray(data?.articles) ? data.articles : []).map((a: any) => ({
        title: clean(a.title),
        link: String(a.url || ""),
        desc: "",
        date: a.seendate,
        source: clean(a.domain || "GDELT"),
        image: String(a.socialimage || a.image || ""),
        category: section,
        region: section === "Nigeria" || section === "Ghana" || section === "Africa" ? section : "Global",
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
    const domains = new Set(
      cluster.map((x) => {
        try {
          return new URL(x.link).hostname.replace(/^www\./, "");
        } catch {
          return x.source;
        }
      }),
    );
    const published = new Date(item.date || Date.now()).getTime();
    const age = Number.isNaN(published) ? 0 : Math.max(0, (Date.now() - published) / 3600000);
    const freshness = Math.max(0, 38 - age * 4);
    // Boost Africa / Tech / Nigeria so they are not crowded out by World/Business
    const catBoost =
      item.category === "Tech"
        ? 12
        : item.category === "Nigeria" || item.category === "Africa" || item.category === "Ghana"
          ? 14
          : item.category === "Sports"
            ? 8
            : 0;
    const score = Math.round(Math.min(100, freshness + domains.size * 8 + cluster.length * 7 + catBoost));
    return {
      ...item,
      trendScore: score,
      trendLabel:
        cluster.length >= 3 || score >= 70
          ? "Trending"
          : cluster.length >= 2 || score >= 48
            ? "Developing"
            : "Fresh",
      sources: Array.from(new Set(cluster.map((x) => x.source))).slice(0, 5),
    };
  });
}

/** Pick a balanced mix so Tech/Africa/Nigeria are not drowned out */
function pickBalanced(items: any[], limit = 48) {
  const sorted = [...items].sort((a, b) => b.trendScore - a.trendScore);
  const quotas: Record<string, number> = {
    Nigeria: 8,
    Africa: 6,
    Ghana: 3,
    Tech: 7,
    Sports: 8,
    Business: 6,
    World: 8,
    Crypto: 2,
    Entertainment: 2,
  };
  const picked: any[] = [];
  const used = new Set<string>();
  const byCat: Record<string, any[]> = {};
  for (const it of sorted) {
    const c = it.category || "World";
    (byCat[c] ||= []).push(it);
  }
  for (const [cat, n] of Object.entries(quotas)) {
    for (const it of (byCat[cat] || []).slice(0, n)) {
      if (used.has(it.link)) continue;
      used.add(it.link);
      picked.push(it);
    }
  }
  for (const it of sorted) {
    if (picked.length >= limit) break;
    if (used.has(it.link)) continue;
    used.add(it.link);
    picked.push(it);
  }
  return picked.slice(0, limit);
}

function expandFallbackSummary(title: string, desc: string): string[] {
  const d = stripJunk(desc);
  const t = stripJunk(title);
  if (d.length > 80) {
    // Split long description into 2–4 readable chunks without inventing facts
    const sentences = d.split(/(?<=[.!?])\s+/).filter((s) => s.trim().length > 20);
    if (sentences.length >= 2) return sanitizeSummary(sentences.slice(0, 5));
    // Soft wrap into ~2 paragraphs
    const mid = Math.ceil(d.length / 2);
    const cut = d.lastIndexOf(" ", mid);
    if (cut > 40) return sanitizeSummary([d.slice(0, cut).trim(), d.slice(cut).trim()]);
    return sanitizeSummary([d]);
  }
  return sanitizeSummary([d || t]);
}

async function aiBrief(title: string, desc: string) {
  const fallback = {
    ai_hook_title: title.replace(/^(\[.*?\]|BREAKING:?)/i, "").trim(),
    ai_summary: expandFallbackSummary(title, desc),
    tags: ["#World"],
  };
  const key = process.env["GEMINI_API_KEY"] || "";
  if (!key) return fallback;
  try {
    const ai = new GoogleGenAI({ apiKey: key });
    const response = await Promise.race([
      ai.models.generateContent({
        model: "gemini-2.0-flash",
        contents:
          "You are RWDNEWS. Write a clear news briefing for readers. " +
          "Return JSON only. Rules: " +
          "(1) ai_hook_title: punchy headline. " +
          "(2) ai_summary: 4 to 6 bullet points. Each bullet 1–2 full sentences. " +
          "Total summary should be about 100–160 words so readers understand the story without leaving the site. " +
          "Use only facts from the title and description — no invention, no disclaimers, no URLs, no Read More. " +
          "(3) tags: 2–4 hashtags. " +
          "TITLE: " +
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
      new Promise<null>((_, reject) => setTimeout(() => reject(new Error("timeout")), 5000)),
    ]);
    const text = (response as any)?.text;
    if (!text) return fallback;
    const parsed = JSON.parse(text);
    const summary = sanitizeSummary(Array.isArray(parsed.ai_summary) ? parsed.ai_summary : []).slice(0, 6);
    return {
      ai_hook_title: clean(parsed.ai_hook_title) || fallback.ai_hook_title,
      ai_summary: summary.length ? summary : fallback.ai_summary,
      tags: (Array.isArray(parsed.tags) ? parsed.tags : ["#World"])
        .map((x: string) => (x.startsWith("#") ? x : "#" + x))
        .slice(0, 4),
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
  const scored = scoreItems(dedupe([...rssItems, ...gdeltItems]));
  const items = pickBalanced(scored, 48);

  const results = (
    await Promise.all(
      items.map(async (item) => {
        const section = category(item.title + " " + item.desc, item.category, item.region);
        const brief = await aiBrief(item.title, item.desc);
        let image =
          item.image && /^https?:\/\//i.test(item.image) ? item.image : await fetchArticleImage(item.link);
        if (!image) image = PLACEHOLDER_IMAGE;
        const bodyText = sanitizeSummary(brief.ai_summary).join(" ");
        return {
          id: "news-" + Buffer.from(item.link).toString("base64url").slice(0, 28),
          original_url: item.link,
          image,
          timestamp:
            item.date && !Number.isNaN(new Date(item.date).getTime())
              ? new Date(item.date).toISOString()
              : new Date().toISOString(),
          source: item.source,
          original_title: item.title,
          original_description: stripJunk(item.desc),
          ai_hook_title: brief.ai_hook_title,
          ai_summary: sanitizeSummary(brief.ai_summary),
          tags: brief.tags,
          read_time: Math.max(3, Math.ceil((item.title + " " + bodyText).split(/\s+/).length / 160)) + " min read",
          category: section,
          region: item.region || "Global",
          trend_score: item.trendScore,
          trend_label: item.trendLabel,
          image_credit: item.source,
          image_license: "Publisher image",
          image_source_url: item.link,
          discovered_via: item.sources,
        } satisfies NewsArticle;
      }),
    )
  ).filter((item): item is NewsArticle => Boolean(item));
  return results;
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
      .order("timestamp", { ascending: false })
      .limit(60);
    if (error || !Array.isArray(data)) return [];
    return data
      .filter((a: any) => a?.original_url)
      .map((a: any) => ({
        id: String(a.id),
        original_url: String(a.original_url),
        image: String(a.image || PLACEHOLDER_IMAGE),
        timestamp: a.timestamp || new Date().toISOString(),
        source: String(a.source || "RWDNEWS"),
        original_title: String(a.original_title || a.ai_hook_title || ""),
        original_description: stripJunk(String(a.original_description || "")),
        ai_hook_title: String(a.ai_hook_title || a.original_title || ""),
        ai_summary: sanitizeSummary(Array.isArray(a.ai_summary) ? a.ai_summary : []),
        tags: Array.isArray(a.tags) ? a.tags : ["#World"],
        read_time: String(a.read_time || "3 min read"),
        category: String(a.category || category(String(a.original_title || ""), undefined, String(a.region || ""))),
        region: String(a.region || "Global"),
        trend_score: 0,
        trend_label: "Fresh" as const,
        discovered_via: [String(a.source || "RWDNEWS")],
        body: String(a.body || ""),
        story_type: String(a.story_type || "WIRE"),
        author_name: String(a.author_name || ""),
        subject: String(a.subject || ""),
        editorial_status: String(a.editorial_status || "published"),
        featured: Boolean(a.featured),
        pinned: Boolean(a.pinned),
        image_credit: String(a.image_credit || a.source || ""),
        image_license: String(a.image_license || ""),
        image_source_url: String(a.image_source_url || a.original_url),
      }));
  } catch {
    return [];
  }
}

async function persist(articles: NewsArticle[]) {
  const url = process.env["SUPABASE_URL"] || process.env["VITE_SUPABASE_URL"] || "";
  const key = process.env["SUPABASE_SERVICE_ROLE_KEY"] || "";
  if (!url || !key) return 0;
  const db = createClient(url, key);
  let saved = 0;
  for (const a of articles) {
    const { error } = await db.from("articles").upsert(
      {
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
        category: a.category,
        region: a.region || "Global",
        image_credit: a.image_credit,
        image_license: a.image_license,
        image_source_url: a.image_source_url,
        editorial_status: "published",
      },
      { onConflict: "original_url" },
    );
    if (!error) saved++;
  }
  return saved;
}

export async function runIngest() {
  const articles = await buildArticles();
  if (articles.length) {
    const saved = await persist(articles);
    return { articles, saved, generatedAt: new Date().toISOString() };
  }
  const stored = await getStoredArticles();
  return { articles: stored, saved: 0, generatedAt: new Date().toISOString() };
}

export async function handler(event: any) {
  const qs = event.queryStringParameters || {};
  const path = event.path || "";
  const isCron = path.includes("cron-ingest");
  const wantsRefresh = qs.refresh === "true";
  if (isCron) {
    const secret = process.env["CRON_SECRET"] || "";
    const auth = event.headers?.authorization || event.headers?.Authorization || "";
    const supplied = String(auth).replace(/^Bearer\s+/i, "") || qs.secret || "";
    if (!secret || supplied !== secret) {
      return {
        statusCode: 401,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: "Unauthorized" }),
      };
    }
  }
  try {
    if (wantsRefresh || isCron) {
      const result = await runIngest();
      return {
        statusCode: 200,
        headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
        body: JSON.stringify({
          ok: true,
          count: result.articles.length,
          saved: result.saved,
          articles: result.articles,
          generatedAt: result.generatedAt,
        }),
      };
    }
    const stored = await getStoredArticles();
    if (stored.length) {
      return {
        statusCode: 200,
        headers: { "Content-Type": "application/json", "Cache-Control": "public, max-age=60" },
        body: JSON.stringify({ ok: true, articles: stored, generatedAt: new Date().toISOString() }),
      };
    }
    const result = await runIngest();
    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
      body: JSON.stringify({ ok: true, articles: result.articles, generatedAt: result.generatedAt }),
    };
  } catch (e) {
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ok: false,
        error: e instanceof Error ? e.message : "News error",
        articles: [],
      }),
    };
  }
}
