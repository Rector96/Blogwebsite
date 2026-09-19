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
  { sport: "football", path: "soccer/por.1", league: "Primeira Liga" },
  { sport: "football", path: "soccer/bra.1", league: "Brasileirão" },
  { sport: "football", path: "soccer/arg.1", league: "Liga Profesional" },
  { sport: "basketball", path: "basketball/nba", league: "NBA" },
  { sport: "basketball", path: "basketball/wnba", league: "WNBA" },
  { sport: "football", path: "football/nfl", league: "NFL" },
  { sport: "baseball", path: "baseball/mlb", league: "MLB" },
  { sport: "hockey", path: "hockey/nhl", league: "NHL" },
  { sport: "tennis", path: "tennis/atp", league: "ATP" },
];

const SPORT_LABELS = {
  football: "Football",
  basketball: "Basketball",
  tennis: "Tennis",
  baseball: "Baseball",
  hockey: "Hockey",
};

function clean(value) {
  return String(value ?? "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

function dateKey(offsetDays = 0) {
  const d = new Date(Date.now() + offsetDays * 86400000);
  return d.toISOString().slice(0, 10).replaceAll("-", "");
}

async function getEspnBoard(board, offsetDays = 0) {
  try {
    const url = new URL(`https://site.api.espn.com/apis/site/v2/sports/${board.path}/scoreboard`);
    url.searchParams.set("dates", dateKey(offsetDays));

    const response = await fetch(url, {
      headers: { Accept: "application/json", "User-Agent": "RWDNEWS/2.0" },
      signal: AbortSignal.timeout(8000),
    });

    if (!response.ok) return [];

    const data = await response.json();
    const events = Array.isArray(data?.events) ? data.events : [];

    return events
      .map((event) => {
        const competition = event?.competitions?.[0];
        const competitors = Array.isArray(competition?.competitors) ? competition.competitors : [];
        const home = competitors.find((x) => x.homeAway === "home") || competitors[0];
        const away = competitors.find((x) => x.homeAway === "away") || competitors[1];

        if (!home || !away) return null;

        const statusType = event?.status?.type || competition?.status?.type || {};
        const state = String(statusType.state || "").toLowerCase();

        return {
          id: `espn-${event.id}`,
          providerId: String(event.id),
          provider: "ESPN",
          boardPath: board.path,
          sport: board.sport,
          sportLabel: SPORT_LABELS[board.sport] || board.sport,
          league: clean(competition?.league?.name || board.league),
          home: clean(home.team?.displayName || home.team?.name),
          away: clean(away.team?.displayName || away.team?.name),
          homeScore: home.score !== "" && home.score != null ? Number(home.score) : null,
          awayScore: away.score !== "" && away.score != null ? Number(away.score) : null,
          status: clean(statusType.description || statusType.name || "Scheduled"),
          statusState: state,
          completed: Boolean(statusType.completed) || state === "post",
          startTime: event.date ? new Date(event.date).toISOString() : undefined,
          live: state === "in" || /live|in progress/i.test(String(statusType.description || "")),
          homeLogo: home.team?.logo || "",
          awayLogo: away.team?.logo || "",
          venue: clean(competition?.venue?.fullName || competition?.venue?.address?.city || ""),
        };
      })
      .filter((match) => match && match.home && match.away);
  } catch {
    return [];
  }
}

async function getApiFootballFootball() {
  const key = process.env.API_FOOTBALL_KEY || process.env.API_SPORTS_KEY || "";
  if (!key) return [];

  try {
    const response = await fetch("https://v3.football.api-sports.io/fixtures?live=all", {
      headers: { "x-apisports-key": key, Accept: "application/json" },
      signal: AbortSignal.timeout(9000),
    });

    if (!response.ok) return [];

    const data = await response.json();
    return (Array.isArray(data?.response) ? data.response : [])
      .map((x) => ({
        id: `api-football-${x.fixture.id}`,
        providerId: String(x.fixture.id),
        provider: "API-Football",
        sport: "football",
        sportLabel: "Football",
        league: clean(x.league?.name || "Football"),
        home: clean(x.teams?.home?.name),
        away: clean(x.teams?.away?.name),
        homeScore: x.goals?.home ?? null,
        awayScore: x.goals?.away ?? null,
        status: clean(x.fixture?.status?.long || x.fixture?.status?.short || "Live"),
        startTime: x.fixture?.date,
        live: true,
        homeLogo: x.teams?.home?.logo || "",
        awayLogo: x.teams?.away?.logo || "",
        venue: clean(x.fixture?.venue?.name || x.fixture?.venue?.city || ""),
        apiFixtureId: String(x.fixture.id),
      }))
      .filter((match) => match.home && match.away);
  } catch {
    return [];
  }
}

async function getAllMatches() {
  const offsets = [0, 1, 2, 3, -1];
  const requests = offsets.flatMap((offset) =>
    ESPN_BOARDS.map((board) => getEspnBoard(board, offset)),
  );
  const espnResults = await Promise.all(requests);
  const espn = espnResults.flatMap((items) => items);
  const apiFootballLive = await getApiFootballFootball();
  const all = [...apiFootballLive, ...espn];

  const seen = new Set();
  return all.filter((match) => {
    const key = `${match.sport}|${match.home}|${match.away}|${match.startTime || ""}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function getDbSportsNews() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  if (!url || !key) return [];

  try {
    const db = createClient(url, key);
    const { data, error } = await db
      .from("articles")
      .select("id,original_url,image,timestamp,source,original_title,original_description,ai_hook_title,ai_summary,category,region,body,story_type")
      .order("timestamp", { ascending: false })
      .limit(160);

    if (error || !Array.isArray(data)) return [];

    const sportRe = /\b(sport|sports|football|soccer|premier league|champions league|uefa|fifa|nba|nfl|mlb|nhl|tennis|cricket|transfer|arsenal|chelsea|liverpool|manchester|barcelona|real madrid|basketball|baseball|hockey)\b/i;

    return data
      .filter((article) => {
        if (String(article.category || "").toLowerCase() === "sports") return true;
        const blob = `${article.original_title || ""} ${article.ai_hook_title || ""} ${article.source || ""}`;
        return sportRe.test(blob);
      })
      .map((article) => ({
        id: String(article.id),
        original_url: String(article.original_url || ""),
        image: String(article.image || ""),
        timestamp: String(article.timestamp || new Date().toISOString()),
        source: String(article.source || "Sports"),
        original_title: String(article.original_title || ""),
        original_description: String(article.original_description || ""),
        ai_hook_title: String(article.ai_hook_title || article.original_title || ""),
        ai_summary: Array.isArray(article.ai_summary) ? article.ai_summary.map(String) : [],
        category: "Sports",
        region: String(article.region || "Global"),
        body: String(article.body || ""),
        story_type: String(article.story_type || "WIRE"),
      }))
      .filter((article) => article.original_url && article.original_title);
  } catch {
    return [];
  }
}

async function gdeltSports() {
  const queries = [
    "(football OR soccer OR Premier League OR Champions League OR UEFA OR FIFA OR transfer)",
    "(NBA OR basketball OR NFL OR MLB OR NHL OR tennis OR cricket OR hockey)",
    "(Nigeria football OR Ghana football OR AFCON OR CAF Champions OR Super Eagles)",
    "(Barcelona OR Real Madrid OR Arsenal OR Chelsea OR Liverpool OR Manchester)",
  ];

  const results = await Promise.allSettled(
    queries.map(async (query) => {
      const u = new URL("https://api.gdeltproject.org/api/v2/doc/doc");
      u.searchParams.set("query", query);
      u.searchParams.set("mode", "artlist");
      u.searchParams.set("maxrecords", "40");
      u.searchParams.set("timespan", "72h");
      u.searchParams.set("sort", "datedesc");
      u.searchParams.set("format", "json");

      const response = await fetch(u, {
        headers: { "User-Agent": "RWDNEWS/2.0 sports" },
        signal: AbortSignal.timeout(7000),
      });

      if (!response.ok) return [];

      const data = await response.json();
      return (Array.isArray(data?.articles) ? data.articles : []).map((article, index) => ({
        id: `gdelt-s-${Buffer.from(String(article.url || index)).toString("base64url").slice(0, 24)}`,
        original_url: String(article.url || ""),
        image: String(article.socialimage || article.urlsocialimage || ""),
        timestamp: article.seendate ? new Date(article.seendate).toISOString() : new Date().toISOString(),
        source: clean(article.domain || "Sports wire"),
        original_title: clean(article.title || ""),
        original_description: "",
        ai_hook_title: clean(article.title || ""),
        ai_summary: ["Latest sports report discovered from the global news index."],
        category: "Sports",
        story_type: "WIRE",
      }));
    }),
  );

  return results
    .flatMap((result) => (result.status === "fulfilled" ? result.value : []))
    .filter((article) => article.original_url && article.original_title);
}

function isRumor(story) {
  return /\b(rumou?r|transfer|linked|interest|target|bid|offer|talks|negotiat|could join|set to join|loan|reportedly)\b/i.test(
    `${story.original_title} ${story.original_description}`,
  );
}

async function getEspnDetail(match) {
  if (!match?.boardPath || !match?.providerId) return null;

  try {
    const u = new URL(`https://site.api.espn.com/apis/site/v2/sports/${match.boardPath}/summary`);
    u.searchParams.set("event", match.providerId);
    const response = await fetch(u, {
      headers: { Accept: "application/json", "User-Agent": "RWDNEWS/2.0" },
      signal: AbortSignal.timeout(8000),
    });

    if (!response.ok) return null;

    const data = await response.json();
    return {
      venue: clean(data?.gameInfo?.venue?.fullName || match.venue || ""),
      attendance: data?.gameInfo?.attendance ?? null,
      officials: Array.isArray(data?.gameInfo?.officials)
        ? data.gameInfo.officials.map((x) => clean(x.displayName)).filter(Boolean)
        : [],
      plays: Array.isArray(data?.plays)
        ? data.plays.slice(-30).reverse().map((play) => ({
            text: clean(play.text),
            clock: clean(play.clock?.displayValue || ""),
            period: clean(play.period?.displayValue || ""),
          }))
        : [],
      leaders: data?.leaders || [],
      notes: Array.isArray(data?.notes) ? data.notes.map((x) => clean(x.headline || x.text)).filter(Boolean) : [],
      broadcasts: Array.isArray(data?.broadcasts)
        ? data.broadcasts.map((x) => clean(x.names?.join(", "))).filter(Boolean)
        : [],
    };
  } catch {
    return null;
  }
}

async function getApiFootballDetail(match) {
  const key = process.env.API_FOOTBALL_KEY || process.env.API_SPORTS_KEY || "";
  if (!key || !match?.apiFixtureId) return null;

  try {
    const u = new URL("https://v3.football.api-sports.io/fixtures");
    u.searchParams.set("id", match.apiFixtureId);
    const response = await fetch(u, {
      headers: { "x-apisports-key": key, Accept: "application/json" },
      signal: AbortSignal.timeout(9000),
    });

    if (!response.ok) return null;

    const data = await response.json();
    const item = data?.response?.[0];
    if (!item) return null;

    return {
      venue: clean(item.fixture?.venue?.name || item.fixture?.venue?.city || match.venue || ""),
      city: clean(item.fixture?.venue?.city || ""),
      referee: clean(item.fixture?.referee || ""),
      round: clean(item.league?.round || ""),
      timezone: clean(item.fixture?.timezone || ""),
      status: clean(item.fixture?.status?.long || ""),
      events: Array.isArray(item.events)
        ? item.events.map((entry) => ({
            minute: entry.time?.elapsed ?? null,
            extra: entry.time?.extra ?? null,
            type: clean(entry.type),
            detail: clean(entry.detail),
            player: clean(entry.player?.name || ""),
            assist: clean(entry.assist?.name || ""),
          }))
        : [],
      statistics: Array.isArray(item.statistics) ? item.statistics : [],
      lineups: Array.isArray(item.lineups) ? item.lineups : [],
    };
  } catch {
    return null;
  }
}

export async function handler(event) {
  try {
    const qs = event.queryStringParameters || {};
    const action = qs.action || "hub";
    const matches = await getAllMatches();

    if (action === "match") {
      const rawId = qs.id || "";
      const match = matches.find((item) => item.id === rawId);

      if (!match) {
        return {
          statusCode: 404,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ error: "Match not found" }),
        };
      }

      const detail = match.provider === "API-Football"
        ? await getApiFootballDetail(match)
        : await getEspnDetail(match);

      return {
        statusCode: 200,
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "public, max-age=20, stale-while-revalidate=60",
        },
        body: JSON.stringify({ match, detail, generatedAt: new Date().toISOString() }),
      };
    }

    const [dbNews, discovered] = await Promise.all([getDbSportsNews(), gdeltSports()]);
    const newsMap = new Map();

    [...dbNews, ...discovered].forEach((story) => {
      if (story.original_url && !newsMap.has(story.original_url)) {
        newsMap.set(story.original_url, story);
      }
    });

    const news = Array.from(newsMap.values())
      .sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp))
      .slice(0, 100);

    const live = matches.filter((match) => match.live).slice(0, 80);
    const upcoming = matches
      .filter((match) => !match.live && !match.completed && new Date(match.startTime || 0).getTime() >= Date.now() - 3600000)
      .sort((a, b) => new Date(a.startTime || 0) - new Date(b.startTime || 0))
      .slice(0, 100);

    const results = matches
      .filter((match) => match.completed || (match.homeScore != null && match.awayScore != null && new Date(match.startTime || 0).getTime() < Date.now()))
      .sort((a, b) => new Date(b.startTime || 0) - new Date(a.startTime || 0))
      .slice(0, 100);

    const featured = matches
      .filter((match) => /premier league|champions league|la liga|bundesliga|serie a|ligue 1|nba|wnba|nfl|mlb|nhl|atp|mls/i.test(match.league))
      .slice(0, 100);

    const rumors = news.filter(isRumor).slice(0, 50);

    const majorLeagues = [
      "Premier League",
      "UEFA Champions League",
      "La Liga",
      "Bundesliga",
      "Serie A",
      "Ligue 1",
      "Eredivisie",
      "MLS",
      "NBA",
      "WNBA",
      "NFL",
      "MLB",
      "NHL",
      "ATP",
    ].map((name) => ({
      name,
      available: matches.some((match) => match.league.toLowerCase().includes(name.toLowerCase())),
    }));

    const bySport = Object.keys(SPORT_LABELS).reduce((acc, key) => {
      acc[key] = matches.filter((match) => match.sport === key).slice(0, 100);
      return acc;
    }, {});

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "public, max-age=30, stale-while-revalidate=120",
      },
      body: JSON.stringify({
        live,
        featured,
        upcoming,
        results,
        news,
        rumors,
        majorLeagues,
        bySport,
        counts: {
          matches: matches.length,
          live: live.length,
          results: results.length,
          upcoming: upcoming.length,
          news: news.length,
          rumors: rumors.length,
        },
        providers: {
          scoreboard: process.env.API_FOOTBALL_KEY || process.env.API_SPORTS_KEY ? "API-Football + ESPN" : "ESPN public boards",
          news: "Supabase + GDELT",
        },
        generatedAt: new Date().toISOString(),
      }),
    };
  } catch (error) {
    return {
      statusCode: 502,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        error: error instanceof Error ? error.message : "Sports unavailable",
        live: [],
        featured: [],
        upcoming: [],
        news: [],
        rumors: [],
        majorLeagues: [],
        bySport: {},
      }),
    };
  }
}
