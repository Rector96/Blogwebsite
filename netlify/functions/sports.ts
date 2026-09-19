import { GoogleGenAI, Type } from "@google/genai";
import { createClient } from "@supabase/supabase-js";

type SportMatch = {
  id: string;
  sport: string;
  league: string;
  home: string;
  away: string;
  homeScore?: number | null;
  awayScore?: number | null;
  status: string;
  startTime?: string;
  live: boolean;
  source?: string;
  homeLogo?: string;
  awayLogo?: string;
};

type SportsStory = {
  id: string;
  original_url: string;
  image: string;
  timestamp: string;
  source: string;
  original_title: string;
  original_description: string;
  ai_hook_title: string;
  ai_summary: string[];
  category: string;
  region?: string;
  body?: string;
  story_type?: string;
};

function clean(value: unknown) {
  return String(value ?? "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

function env(name: string) {
  return Netlify.env.get(name) || "";
}

const ESPN_BOARDS = [
  { sport: "football", path: "soccer/eng.1", league: "Premier League" },
  { sport: "football", path: "soccer/uefa.champions", league: "UEFA Champions League" },
  { sport: "football", path: "soccer/esp.1", league: "La Liga" },
  { sport: "football", path: "soccer/ger.1", league: "Bundesliga" },
  { sport: "football", path: "soccer/ita.1", league: "Serie A" },
  { sport: "football", path: "soccer/fra.1", league: "Ligue 1" },
  { sport: "football", path: "soccer/usa.1", league: "MLS" },
  { sport: "basketball", path: "basketball/nba", league: "NBA" },
  { sport: "football", path: "football/nfl", league: "NFL" },
  { sport: "baseball", path: "baseball/mlb", league: "MLB" },
  { sport: "hockey", path: "hockey/nhl", league: "NHL" },
  { sport: "tennis", path: "tennis/atp", league: "ATP" },
];

async function getEspnBoard(path: string, sport: string, leagueFallback: string): Promise<SportMatch[]> {
  const url = `https://site.api.espn.com/apis/site/v2/sports/${path}/scoreboard`;
  const response = await fetch(url, {
    headers: { Accept: "application/json", "User-Agent": "RWDNEWS/1.0" },
    signal: AbortSignal.timeout(6000),
  });
  if (!response.ok) return [];
  const data: any = await response.json();
  const events = Array.isArray(data?.events) ? data.events : [];
  return events.map((event: any): SportMatch | null => {
    const competition = event?.competitions?.[0];
    const competitors = competition?.competitors || [];
    const home = competitors.find((c: any) => c.homeAway === "home") || competitors[0];
    const away = competitors.find((c: any) => c.homeAway === "away") || competitors[1];
    if (!home || !away) return null;
    const status = clean(event?.status?.type?.description || event?.status?.type?.name || "Scheduled");
    const state = String(event?.status?.type?.state || "").toLowerCase();
    return {
      id: String(event.id || `${path}-${home.team?.abbreviation}-${away.team?.abbreviation}`),
      sport,
      league: leagueFallback,
      home: clean(home.team?.displayName || home.team?.name),
      away: clean(away.team?.displayName || away.team?.name),
      homeScore: home.score != null && home.score !== "" ? Number(home.score) : null,
      awayScore: away.score != null && away.score !== "" ? Number(away.score) : null,
      status,
      startTime: event.date ? new Date(event.date).toISOString() : undefined,
      live: state === "in" || /live|in progress/i.test(status),
      source: "ESPN",
      homeLogo: home.team?.logo,
      awayLogo: away.team?.logo,
    };
  }).filter(Boolean) as SportMatch[];
}

async function getSportScore(sport: string): Promise<SportMatch[]> {
  const response = await fetch(`https://sportscore.com/api/widget/matches/?sport=${sport}&limit=50`, {
    headers: { Accept: "application/json", "User-Agent": "RWDNEWS/1.0" },
    signal: AbortSignal.timeout(7000),
  });
  if (!response.ok) return [];
  const data: any = await response.json();
  return (Array.isArray(data?.matches) ? data.matches : []).map((m: any, index: number) => {
    const status = clean(m.status_text || m.status || "Scheduled");
    return {
      id: `sportscore-${sport}-${m.url || index}-${m.time || ""}`,
      sport,
      league: clean(m.competition || "Sports"),
      home: clean(m.home),
      away: clean(m.away),
      homeScore: m.home_score !== undefined && m.home_score !== "" ? Number(m.home_score) : null,
      awayScore: m.away_score !== undefined && m.away_score !== "" ? Number(m.away_score) : null,
      status,
      startTime: m.time ? new Date(m.time).toISOString() : undefined,
      live: /live|playing|in progress|half/i.test(status),
      source: "SportScore",
      homeLogo: m.home_logo,
      awayLogo: m.away_logo,
    };
  });
}

async function getAllMatches(): Promise<SportMatch[]> {
  const sports = ["football", "basketball", "cricket", "tennis"];
  const [sportScore, espn] = await Promise.all([
    Promise.allSettled(sports.map(getSportScore)),
    Promise.allSettled(ESPN_BOARDS.map((b) => getEspnBoard(b.path, b.sport, b.league))),
  ]);
  const all = [
    ...sportScore.flatMap((r) => r.status === "fulfilled" ? r.value : []),
    ...espn.flatMap((r) => r.status === "fulfilled" ? r.value : []),
  ];
  const seen = new Set<string>();
  return all.filter((m) => {
    const key = [m.sport, m.home.toLowerCase(), m.away.toLowerCase(), m.startTime || ""].join("|");
    if (seen.has(key)) return false;
    seen.add(key);
    return Boolean(m.home && m.away);
  });
}

async function getSportsNews(): Promise<SportsStory[]> {
  const url = env("SUPABASE_URL") || env("VITE_SUPABASE_URL");
  const key = env("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) return [];
  try {
    const db = createClient(url, key);
    const { data, error } = await db.from("articles")
      .select("id,original_url,image,timestamp,source,original_title,original_description,ai_hook_title,ai_summary,category,region,body,story_type")
      .eq("editorial_status", "published")
      .eq("category", "Sports")
      .not("image", "is", null)
      .order("timestamp", { ascending: false })
      .limit(40);
    if (error || !Array.isArray(data)) return [];
    return data.map((a: any) => ({
      id: String(a.id),
      original_url: String(a.original_url || ""),
      image: String(a.image || ""),
      timestamp: String(a.timestamp || new Date().toISOString()),
      source: String(a.source || "Sports source"),
      original_title: String(a.original_title || ""),
      original_description: String(a.original_description || ""),
      ai_hook_title: String(a.ai_hook_title || a.original_title || ""),
      ai_summary: Array.isArray(a.ai_summary) ? a.ai_summary.map((x: unknown) => String(x)) : [],
      category: "Sports",
      region: String(a.region || "Global"),
      body: String(a.body || ""),
      story_type: String(a.story_type || "WIRE"),
    })).filter((a) => a.original_url && a.image && a.original_title);
  } catch {
    return [];
  }
}

async function gdeltSports(): Promise<SportsStory[]> {
  try {
    const u = new URL("https://api.gdeltproject.org/api/v2/doc/doc");
    u.searchParams.set("query", "(football OR soccer OR basketball OR tennis OR cricket OR baseball OR NFL OR NBA OR FIFA OR UEFA OR transfer)");
    u.searchParams.set("mode", "artlist");
    u.searchParams.set("maxrecords", "30");
    u.searchParams.set("timespan", "24h");
    u.searchParams.set("sort", "datedesc");
    u.searchParams.set("format", "json");
    const r = await fetch(u, { headers: { "User-Agent": "RWDNEWS/1.0 sports-discovery" }, signal: AbortSignal.timeout(6000) });
    if (!r.ok) return [];
    const data: any = await r.json();
    return (Array.isArray(data?.articles) ? data.articles : []).map((a: any, i: number) => ({
      id: `gdelt-sports-${i}-${Buffer.from(String(a.url || a.title || i)).toString("base64url").slice(0, 20)}`,
      original_url: String(a.url || ""),
      image: String(a.socialimage || a.urlsocialimage || ""),
      timestamp: a.seendate ? new Date(a.seendate).toISOString() : new Date().toISOString(),
      source: clean(a.domain || "GDELT source"),
      original_title: clean(a.title || ""),
      original_description: "",
      ai_hook_title: clean(a.title || ""),
      ai_summary: ["Source-backed sports report discovered through the live news index."],
      category: "Sports",
    })).filter((a) => a.original_url && a.original_title);
  } catch {
    return [];
  }
}

function isRumor(story: SportsStory) {
  return /\b(rumou?r|transfer|linked|interest|target|bid|offer|talks|negotiat|could join|set to join|move|deal|loan|agent|reportedly|according to)\b/i.test(
    `${story.original_title} ${story.original_description}`,
  );
}

async function fetchSourceText(url: string) {
  try {
    const r = await fetch(url, { headers: { "User-Agent": "RWDNEWS/1.0 editorial-reader" }, signal: AbortSignal.timeout(7000) });
    if (!r.ok) return "";
    const html = await r.text();
    return clean(
      html
        .replace(/<script[\s\S]*?<\/script>/gi, " ")
        .replace(/<style[\s\S]*?<\/style>/gi, " ")
        .replace(/<nav[\s\S]*?<\/nav>/gi, " ")
        .replace(/<footer[\s\S]*?<\/footer>/gi, " ")
        .replace(/<[^>]+>/g, " "),
    ).slice(0, 14000);
  } catch {
    return "";
  }
}

async function generateEditorial(story: SportsStory) {
  const sourceText = story.body || await fetchSourceText(story.original_url);
  const key = env("GEMINI_API_KEY");
  if (!key) {
    return {
      headline: story.ai_hook_title || story.original_title,
      summary: story.original_description || story.ai_summary?.[0] || "RWDNEWS is tracking this source-backed sports report.",
      sections: [
        { title: "What is reported", body: story.original_description || "The source headline is the available verified material." },
        { title: "What to watch", body: "RWDNEWS will not add facts, figures, injuries, quotes or outcomes that are not present in the supplied source material." },
      ],
      source: story.source,
      sourceUrl: story.original_url,
      generated: false,
    };
  }
  try {
    const ai = new GoogleGenAI({ apiKey: key });
    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: `Write a detailed RWDNEWS sports editorial using ONLY the supplied source record and extracted source text. Aim for 500-800 words when the evidence supports it. This is not a copy of the publisher article. Do not invent names, scores, statistics, injuries, quotes, dates, motives, transfer fees, contract terms, outcomes or predictions. Clearly distinguish reported claims from established facts. For transfer/rumor stories, explicitly label them as reports/rumors and say that they are not confirmed unless the source text provides confirmation. Use 4-6 sections with concise headings. End with "What we know next" and only include supported next steps. Return JSON with headline, summary, sections [{title,body}]. SOURCE RECORD: ${JSON.stringify(story)} SOURCE TEXT: ${sourceText.slice(0, 14000)}`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            headline: { type: Type.STRING },
            summary: { type: Type.STRING },
            sections: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: { title: { type: Type.STRING }, body: { type: Type.STRING } },
                required: ["title", "body"],
              },
            },
          },
          required: ["headline", "summary", "sections"],
        },
      },
    });
    const parsed = JSON.parse((response as any)?.text || "{}");
    return { ...parsed, source: story.source, sourceUrl: story.original_url, generated: true };
  } catch {
    return {
      headline: story.ai_hook_title || story.original_title,
      summary: story.original_description || story.ai_summary?.[0] || "RWDNEWS could not generate a longer report from the available source evidence.",
      sections: [{ title: "Source material", body: story.original_description || "The source report is available for the complete details." }],
      source: story.source,
      sourceUrl: story.original_url,
      generated: false,
    };
  }
}

export default async (req: Request) => {
  if (req.method !== "GET") return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405 });
  const url = new URL(req.url);
  const action = url.searchParams.get("action") || "hub";
  try {
    if (action === "editorial") {
      const id = url.searchParams.get("id") || "";
      const stories = await getSportsNews();
      const story = stories.find((s) => s.id === id);
      if (!story) return new Response(JSON.stringify({ error: "Sports story not found" }), { status: 404 });
      return new Response(JSON.stringify(await generateEditorial(story)), {
        headers: { "content-type": "application/json", "cache-control": "public, max-age=300, stale-while-revalidate=900" },
      });
    }

    const [matches, dbNews, discoveredNews] = await Promise.all([getAllMatches(), getSportsNews(), gdeltSports()]);
    const newsMap = new Map<string, SportsStory>();
    [...dbNews, ...discoveredNews].forEach((story) => {
      if (!story.original_url) return;
      if (!newsMap.has(story.original_url)) newsMap.set(story.original_url, story);
    });
    const news = Array.from(newsMap.values()).sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp)).slice(0, 40);
    const live = matches.filter((m) => m.live).slice(0, 40);
    const now = Date.now();
    const upcoming = matches.filter((m) => m.startTime && new Date(m.startTime).getTime() >= now - 2 * 60 * 60 * 1000).sort((a,b) => new Date(a.startTime || 0).getTime() - new Date(b.startTime || 0).getTime()).slice(0, 50);
    const featured = matches.filter((m) => /premier league|champions league|la liga|bundesliga|serie a|ligue 1|nba|nfl|mlb|nhl|atp/i.test(m.league)).slice(0, 50);
    const rumors = news.filter(isRumor).slice(0, 16);
    const majorLeagues = ["Premier League","UEFA Champions League","La Liga","Bundesliga","Serie A","Ligue 1","NBA","NFL","MLB","NHL","ATP","Cricket"].map((name) => ({
      name,
      available: matches.some((m) => m.league.toLowerCase().includes(name.toLowerCase())),
    }));
    return new Response(JSON.stringify({
      live, featured, upcoming, news, rumors, majorLeagues,
      provider: "SportScore + ESPN + source-backed RWDNEWS sports wire",
      generatedAt: new Date().toISOString(),
    }), {
      headers: { "content-type": "application/json", "cache-control": "public, max-age=30, stale-while-revalidate=120" },
    });
  } catch (error) {
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : "Sports feed unavailable",
      live: [], featured: [], upcoming: [], news: [], rumors: [], majorLeagues: [],
    }), { status: 502, headers: { "content-type": "application/json" } });
  }
};

export const config = { path: "/api/sports" };