import { createClient } from "@supabase/supabase-js";
import Parser from "rss-parser";

/**
 * Free score sources (no paid API-Football required):
 * 1) ESPN public scoreboard (no key)
 * 2) TheSportsDB free demo key
 * 3) Optional API-Football only if key works (often suspended on free accounts)
 */
const ESPN_BOARDS = [
  { sport: "football", path: "soccer/eng.1", league: "Premier League" },
  { sport: "football", path: "soccer/esp.1", league: "La Liga" },
  { sport: "football", path: "soccer/ita.1", league: "Serie A" },
  { sport: "football", path: "soccer/ger.1", league: "Bundesliga" },
  { sport: "football", path: "soccer/fra.1", league: "Ligue 1" },
  { sport: "football", path: "soccer/uefa.champions", league: "UEFA Champions League" },
  { sport: "basketball", path: "basketball/nba", league: "NBA" },
  { sport: "football", path: "football/nfl", league: "NFL" },
];

const SPORT_RSS = [
  ["https://www.espn.com/espn/rss/soccer/news", "ESPN Soccer"],
  ["https://www.espn.com/espn/rss/nba/news", "ESPN NBA"],
  ["https://feeds.bbci.co.uk/sport/football/rss.xml", "BBC Football"],
  ["https://feeds.bbci.co.uk/sport/rss.xml", "BBC Sport"],
  ["https://www.theguardian.com/football/rss", "Guardian Football"],
  ["https://www.skysports.com/rss/12040", "Sky Sports"],
  ["https://www.goal.com/feeds/en/news", "Goal.com"],
  ["https://www.completesports.com/feed/", "Complete Sports"],
];

const SPORT_LABELS = {
  football: "Football",
  basketball: "Basketball",
  tennis: "Tennis",
  baseball: "Baseball",
  hockey: "Hockey",
};

const PLACEHOLDER = "https://rwdnews.netlify.app/rwdnews-logo.svg";

const rss = new Parser({
  timeout: 5000,
  headers: {
    "User-Agent": "RWDNEWS/2.0 (+https://rwdnews.netlify.app)",
    Accept: "application/rss+xml, application/xml, text/xml, */*",
  },
});

function clean(value) {
  return String(value ?? "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

function dateKey(offsetDays = 0) {
  const d = new Date(Date.now() + offsetDays * 86400000);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}${m}${day}`;
}

function isoDate(offsetDays = 0) {
  const d = new Date(Date.now() + offsetDays * 86400000);
  return d.toISOString().slice(0, 10);
}

function mapEspnEvent(event, board) {
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
    venue: clean(competition?.venue?.fullName || ""),
  };
}

async function fetchEspnBoard(board, dates) {
  try {
    const url = new URL(`https://site.api.espn.com/apis/site/v2/sports/${board.path}/scoreboard`);
    if (dates) url.searchParams.set("dates", dates);
    const response = await fetch(url.toString(), {
      headers: {
        Accept: "application/json",
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Referer: "https://www.espn.com/",
      },
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) return [];
    const data = await response.json();
    const events = Array.isArray(data?.events) ? data.events : [];
    return events.map((event) => mapEspnEvent(event, board)).filter(Boolean);
  } catch {
    return [];
  }
}

/** Sequential ESPN — avoids Netlify timeouts from 20+ parallel calls */
async function fetchEspnAll() {
  const out = [];
  for (const board of ESPN_BOARDS) {
    // Default board (usually today) + explicit today + tomorrow
    for (const dates of [null, dateKey(0), dateKey(1)]) {
      const batch = await fetchEspnBoard(board, dates);
      out.push(...batch);
    }
  }
  return out;
}

/** TheSportsDB free demo (no signup). Limited but useful fallback. */
async function fetchTheSportsDb() {
  const out = [];
  const key = process.env.THESPORTSDB_KEY || "3"; // public demo key
  for (const offset of [0, 1, -1]) {
    try {
      const d = isoDate(offset);
      const url = `https://www.thesportsdb.com/api/v1/json/${key}/eventsday.php?d=${d}&s=Soccer`;
      const response = await fetch(url, {
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(8000),
      });
      if (!response.ok) continue;
      const data = await response.json();
      const events = Array.isArray(data?.events) ? data.events : [];
      for (const e of events) {
        const home = clean(e.strHomeTeam);
        const away = clean(e.strAwayTeam);
        if (!home || !away) continue;
        const status = clean(e.strStatus || e.strProgress || "Scheduled");
        const live = /in play|live|1h|2h|ht|half/i.test(status);
        const completed = /match finished|ft|aet|pen/i.test(status);
        out.push({
          id: `tsdb-${e.idEvent}`,
          providerId: String(e.idEvent),
          provider: "TheSportsDB",
          sport: "football",
          sportLabel: "Football",
          league: clean(e.strLeague || "Football"),
          home,
          away,
          homeScore: e.intHomeScore != null && e.intHomeScore !== "" ? Number(e.intHomeScore) : null,
          awayScore: e.intAwayScore != null && e.intAwayScore !== "" ? Number(e.intAwayScore) : null,
          status,
          statusState: live ? "in" : completed ? "post" : "pre",
          startTime: e.strTimestamp
            ? new Date(e.strTimestamp).toISOString()
            : e.dateEvent
              ? new Date(`${e.dateEvent}T${e.strTime || "12:00:00"}Z`).toISOString()
              : undefined,
          live,
          completed,
          homeLogo: e.strHomeTeamBadge || "",
          awayLogo: e.strAwayTeamBadge || "",
          venue: clean(e.strVenue || ""),
        });
      }
    } catch {
      /* ignore day */
    }
  }
  return out;
}

function mapApiFootballFixture(x) {
  const statusShort = String(x.fixture?.status?.short || "");
  const statusLong = clean(x.fixture?.status?.long || "Scheduled");
  const live =
    ["1H", "2H", "ET", "BT", "P", "LIVE", "HT"].includes(statusShort) ||
    /live|half|progress/i.test(statusLong);
  const completed = ["FT", "AET", "PEN"].includes(statusShort) || /full.?time|finished/i.test(statusLong);
  return {
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
    status: statusLong,
    statusState: live ? "in" : completed ? "post" : "pre",
    startTime: x.fixture?.date,
    live,
    completed,
    homeLogo: x.teams?.home?.logo || "",
    awayLogo: x.teams?.away?.logo || "",
    venue: clean(x.fixture?.venue?.name || ""),
    apiFixtureId: String(x.fixture.id),
  };
}

function apiFootballKey() {
  return (
    process.env.API_FOOTBALL_KEY ||
    process.env.API_SPORTS_KEY ||
    process.env.APIFOOTBALL_KEY ||
    process.env.API_FOOTBALL ||
    ""
  );
}

async function fetchApiFootball() {
  const apiKey = apiFootballKey();
  if (!apiKey) return [];
  // Suspended accounts return errors — fail soft
  const headers = { "x-apisports-key": apiKey, Accept: "application/json" };
  const out = [];
  try {
    const url = `https://v3.football.api-sports.io/fixtures?date=${isoDate(0)}`;
    const response = await fetch(url, { headers, signal: AbortSignal.timeout(6000) });
    if (!response.ok) return [];
    const data = await response.json();
    if (data?.errors && Object.keys(data.errors).length) return [];
    for (const x of data?.response || []) {
      const m = mapApiFootballFixture(x);
      if (m.home && m.away) out.push(m);
    }
  } catch {
    return [];
  }
  return out;
}

async function getAllMatches() {
  // Free sources first — do not depend on suspended API-Football
  const [espn, tsdb, apiFb] = await Promise.all([
    fetchEspnAll(),
    fetchTheSportsDb(),
    fetchApiFootball(),
  ]);

  const all = [...espn, ...tsdb, ...apiFb];
  const seen = new Set();
  return all.filter((match) => {
    if (!match?.home || !match?.away) return false;
    const key = `${match.sport}|${match.home}|${match.away}|${(match.startTime || "").slice(0, 13)}|${match.id}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function rssImage(item) {
  const candidates = [
    item?.enclosure?.url,
    item?.enclosure?.link,
    item?.["media:content"]?.$?.url,
    item?.["media:content"]?.url,
    item?.["media:thumbnail"]?.$?.url,
    item?.["media:thumbnail"]?.url,
    item?.image?.url,
    item?.image?.link,
    item?.itunes?.image,
  ];
  const hit = candidates.find((x) => typeof x === "string" && /^https?:\/\//i.test(x));
  if (hit) return hit;
  const html = String(item?.content || item?.["content:encoded"] || item?.summary || item?.description || "");
  const m =
    html.match(/<img[^>]+(?:src|data-src)=["'](https?:\/\/[^"' >]+)["']/i) ||
    html.match(/src=["'](https?:\/\/[^"']+)["']/i);
  return m?.[1] || "";
}

async function pexelsImage(query) {
  const key = process.env.PEXELS_API_KEY || process.env.PEXELS_KEY || process.env.PEXELS_API || "";
  if (!key) return "";
  try {
    const u = new URL("https://api.pexels.com/v1/search");
    u.searchParams.set("query", query || "football stadium");
    u.searchParams.set("per_page", "1");
    u.searchParams.set("orientation", "landscape");
    const r = await fetch(u.toString(), {
      headers: { Authorization: key, Accept: "application/json" },
      signal: AbortSignal.timeout(4000),
    });
    if (!r.ok) return "";
    const data = await r.json();
    const photo = Array.isArray(data?.photos) ? data.photos[0] : null;
    return photo?.src?.large || photo?.src?.medium || photo?.src?.original || "";
  } catch {
    return "";
  }
}

async function resolveStoryImage(existing) {
  if (existing && /^https?:\/\//i.test(existing) && !/rwdnews-logo/i.test(existing)) {
    return existing;
  }
  const fromPexels = await pexelsImage("soccer football match stadium");
  return fromPexels || PLACEHOLDER;
}

async function getRssSportsNews() {
  const results = await Promise.allSettled(
    SPORT_RSS.map(async ([url, source]) => {
      try {
        const feed = await rss.parseURL(url);
        return (feed.items || []).slice(0, 10).map((item, index) => ({
          id: `rss-${Buffer.from(String(item.link || index)).toString("base64url").slice(0, 20)}`,
          original_url: String(item.link || item.guid || ""),
          image: rssImage(item),
          timestamp: item.isoDate || item.pubDate || new Date().toISOString(),
          source,
          original_title: clean(item.title),
          original_description: clean(item.contentSnippet || item.summary || "").slice(0, 800),
          ai_hook_title: clean(item.title),
          ai_summary: [
            clean(item.contentSnippet || item.summary || "Sports report from the live wire.").slice(0, 400),
          ],
          category: "Sports",
          story_type: "WIRE",
        }));
      } catch {
        return [];
      }
    }),
  );
  return results.flatMap((r) => (r.status === "fulfilled" ? r.value : []));
}

async function getDbSportsNews() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  if (!url || !key) return [];
  try {
    const db = createClient(url, key);
    const { data, error } = await db
      .from("articles")
      .select(
        "id,original_url,image,timestamp,source,original_title,original_description,ai_hook_title,ai_summary,category,region,body,story_type",
      )
      .order("timestamp", { ascending: false })
      .limit(120);
    if (error || !Array.isArray(data)) return [];
    const sportRe =
      /\b(sport|sports|football|soccer|premier league|champions league|uefa|fifa|nba|nfl|mlb|nhl|tennis|cricket|transfer|arsenal|chelsea|liverpool|manchester|barcelona|real madrid|basketball|baseball|hockey)\b/i;
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
  try {
    const u = new URL("https://api.gdeltproject.org/api/v2/doc/doc");
    u.searchParams.set(
      "query",
      "(football OR soccer OR NBA OR NFL OR Premier League OR Champions League OR transfer OR tennis)",
    );
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
      id: `gdelt-s-${Buffer.from(String(article.url || index)).toString("base64url").slice(0, 20)}`,
      original_url: String(article.url || ""),
      image: String(article.socialimage || ""),
      timestamp: article.seendate ? new Date(article.seendate).toISOString() : new Date().toISOString(),
      source: clean(article.domain || "Sports wire"),
      original_title: clean(article.title || ""),
      original_description: "",
      ai_hook_title: clean(article.title || ""),
      ai_summary: ["Sports report from the global news index."],
      category: "Sports",
      story_type: "WIRE",
    }));
  } catch {
    return [];
  }
}

function isRumor(story) {
  return /\b(rumou?r|transfer|linked|interest|target|bid|offer|talks|negotiat|could join|set to join|loan|reportedly)\b/i.test(
    `${story.original_title} ${story.original_description}`,
  );
}

async function withImages(stories) {
  const out = [];
  for (let i = 0; i < stories.length; i += 6) {
    const batch = stories.slice(i, i + 6);
    const enriched = await Promise.all(
      batch.map(async (s) => ({
        ...s,
        image: await resolveStoryImage(s.image),
      })),
    );
    out.push(...enriched);
  }
  return out;
}

export async function handler(event) {
  try {
    const qs = event.queryStringParameters || {};
    const action = qs.action || "hub";
    const affiliateUrl = process.env.SPORTS_AFFILIATE_URL || process.env.VITE_SPORTS_AFFILIATE_URL || "";

    const [matches, dbNews, rssNews, discovered] = await Promise.all([
      getAllMatches(),
      getDbSportsNews(),
      getRssSportsNews(),
      gdeltSports(),
    ]);

    if (action === "match") {
      const match = matches.find((item) => item.id === (qs.id || ""));
      if (!match) {
        return {
          statusCode: 404,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ error: "Match not found" }),
        };
      }
      return {
        statusCode: 200,
        headers: { "Content-Type": "application/json", "Cache-Control": "public, max-age=20" },
        body: JSON.stringify({
          match,
          detail: null,
          affiliateUrl,
          generatedAt: new Date().toISOString(),
        }),
      };
    }

    const newsMap = new Map();
    [...dbNews, ...rssNews, ...discovered].forEach((story) => {
      if (story.original_url && !newsMap.has(story.original_url)) {
        newsMap.set(story.original_url, story);
      }
    });

    let news = Array.from(newsMap.values())
      .sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp))
      .slice(0, 36);
    news = await withImages(news);

    const live = matches.filter((m) => m.live).slice(0, 80);
    const upcoming = matches
      .filter((m) => !m.live && !m.completed)
      .sort((a, b) => new Date(a.startTime || 0) - new Date(b.startTime || 0))
      .slice(0, 120);
    const results = matches
      .filter((m) => m.completed || (m.homeScore != null && m.awayScore != null && !m.live))
      .sort((a, b) => new Date(b.startTime || 0) - new Date(a.startTime || 0))
      .slice(0, 120);
    const featured = matches
      .filter((m) =>
        /premier league|champions league|la liga|bundesliga|serie a|ligue 1|nba|nfl/i.test(m.league),
      )
      .slice(0, 120);
    const rumors = news.filter(isRumor).slice(0, 40);

    const providersUsed = Array.from(new Set(matches.map((m) => m.provider).filter(Boolean)));

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "public, max-age=20, stale-while-revalidate=60",
      },
      body: JSON.stringify({
        live,
        featured,
        upcoming,
        results,
        news,
        rumors,
        majorLeagues: [
          "Premier League",
          "UEFA Champions League",
          "La Liga",
          "Bundesliga",
          "Serie A",
          "Ligue 1",
          "NBA",
          "NFL",
        ].map((name) => ({
          name,
          available: matches.some((m) => m.league.toLowerCase().includes(name.toLowerCase())),
        })),
        bySport: Object.keys(SPORT_LABELS).reduce((acc, key) => {
          acc[key] = matches.filter((m) => m.sport === key).slice(0, 100);
          return acc;
        }, {}),
        affiliateUrl,
        counts: {
          matches: matches.length,
          live: live.length,
          results: results.length,
          upcoming: upcoming.length,
          news: news.length,
          rumors: rumors.length,
        },
        providers: {
          scoreboard: providersUsed.length ? providersUsed.join(" + ") : "ESPN + TheSportsDB (free)",
          news: "RSS + Supabase + GDELT + Pexels",
          freeOnly: true,
          apiFootballKeyPresent: Boolean(apiFootballKey()),
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
        results: [],
        news: [],
        rumors: [],
        majorLeagues: [],
        bySport: {},
        affiliateUrl: "",
      }),
    };
  }
}
