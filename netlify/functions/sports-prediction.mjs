function env(name) { return process.env[name] || ""; }

function dateKey(offsetDays = 0) {
  const d = new Date(Date.now() + offsetDays * 86400000);
  return d.toISOString().slice(0, 10).replaceAll("-", "");
}

async function loadMatches() {
  const boards = [
    { sport: "football", path: "soccer/eng.1", league: "Premier League" },
    { sport: "football", path: "soccer/uefa.champions", league: "UEFA Champions League" },
    { sport: "football", path: "soccer/esp.1", league: "La Liga" },
    { sport: "football", path: "soccer/ger.1", league: "Bundesliga" },
    { sport: "football", path: "soccer/ita.1", league: "Serie A" },
    { sport: "football", path: "soccer/fra.1", league: "Ligue 1" },
    { sport: "football", path: "soccer/ned.1", league: "Eredivisie" },
    { sport: "basketball", path: "basketball/nba", league: "NBA" },
    { sport: "basketball", path: "basketball/wnba", league: "WNBA" },
    { sport: "football", path: "football/nfl", league: "NFL" },
    { sport: "baseball", path: "baseball/mlb", league: "MLB" },
    { sport: "hockey", path: "hockey/nhl", league: "NHL" },
    { sport: "tennis", path: "tennis/atp", league: "ATP" },
  ];
  const results = await Promise.allSettled([0, 1, 2, 3].flatMap(offset => boards.map(async (b) => {
    const u = new URL(`https://site.api.espn.com/apis/site/v2/sports/${b.path}/scoreboard`);
    u.searchParams.set("dates", dateKey(offset));
    const r = await fetch(u, { headers: { Accept: "application/json", "User-Agent": "RWDNEWS/2.0" }, signal: AbortSignal.timeout(7000) });
    if (!r.ok) return [];
    const d = await r.json();
    return (Array.isArray(d?.events) ? d.events : []).map((event) => {
      const c = event?.competitions?.[0];
      const teams = c?.competitors || [];
      const home = teams.find(x => x.homeAway === "home") || teams[0];
      const away = teams.find(x => x.homeAway === "away") || teams[1];
      if (!home || !away) return null;
      const statusType = event?.status?.type || c?.status?.type || {};
      const state = String(statusType.state || "").toLowerCase();
      return {
        id: `espn-${event.id}`, providerId: String(event.id), provider: "ESPN", boardPath: b.path,
        sport: b.sport, league: b.league, home: home.team?.displayName || home.team?.name,
        away: away.team?.displayName || away.team?.name,
        homeScore: home.score !== "" && home.score != null ? Number(home.score) : null,
        awayScore: away.score !== "" && away.score != null ? Number(away.score) : null,
        status: event?.status?.type?.description || "Scheduled",
        startTime: event.date ? new Date(event.date).toISOString() : undefined,
        live: state === "in", completed: Boolean(statusType.completed) || state === "post", homeLogo: home.team?.logo || "", awayLogo: away.team?.logo || ""
      };
    }).filter(Boolean);
  })));
  return results.flatMap(r => r.status === "fulfilled" ? r.value : []);
}

async function loadApiFootballLive() {
  const key = env("API_FOOTBALL_KEY") || env("API_SPORTS_KEY");
  if (!key) return [];
  try {
    const r = await fetch("https://v3.football.api-sports.io/fixtures?live=all", { headers: { "x-apisports-key": key, Accept: "application/json" }, signal: AbortSignal.timeout(8000) });
    if (!r.ok) return [];
    const d = await r.json();
    return (d?.response || []).map(x => ({
      id: `api-football-${x.fixture.id}`, apiFixtureId: String(x.fixture.id), provider: "API-Football",
      sport: "football", league: x.league?.name || "Football", home: x.teams?.home?.name, away: x.teams?.away?.name,
      homeScore: x.goals?.home ?? null, awayScore: x.goals?.away ?? null,
      status: x.fixture?.status?.long || "Live", startTime: x.fixture?.date, live: true,
      homeLogo: x.teams?.home?.logo || "", awayLogo: x.teams?.away?.logo || ""
    })).filter(x => x.home && x.away);
  } catch { return []; }
}

async function apiFootballPrediction(match) {
  const key = env("API_FOOTBALL_KEY") || env("API_SPORTS_KEY");
  if (!key || !match?.apiFixtureId) return null;
  try {
    const u = new URL("https://v3.football.api-sports.io/predictions");
    u.searchParams.set("fixture", match.apiFixtureId);
    const r = await fetch(u, { headers: { "x-apisports-key": key, Accept: "application/json" }, signal: AbortSignal.timeout(8000) });
    if (!r.ok) return null;
    const d = await r.json();
    const p = d?.response?.[0];
    if (!p) return null;
    const pct = p.predictions?.percent || {};
    return {
      configured: true, provider: "API-Football", match,
      prediction: {
        headline: `${match.home} vs ${match.away} — data-based match outlook`,
        mostLikelyOutcome: p.predictions?.winner?.name || "No strong outcome",
        homeWin: Number.parseFloat(String(pct.home || "0")) || 0,
        draw: Number.parseFloat(String(pct.draw || "0")) || 0,
        awayWin: Number.parseFloat(String(pct.away || "0")) || 0,
        confidence: "Data-based", dataQuality: "Provider model",
        analysis: p.predictions?.advice || "The provider did not return written commentary.",
        keyFactors: [
          p.predictions?.under_over ? `Goal outlook: ${p.predictions.under_over}` : "Goal outlook unavailable",
          p.predictions?.goals?.home != null ? `Estimated home goals: ${p.predictions.goals.home}` : "Home goal estimate unavailable",
          p.predictions?.goals?.away != null ? `Estimated away goals: ${p.predictions.goals.away}` : "Away goal estimate unavailable"
        ],
        uncertainty: "A statistical forecast cannot guarantee a match result.",
        updateTrigger: "New verified team data, lineups or match state"
      },
      disclaimer: "RWDNEWS predictions are informational sports analysis, not betting advice.",
      generatedAt: new Date().toISOString()
    };
  } catch { return null; }
}

function baseline(match) {
  return {
    configured: false, provider: "RWDNEWS baseline", match,
    prediction: {
      headline: `${match.home} vs ${match.away} — cautious pre-match outlook`,
      mostLikelyOutcome: "No strong lean from available data",
      homeWin: 38, draw: 26, awayWin: 36, confidence: "Low", dataQuality: "Limited",
      analysis: "RWDNEWS has the verified fixture but not enough verified form data for a stronger statistical statement.",
      keyFactors: ["Fixture confirmed", "No invented injuries or rankings", "Match outcomes remain uncertain"],
      uncertainty: "Sports results are inherently uncertain. This is commentary, not a guarantee or betting tip.",
      updateTrigger: "New verified team news, lineups or live match state"
    },
    disclaimer: "RWDNEWS predictions are informational commentary only — not betting or financial advice.",
    generatedAt: new Date().toISOString()
  };
}

export async function handler(event) {
  try {
    const qs = event.queryStringParameters || {};
    const matches = [...(await loadApiFootballLive()), ...(await loadMatches())];
    const unique = matches.filter((m, i, a) => a.findIndex(x => x.id === m.id) === i)
      .filter(m => m.home && m.away);
    const id = qs.id || "";
    if (!id) {
      return { statusCode: 200, headers: { "Content-Type": "application/json", "Cache-Control": "public, max-age=30" }, body: JSON.stringify({
        matches: unique.filter(m => !m.live).slice(0, 100), live: unique.filter(m => m.live).slice(0, 50),
        aiConfigured: Boolean(env("OPENAI_API_KEY")), providerConfigured: Boolean(env("API_FOOTBALL_KEY") || env("API_SPORTS_KEY")),
        generatedAt: new Date().toISOString()
      }) };
    }
    const match = unique.find(m => m.id === id);
    if (!match) return { statusCode: 404, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ error: "Match not found" }) };
    const result = (await apiFootballPrediction(match)) || baseline(match);
    return { statusCode: 200, headers: { "Content-Type": "application/json", "Cache-Control": "public, max-age=60" }, body: JSON.stringify(result) };
  } catch (e) {
    return { statusCode: 502, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ error: e instanceof Error ? e.message : "Prediction unavailable" }) };
  }
}
