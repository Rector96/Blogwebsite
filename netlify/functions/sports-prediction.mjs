function env(name) {
  return process.env[name] || "";
}

async function loadMatches() {
  // Call ESPN boards directly — do not depend on /api/sports routing
  const boards = [
    { sport: "football", path: "soccer/eng.1", league: "Premier League" },
    { sport: "football", path: "soccer/uefa.champions", league: "UEFA Champions League" },
    { sport: "football", path: "soccer/esp.1", league: "La Liga" },
    { sport: "football", path: "soccer/ger.1", league: "Bundesliga" },
    { sport: "football", path: "soccer/ita.1", league: "Serie A" },
    { sport: "football", path: "soccer/fra.1", league: "Ligue 1" },
    { sport: "basketball", path: "basketball/nba", league: "NBA" },
    { sport: "football", path: "football/nfl", league: "NFL" },
  ];

  const results = await Promise.allSettled(
    boards.map(async (b) => {
      const url = `https://site.api.espn.com/apis/site/v2/sports/${b.path}/scoreboard`;
      const response = await fetch(url, {
        headers: { Accept: "application/json", "User-Agent": "RWDNEWS/1.0" },
        signal: AbortSignal.timeout(7000),
      });
      if (!response.ok) return [];
      const data = await response.json();
      return (Array.isArray(data?.events) ? data.events : [])
        .map((event) => {
          const competition = event?.competitions?.[0];
          const competitors = competition?.competitors || [];
          const home = competitors.find((c) => c.homeAway === "home") || competitors[0];
          const away = competitors.find((c) => c.homeAway === "away") || competitors[1];
          if (!home || !away) return null;
          const status =
            event?.status?.type?.description || event?.status?.type?.name || "Scheduled";
          const state = String(event?.status?.type?.state || "").toLowerCase();
          return {
            id: String(event.id),
            sport: b.sport,
            league: b.league,
            home: home.team?.displayName || home.team?.name,
            away: away.team?.displayName || away.team?.name,
            homeScore: home.score !== "" && home.score != null ? Number(home.score) : null,
            awayScore: away.score !== "" && away.score != null ? Number(away.score) : null,
            status,
            startTime: event.date ? new Date(event.date).toISOString() : undefined,
            live: state === "in",
            homeLogo: home.team?.logo || "",
            awayLogo: away.team?.logo || "",
          };
        })
        .filter(Boolean);
    }),
  );

  const all = results.flatMap((r) => (r.status === "fulfilled" ? r.value : []));
  const seen = new Set();
  return all.filter((m) => {
    if (!m?.id || seen.has(m.id)) return false;
    seen.add(m.id);
    return true;
  });
}

function heuristicPrediction(match) {
  // Transparent baseline when OpenAI is not configured — not betting advice
  const homeWin = 38;
  const draw = 26;
  const awayWin = 36;
  return {
    configured: false,
    provider: "RWDNEWS baseline",
    match,
    prediction: {
      headline: `${match.home} vs ${match.away} — cautious pre-match outlook`,
      mostLikelyOutcome: "Too early for a strong lean without form data",
      homeWin,
      draw,
      awayWin,
      confidence: "Low",
      dataQuality: "Limited",
      analysis: `Only verified board data is available for ${match.league}: ${match.home} vs ${match.away} (${match.status}). Without confirmed form, injuries or head-to-head, RWDNEWS keeps probabilities close and confidence low.`,
      keyFactors: [
        "Scoreboard fixture confirmed",
        "No invented injuries or rankings",
        "Outcomes remain uncertain until more verified data arrives",
      ],
      uncertainty:
        "Sports results are inherently uncertain. This is commentary, not a guarantee or betting tip.",
      updateTrigger: "New verified team news, lineups or live match state",
    },
    disclaimer:
      "RWDNEWS predictions are informational commentary only — not betting or financial advice.",
    generatedAt: new Date().toISOString(),
  };
}

export async function handler(event) {
  try {
    const qs = event.queryStringParameters || {};
    const matches = await loadMatches();
    const id = qs.id || "";

    if (!id) {
      return {
        statusCode: 200,
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "public, max-age=45",
        },
        body: JSON.stringify({
          matches: matches.filter((m) => !m.live).slice(0, 80),
          live: matches.filter((m) => m.live).slice(0, 20),
          aiConfigured: Boolean(env("OPENAI_API_KEY")),
          generatedAt: new Date().toISOString(),
        }),
      };
    }

    const match = matches.find((m) => m.id === id);
    if (!match) {
      return {
        statusCode: 404,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: "Match not found" }),
      };
    }

    // Baseline always works; OpenAI path can be added when key is present
    const result = heuristicPrediction(match);
    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json", "Cache-Control": "public, max-age=60" },
      body: JSON.stringify(result),
    };
  } catch (e) {
    return {
      statusCode: 502,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        error: e instanceof Error ? e.message : "Prediction unavailable",
      }),
    };
  }
}
