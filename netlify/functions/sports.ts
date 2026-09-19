import { createClient } from "@supabase/supabase-js";

const ESPN_BOARDS = [
  { sport: "football", path: "soccer/eng.1", league: "Premier League" },
  { sport: "football", path: "soccer/uefa.champions", league: "UEFA Champions League" },
  { sport: "football", path: "soccer/esp.1", league: "La Liga" },
  { sport: "football", path: "soccer/ger.1", league: "Bundesliga" },
  { sport: "football", path: "soccer/ita.1", league: "Serie A" },
  { sport: "football", path: "soccer/fra.1", league: "Ligue 1" },
  { sport: "football", path: "soccer/ned.1", league: "Eredivisie" },
  { sport: "football", path: "soccer/usa.1", league: "MLS" },
  { sport: "basketball", path: "basketball/nba", league: "NBA" },
  { sport: "football", path: "football/nfl", league: "NFL" },
  { sport: "baseball", path: "baseball/mlb", league: "MLB" },
  { sport: "hockey", path: "hockey/nhl", league: "NHL" },
  { sport: "tennis", path: "tennis/atp", league: "ATP" },
];

function clean(value: unknown) {
  return String(value ?? "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

async function getEspnBoard(path: string, sport: string, leagueFallback: string) {
  try {
    const url = `https://site.api.espn.com/apis/site/v2/sports/${path}/scoreboard`;
    const response = await fetch(url, {
      headers: { Accept: "application/json", "User-Agent": "RWDNEWS/1.0" },
      signal: AbortSignal.timeout(7000),
    });
    if (!response.ok) return [] as any[];
    const data: any = await response.json();
    const events = Array.isArray(data?.events) ? data.events : [];
    return events
      .map((event: any) => {
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
          homeScore: home.score !== "" && home.score != null ? Number(home.score) : null,
          awayScore: away.score !== "" && away.score != null ? Number(away.score) : null,
          status,
          startTime: event.date ? new Date(event.date).toISOString() : undefined,
          live: state === "in" || /live|in progress/i.test(status),
          source: "ESPN",
          homeLogo: home.team?.logo || "",
          awayLogo: away.team?.logo || "",
        };
      })
      .filter(Boolean);
  } catch {
    return [] as any[];
  }
}

async function getAllMatches() {
  const results = await Promise.allSettled(
    ESPN_BOARDS.map((b) => getEspnBoard(b.path, b.sport, b.league)),
  );
  const all = results.flatMap((r) => (r.status === "fulfilled" ? r.value : []));
  const seen = new Set<string>();
  return all.filter((m: any) => {
    const key = `${m.sport}|${m.home}|${m.away}|${m.startTime || ""}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return Boolean(m.home && m.away);
  });
}

async function getDbSportsNews() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  if (!url || !key) return [] as any[];
  try {
    const db = createClient(url, key);
    const { data, error } = await db
      .from("articles")
      .select("id,original_url,image,timestamp,source,original_title,original_description,ai_hook_title,ai_summary,category,region,body,story_type")
      .eq("category", "Sports")
      .order("timestamp", { ascending: false })
      .limit(40);
    if (error || !Array.isArray(data)) return [];
    return data
      .map((a: any) => ({
        id: String(a.id),
        original_url: String(a.original_url || ""),
        image: String(a.image || ""),
        timestamp: String(a.timestamp || new Date().toISOString()),
        source: String(a.source || "Sports"),
        original_title: String(a.original_title || ""),
        original_description: String(a.original_description || ""),
        ai_hook_title: String(a.ai_hook_title || a.original_title || ""),
        ai_summary: Array.isArray(a.ai_summary) ? a.ai_summary.map(String) : [],
        category: "Sports",
      }))
      .filter((a: any) => a.original_url && a.original_title);
  } catch {
    return [];
  }
}

async function gdeltSports() {
  try {
    const u = new URL("https://api.gdeltproject.org/api/v2/doc/doc");
    u.searchParams.set("query", "(football OR soccer OR basketball OR tennis OR NBA OR NFL OR FIFA OR UEFA OR Premier League OR transfer OR Champions League)");
    u.searchParams.set("mode", "artlist");
    u.searchParams.set("maxrecords", "40");
    u.searchParams.set("timespan", "48h");
    u.searchParams.set("sort", "datedesc");
    u.searchParams.set("format", "json");
    const r = await fetch(u, { headers: { "User-Agent": "RWDNEWS/1.0 sports" }, signal: AbortSignal.timeout(7000) });
    if (!r.ok) return [];
    const data: any = await r.json();
    return (Array.isArray(data?.articles) ? data.articles : [])
      .map((a: any, i: number) => ({
        id: `gdelt-s-${i}-${Buffer.from(String(a.url || i)).toString("base64url").slice(0, 16)}`,
        original_url: String(a.url || ""),
        image: String(a.socialimage || ""),
        timestamp: a.seendate ? new Date(a.seendate).toISOString() : new Date().toISOString(),
        source: clean(a.domain || "Sports wire"),
        original_title: clean(a.title || ""),
        original_description: "",
        ai_hook_title: clean(a.title || ""),
        ai_summary: ["Live sports report from the global news index."],
        category: "Sports",
      }))
      .filter((a: any) => a.original_url && a.original_title);
  } catch {
    return [];
  }
}

function isRumor(story: any) {
  return /\b(rumou?r|transfer|linked|interest|target|bid|offer|talks|negotiat|could join|loan|reportedly)\b/i.test(
    `${story.original_title} ${story.original_description}`,
  );
}

export async function handler(event: { queryStringParameters?: Record<string, string | undefined> }) {
  try {
    const qs = event.queryStringParameters || {};
    const [matches, dbNews, discovered] = await Promise.all([getAllMatches(), getDbSportsNews(), gdeltSports()]);
    const newsMap = new Map<string, any>();
    [...dbNews, ...discovered].forEach((s: any) => {
      if (s.original_url && !newsMap.has(s.original_url)) newsMap.set(s.original_url, s);
    });
    const news = Array.from(newsMap.values())
      .sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp))
      .slice(0, 48);

    if (qs.action === "editorial") {
      const story = news.find((s) => s.id === qs.id);
      if (!story) {
        return { statusCode: 404, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ error: "Story not found" }) };
      }
      return {
        statusCode: 200,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          headline: story.ai_hook_title || story.original_title,
          summary: story.original_description || story.ai_summary?.[0] || "Source-backed sports report.",
          sections: [
            { title: "What is reported", body: story.original_description || story.ai_summary?.join(" ") || "See original report." },
            { title: "Source", body: `Reported by ${story.source}.` },
          ],
          source: story.source,
          sourceUrl: story.original_url,
        }),
      };
    }

    const live = matches.filter((m: any) => m.live).slice(0, 40);
    const upcoming = matches.filter((m: any) => !m.live).slice(0, 60);
    const featured = matches
      .filter((m: any) => /premier league|champions league|la liga|bundesliga|serie a|ligue 1|nba|nfl|mlb|nhl|atp/i.test(m.league))
      .slice(0, 50);
    const rumors = news.filter(isRumor).slice(0, 20);
    const majorLeagues = ["Premier League","UEFA Champions League","La Liga","Bundesliga","Serie A","Ligue 1","NBA","NFL","MLB","NHL","ATP"].map((name) => ({
      name,
      available: matches.some((m: any) => m.league.toLowerCase().includes(name.toLowerCase())),
    }));

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json", "Cache-Control": "public, max-age=45, stale-while-revalidate=120" },
      body: JSON.stringify({
        live,
        featured,
        upcoming,
        news,
        rumors,
        majorLeagues,
        counts: { matches: matches.length, live: live.length, news: news.length, rumors: rumors.length },
        provider: "ESPN + live sports wire",
        generatedAt: new Date().toISOString(),
      }),
    };
  } catch (e) {
    return {
      statusCode: 502,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        error: e instanceof Error ? e.message : "Sports unavailable",
        live: [], featured: [], upcoming: [], news: [], rumors: [], majorLeagues: [],
      }),
    };
  }
}
