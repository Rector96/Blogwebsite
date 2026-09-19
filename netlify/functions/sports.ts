import { GoogleGenAI, Type } from "@google/genai";

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
};

function clean(value: unknown) {
  return String(value ?? "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

function env(name: string) {
  return Netlify.env.get(name) || "";
}

function pick(obj: any, ...keys: string[]) {
  for (const key of keys) {
    if (obj?.[key] !== undefined && obj?.[key] !== null) return obj[key];
  }
  return null;
}

function normalizeMatch(item: any, sport: string): SportMatch | null {
  const home = clean(pick(item, "home", "homeTeam", "home_name")?.name ?? pick(item, "home", "homeTeam", "home_name"));
  const away = clean(pick(item, "away", "awayTeam", "away_name")?.name ?? pick(item, "away", "awayTeam", "away_name"));
  if (!home || !away) return null;
  const status = clean(pick(item, "status", "state", "matchStatus")?.type ?? pick(item, "status", "state", "matchStatus") ?? "Scheduled");
  const scores = item?.score || item?.scores || {};
  const homeScore = pick(item, "homeScore", "home_score") ?? pick(scores, "home", "homeScore");
  const awayScore = pick(item, "awayScore", "away_score") ?? pick(scores, "away", "awayScore");
  const league = clean(
    item?.league?.name ??
    item?.competition?.name ??
    item?.tournament?.name ??
    item?.league ??
    "International",
  );
  const startTime = pick(item, "startTime", "start_time", "timestamp", "date", "kickoff");
  const live = /live|inprogress|in-progress|playing|1h|ht/i.test(status);
  return {
    id: String(pick(item, "id", "matchId", "eventId") ?? `${sport}-${home}-${away}-${startTime ?? ""}`),
    sport,
    league,
    home,
    away,
    homeScore: homeScore == null ? null : Number(homeScore),
    awayScore: awayScore == null ? null : Number(awayScore),
    status,
    startTime: startTime ? new Date(Number(startTime) > 2_000_000_000 ? Number(startTime) : String(startTime)).toISOString() : undefined,
    live,
    source: "SportScore",
  };
}

async function getSport(sport: string) {
  const url = `https://sportscore.com/api/widget/matches/?sport=${encodeURIComponent(sport)}&limit=50`;
  const response = await fetch(url, { headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error(`Sports provider returned ${response.status}`);
  const payload: any = await response.json();
  const list = Array.isArray(payload) ? payload : payload?.data ?? payload?.matches ?? payload?.events ?? [];
  return list.map((item: any) => normalizeMatch(item, sport)).filter(Boolean) as SportMatch[];
}

export default async (req: Request) => {
  if (req.method !== "GET") return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405 });

  const url = new URL(req.url);
  const action = url.searchParams.get("action") || "live";
  try {
    const sports = ["football", "basketball", "cricket", "tennis"];
    const results = await Promise.allSettled(sports.map(getSport));
    const matches = results.flatMap((r) => r.status === "fulfilled" ? r.value : []);
    const live = matches.filter((m) => m.live);
    const majorLeaguePatterns: Record<string, string[]> = {\n      "Premier League":["premier league"], "UEFA Champions League":["champions league"], "La Liga":["la liga"],\n      "Bundesliga":["bundesliga"], "Serie A":["serie a"], "Ligue 1":["ligue 1"],\n      "Europa League":["europa league"], "NBA":["nba"], "NFL":["nfl"], "MLB":["mlb","major league baseball"],\n      "NHL":["nhl"], "Formula 1":["formula 1","f1"], "ICC Cricket":["icc","test match","odi","t20"]\n    };\n    const featuredLeagues = Object.values(majorLeaguePatterns).flat();
      "Premier League", "La Liga", "UEFA Champions League", "Champions League",
      "NBA", "NFL", "MLB", "NHL", "Bundesliga", "Serie A", "Ligue 1",
      "Copa Libertadores", "Europa League",
    ];
    const featured = matches
      .filter((m) => featuredLeagues.some((league) => m.league.toLowerCase().includes(league.toLowerCase())))
      .slice(0, 30);
    const upcoming = matches.filter((m) => !m.live).slice(0, 30);

    if (action === "preview") {
      const match = matches.find((m) => m.id === url.searchParams.get("id"));
      if (!match) return new Response(JSON.stringify({ error: "Match not found" }), { status: 404 });
      const key = env("GEMINI_API_KEY");
      if (!key) return new Response(JSON.stringify({
        match,
        outlook: "AI match outlook is not configured yet. RWDNEWS will only publish predictions when enough verified match data is available.",
      }), { headers: { "content-type": "application/json" } });
      const ai = new GoogleGenAI({ apiKey: key });
      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: `RWDNEWS sports analyst. Give a cautious pre-match or in-match outlook using ONLY these verified fields: ${JSON.stringify(match)}. Do not invent injuries, form, odds, statistics or player information. Do not give gambling advice or guaranteed outcomes. Return three short points: current situation, factors supported by the data, and a clearly uncertain outlook.`,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              situation: { type: Type.STRING },
              factors: { type: Type.STRING },
              outlook: { type: Type.STRING },
            },
            required: ["situation", "factors", "outlook"],
          },
        },
      });
      return new Response(JSON.stringify({ match, ...JSON.parse((response as any).text || "{}") }), { headers: { "content-type": "application/json", "cache-control": "public, max-age=30" } });
    }

    return new Response(JSON.stringify({
      live,
      featured,
      upcoming,
      majorLeagues: Object.entries(majorLeaguePatterns).map(([name, patterns]) => ({ name, available: matches.some(m => patterns.some(p => m.league.toLowerCase().includes(p))) })),
      provider: "SportScore",
      generatedAt: new Date().toISOString(),
    }), { headers: { "content-type": "application/json", "cache-control": "public, max-age=30, stale-while-revalidate=120" } });
  } catch (error) {
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Sports feed unavailable", live: [], featured: [], upcoming: [] }), {
      status: 502,
      headers: { "content-type": "application/json" },
    });
  }
};

export const config = { path: "/api/sports" };
