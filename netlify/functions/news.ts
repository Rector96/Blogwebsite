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

const rss = new Parser({
  headers: {
    "User-Agent": "RWDNEWS/1.0 (+https://rwdnews.netlify.app)",
    Accept: "application/rss+xml, application/xml, text/xml, */*",
  },
  timeout: 3000,
});

const feeds = GLOBAL_NEWS_SOURCES.map((source) => [source.url, source.name, source.region, source.category] as const);

const queries = [
  [`(breaking OR latest OR developing OR "just in" OR "breaking news")`, "World"],
  ["(Europe OR European OR UK OR Britain OR France OR Germany OR Italy OR Spain OR Poland OR Ukraine OR Russia)", "Europe"],
  ["(Middle East OR Israel OR Palestine OR Gaza OR Lebanon OR Iran OR Iraq OR Syria OR Gulf OR Saudi Arabia OR UAE)", "Middle East"],
  ["(Asia OR China OR Japan OR India OR Korea OR Pakistan OR Indonesia OR Philippines OR Australia)", "Asia"],
  ["(Africa OR Nigeria OR Kenya OR Ghana OR SouthAfrica OR Egypt OR Ethiopia OR Sudan OR Morocco)", "Africa"],
  ["(Nigeria OR Nigerian OR Lagos OR Abuja OR Kano OR Rivers OR Kaduna OR Enugu OR Oyo)", "Nigeria"],
  ["(Ghana OR Ghanaian OR Accra OR Kumasi OR Tamale OR Tema)", "Ghana"],
  ["(football OR soccer OR Premier League OR Champions League OR UEFA OR FIFA OR NBA OR NFL OR MLB OR baseball OR NHL OR tennis OR cricket OR Formula 1 OR athletics OR Olympics)", "Sports"],
  ["(\"Premier League\" OR \"Champions League\" OR \"Europa League\" OR \"La Liga\" OR Bundesliga OR \"Serie A\" OR \"Ligue 1\")", "Sports"],
  ["(NBA OR NFL OR MLB OR NHL OR \"Major League Baseball\" OR \"National Football League\")", "Sports"],
  ["(finance OR markets OR banking OR economy OR companies OR stocks OR oil OR trade)", "Business"],
  ['(\"artificial intelligence\" OR AI OR technology OR cybersecurity OR chips OR software OR robotics)', "Tech"],
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
  const x = text.toLowerCase();
  if (/\b(sport|sports|football|soccer|premier league|champions league|uefa|fifa|nba|nfl|mlb|nhl|tennis|cricket|formula\s?1|f1|olympics|athletics|basketball|baseball|rugby|boxing|ufc|transfer)\b/.test(x)) return "Sports";
  if (/\b(bitcoin|crypto|ethereum|blockchain|token)\b/.test(x)) return "Crypto";
  if (/\b(ai|artificial intelligence|chip|semiconductor|software|cyber|robot|technology|tech)\b/.test(x)) return "Tech";
  if (/\b(movie|film|celebrity|actor|actress|music|nollywood|wedding|marriage)\b/.test(x)) return "Entertainment";
  if (hint && hint !== "Business") return hint;
  if (/\b(nigeria|nigerian|lagos|abuja)\b/.test(x)) return "Nigeria";
  if (/\b(ghana|ghanaian|accra)\b/.test(x)) return "Ghana";
  if (/\b(africa|kenya|south africa|egypt)\b/.test(x)) return "Africa";
  if (/\b(market|stock|bank|economy|finance|oil|trade|gdp|inflation)\b/.test(x)) return "Business";
  if (/\b(election|president|government|minister|parliament|diplomacy|war|conflict|sanction)\b/.test(x)) return "World";
  if (hint) return hint;
  return "World";
}

function rssImage(item: any) {
  const candidates = [
    item?.enclosure?.url,
    item?.enclosure?.link,
    item?.["media:content"]?.url,
    item?.["media:content"]?.$?.url,
    item?.["media:content"]?.["$"]?.url,
    item?.["media:thumbnail"]?.url,
    item?.["media:thumbnail"]?.$?.url,
    item?.["media:thumbnail"]?.["$"]?.url,
    item?.image?.url,
    item?.image?.link,
    item?.["image"]?.["$"]?.url,
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
    const response = await fetch(link, { headers: { "User-Agent": "RWDNEWS/1.0 editorial-image-fetch" }, signal: AbortSignal.timeout(3500) });
    if (!response.ok) return "";
    const html = await response.text();
    const match = html.match(/<meta[^>]+(?:property|name)=["'](?:og:image|twitter:image)["'][^>]+content=["']([^"']+)["']/i) ||
      html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["'](?:og:image|twitter:image)["']/i);
    return match?.[1] ? new URL(match[1], link).toString() : "";
  } catch { return ""; }
}
async function getRss() {
  const results = await Promise.allSettled(
    feeds.map(async ([url, source, region, feedCategory]) => {
      try {
        const feed = await rss.parseURL(url);
        return (feed.items || []).slice(0, 10).map((item: any) => ({
          title: clean(item.title),
          link: String(item.link || item.guid || ""),
          desc: clean(item.contentSnippet || item.content || item.summary).slice(0, 500),
          date: item.isoDate || item.pubDate,
          source,
          image: rssImage(item),
          category: category(clean(item.title) + " " + clean(item.contentSnippet || ""), feedCategory || undefined),
          region: region || "Global",
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
      u.searchParams.set("maxrecords", "20");
      u.searchParams.set("timespan", "6h");
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
      clean(desc) || "RWDNEWS is tracking this story from the published source.",
      "This briefing is limited to facts available in the supplied source material.",
      "The source report remains the reference for additional context, quotes and details.",
      "RWDNEWS will not add facts that are not supported by the source material.",
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
          "RWDNEWS editorial assistant. Create an original, factual RWDNEWS news briefing from ONLY the supplied title and description. Never invent facts. Return JSON. TITLE: " +
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
      ai_summary: (Array.isArray(parsed.ai_summary) ? parsed.ai_summary : [])
        .map((x: string) => clean(x))
        .filter(Boolean)
        .slice(0, 4)
        .concat(fallback.ai_summary)
        .slice(0, 4),
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
    .slice(0, 40);

  const results = (await Promise.all(items.map(async (item) => {
    const section = category(item.title + " " + item.desc, item.category);
    const brief = await aiBrief(item.title, item.desc);
    const realImageUrl = item.image && /^https?:\/\//i.test(item.image) ? item.image : await fetchArticleImage(item.link);
    if (!realImageUrl) return null;
    const image = {
      image: realImageUrl,
      credit: item.source,
      license: "Publisher/source image — verify rights before commercial reuse",
      sourceUrl: item.link,
    };
    return {
      id: "news-" + Buffer.from(item.link).toString("base64url").slice(0, 28),
      original_url: item.link,
      image: image.image,
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
      region: item.region || "Global",
      trend_score: item.trendScore,
      trend_label: item.trendLabel,
      image_credit: image.credit,
      image_license: image.license,
      image_source_url: image.sourceUrl,
      discovered_via: item.sources,
    } satisfies NewsArticle;
  }))).filter((item): item is NewsArticle => Boolean(item));
  return results;
}

async function getStoredArticles(): Promise<NewsArticle[]> {
  const url = Netlify.env.get("SUPABASE_URL") || Netlify.env.get("VITE_SUPABASE_URL");
  const key = Netlify.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) return [];
  try {
    const db = createClient(url, key);
    const { data, error } = await db
      .from("articles")
       .select("id,original_url,image,timestamp,source,original_title,original_description,ai_hook_title,ai_summary,tags,read_time,body,story_type,author_name,subject,editorial_status,featured,pinned,category,region,image_credit,image_license,image_source_url")
       .eq("editorial_status", "published")
      .order("pinned", { ascending: false })
      .order("featured", { ascending: false })
      .order("timestamp", { ascending: false })
      .limit(40);
    if (error || !Array.isArray(data)) return [];
    return data.filter((a: any) => a?.original_url && a?.image).map((a: any) => ({
      id: String(a.id),
      original_url: String(a.original_url),
      image: String(a.image),
      timestamp: a.timestamp || new Date().toISOString(),
      source: String(a.source || "RWDNEWS"),
      original_title: String(a.original_title || a.ai_hook_title || ""),
      original_description: String(a.original_description || ""),
      ai_hook_title: String(a.ai_hook_title || a.original_title || ""),
      ai_summary: Array.isArray(a.ai_summary) ? a.ai_summary : [],
      tags: Array.isArray(a.tags) ? a.tags : ["#World"],
      read_time: String(a.read_time || "2 min read"),
      category: String(a.category || category(String(a.original_title || ""), undefined)),
      region: String(a.region || "Global"),
      trend_score: 0,
      trend_label: "Fresh" as const,
      discovered_via: [String(a.source || "RWDNEWS")],
      body: String(a.body || ""), story_type: String(a.story_type || "WIRE"), author_name: String(a.author_name || "RWDNEWS Editorial"), subject: String(a.subject || ""), editorial_status: String(a.editorial_status || "published"), featured: Boolean(a.featured), pinned: Boolean(a.pinned), image_credit: String(a.image_credit || a.source || "Publisher"), image_license: String(a.image_license || "Publisher/source image — verify rights before commercial reuse"), image_source_url: String(a.image_source_url || a.original_url),
    }));
  } catch {
    return [];
  }
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
      category: a.category,
      region: a.region || "Global",
      image_credit: a.image_credit,
      image_license: a.image_license,
      image_source_url: a.image_source_url,
      editorial_status: "published",
    }, { onConflict: "original_url" });
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
  return { articles: stored, saved: 0, generatedAt: new Date().toISOString(), fallback: stored.length > 0 };
}

export default async (req: Request) => {
  const url = new URL(req.url);
  const isCron = url.pathname.includes("/cron-ingest");
  const wantsRefresh = url.searchParams.get("refresh") === "true";

  if (isCron) {
    const secret = Netlify.env.get("CRON_SECRET") || "";
    const supplied = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") || url.searchParams.get("secret") || "";
    if (!secret || supplied !== secret) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
    }
  }

  try {
    if (wantsRefresh || isCron) {
      const result = await runIngest();
      return new Response(JSON.stringify({ ok: true, count: result.articles.length, saved: result.saved, generatedAt: result.generatedAt, articles: result.articles }), {
        headers: { "content-type": "application/json", "cache-control": "no-store" },
      });
    }
    const stored = await getStoredArticles();
    if (stored.length) {
      return new Response(JSON.stringify({ ok: true, articles: stored, generatedAt: new Date().toISOString() }), {
        headers: { "content-type": "application/json", "cache-control": "public, max-age=60" },
      });
    }
    const result = await runIngest();
    return new Response(JSON.stringify({ ok: true, count: result.articles.length, saved: result.saved, articles: result.articles, generatedAt: result.generatedAt }), {
      headers: { "content-type": "application/json", "cache-control": "no-store" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: e instanceof Error ? e.message : "News error", articles: [] }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }
};

export const config = { path: "/api/news" };
