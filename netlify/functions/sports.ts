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

/** Free public ESPN scoreboard endpoints (no API key) */
const ESPN_BOARDS: { sport: string; path: string; league: string }[] = [
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
  return events
    .map((event: any): SportMatch | null => {
      const competition = event?.competitions?.[0];
      const competitors = competition?.competitors || [];
      const home = competitors.find((c: any) => c.homeAway === "home") || competitors[0];
      const away = competitors.find((c: any) => c.homeAway === "away") || competitors[1];
      if (!home || !away) return null;
      const statusName = clean(event?.status?.type?.description || event?.status?.type?.name || "Scheduled");
      const state = String(event?.status?.type?.state || "").toLowerCase();
      const live = state === "in" || /live|in progress/i.test(statusName);
      return {
        id: String(event.id || `${path}-${home.team?.abbreviation}-${away.team?.abbreviation}`),
        sport,
        league: clean(event?.season?.slug ? leagueFallback : competition?.league?.name || leagueFallback),
        home: clean(home.team?.displayName || home.team?.name),
        away: clean(away.team?.displayName || away.team?.name),
        homeScore: home.score != null && home.score !== "" ? Number(home.score) : null,
        awayScore: away.score != null && away.score !== "" ? Number(away.score) : null,
        status: statusName,
        startTime: event.date ? new Date(event.date).toISOString() : undefined,
        live,
        source: "ESPN",
      };
    })
    .filter(Boolean) as SportMatch[];
}

async function getAllEspnMatches(): Promise<SportMatch[]> {
  const results = await Promise.allSettled(
    ESPN_BOARDS.map((b) => getEspnBoard(b.path, b.sport, b.league)),
  );
  return results.flatMap((r) => (r.status === "fulfilled" ? r.value : []));
}

export default async (req: Request) => {
  if (req.method !== "GET") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405 });
  }

  const url = new URL(req.url);
  const action = url.searchParams.get("action") || "live";

  try {
    const matches = await getAllEspnMatches();
    const live = matches.filter((m) => m.live);
    const majorLeaguePatterns: Record<string, string[]> = {
      "Premier League": ["premier league"],
      "UEFA Champions League": ["champions league"],
      "La Liga": ["la liga"],
      "Bundesliga": ["bundesliga"],
      "Serie A": ["serie a"],
      "Ligue 1": ["ligue 1"],
      "MLS": ["mls"],
      NBA: ["nba"],
      NFL: ["nfl"],
      MLB: ["mlb"],
      NHL: ["nhl"],
      ATP: ["atp"],
    };

    const featured = matches
      .filter((m) =>
        Object.values(majorLeaguePatterns).some((patterns) =>
          patterns.some((p) => m.league.toLowerCase().includes(p)),
        ),
      )
      .slice(0, 40);
    const upcoming = matches.filter((m) => !m.live).slice(0, 40);

    if (action === "preview") {
      const match = matches.find((m) => m.id === url.searchParams.get("id"));
      if (!match) {
        return new Response(JSON.stringify({ error: "Match not found" }), { status: 404 });
      }
      const key = env("GEMINI_API_KEY");
      if (!key) {
        return new Response(
          JSON.stringify({
            match,
            situation: `${match.home} vs ${match.away} — ${match.status}.`,
            factors: "Only verified scoreboard fields are available for this outlook.",
            outlook:
              "RWDNEWS will not invent form, injuries, or odds. Treat any outlook as informational only.",
          }),
          { headers: { "content-type": "application/json" } },
        );
      }
      const ai = new GoogleGenAI({ apiKey: key });
      const response = await ai.models.generateContent({
        model: "gemini-2.0-flash",
        contents: `RWDNEWS sports analyst. Cautious outlook using ONLY: ${JSON.stringify(match)}. No invented stats. No betting advice. Return situation, factors, outlook.`,
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
      return new Response(
        JSON.stringify({ match, ...JSON.parse((response as any).text || "{}") }),
        {
          headers: {
            "content-type": "application/json",
            "cache-control": "public, max-age=30",
          },
        },
      );
    }

    return new Response(
      JSON.stringify({
        live,
        featured,
        upcoming,
        majorLeagues: Object.entries(majorLeaguePatterns).map(([name, patterns]) => ({
          name,
          available: matches.some((m) =>
            patterns.some((p) => m.league.toLowerCase().includes(p)),
          ),
        })),
        provider: "ESPN",
        count: matches.length,
        generatedAt: new Date().toISOString(),
      }),
      {
        headers: {
          "content-type": "application/json",
          "cache-control": "public, max-age=45, stale-while-revalidate=120",
        },
      },
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Sports feed unavailable",
        live: [],
        featured: [],
        upcoming: [],
      }),
      { status: 502, headers: { "content-type": "application/json" } },
    );
  }
};

export const config = { path: "/api/sports" };
