function env(name) {
  return process.env[name] || "";
}

function dateKey(offsetDays = 0) {
  const d = new Date(Date.now() + offsetDays * 86400000);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}${m}${day}`;
}

const BOARDS = [
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
  { sport: "tennis", path: "tennis/wta", league: "WTA" },
];

function mapEvent(event, b) {
  const c = event?.competitions?.[0];
  const teams = c?.competitors || [];
  const home = teams.find((x) => x.homeAway === "home") || teams[0];
  const away = teams.find((x) => x.homeAway === "away") || teams[1];
  if (!home || !away) return null;
  const statusType = event?.status?.type || c?.status?.type || {};
  const state = String(statusType.state || "").toLowerCase();
  return {
    id: `espn-${event.id}`,
    providerId: String(event.id),
    provider: "ESPN",
    boardPath: b.path,
    sport: b.sport,
    league: b.league,
    home: home.team?.displayName || home.team?.name,
    away: away.team?.displayName || away.team?.name,
    homeScore: home.score !== "" && home.score != null ? Number(home.score) : null,
    awayScore: away.score !== "" && away.score != null ? Number(away.score) : null,
    status: statusType.description || statusType.name || "Scheduled",
    startTime: event.date ? new Date(event.date).toISOString() : undefined,
    live: state === "in",
    completed: Boolean(statusType.completed) || state === "post",
    homeLogo: home.team?.logo || "",
    awayLogo: away.team?.logo || "",
  };
}

async function fetchBoard(b, dates) {
  try {
    const u = new URL(`https://site.api.espn.com/apis/site/v2/sports/${b.path}/scoreboard`);
    if (dates) u.searchParams.set("dates", dates);
    const r = await fetch(u.toString(), {
      headers: {
        Accept: "application/json",
        "User-Agent": "Mozilla/5.0 (compatible; RWDNEWS/2.0)",
      },
      signal: AbortSignal.timeout(8000),
    });
    if (!r.ok) return [];
    const d = await r.json();
    return (Array.isArray(d?.events) ? d.events : []).map((e) => mapEvent(e, b)).filter(Boolean);
  } catch {
    return [];
  }
}

async function loadMatches() {
  const jobs = [];
  for (const b of BOARDS) {
    jobs.push(fetchBoard(b, null));
    for (const offset of [0, 1, 2, -1]) jobs.push(fetchBoard(b, dateKey(offset)));
  }
  const results = await Promise.allSettled(jobs);
  return results.flatMap((r) => (r.status === "fulfilled" ? r.value : []));
}

async function loadApiFootballLive() {
  const key = env("API_FOOTBALL_KEY") || env("API_SPORTS_KEY");
  if (!key) return [];
  try {
    const r = await fetch("https://v3.football.api-sports.io/fixtures?live=all", {
      headers: { "x-apisports-key": key, Accept: "application/json" },
      signal: AbortSignal.timeout(8000),
    });
    if (!r.ok) return [];
    const d = await r.json();
    return (d?.response || [])
      .map((x) => ({
        id: `api-football-${x.fixture.id}`,
        apiFixtureId: String(x.fixture.id),
        provider: "API-Football",
        sport: "football",
        league: x.league?.name || "Football",
        home: x.teams?.home?.name,
        away: x.teams?.away?.name,
        homeScore: x.goals?.home ?? null,
        awayScore: x.goals?.away ?? null,
        status: x.fixture?.status?.long || "Live",
        startTime: x.fixture?.date,
        live: true,
        homeLogo: x.teams?.home?.logo || "",
        awayLogo: x.teams?.away?.logo || "",
      }))
      .filter((x) => x.home && x.away);
  } catch {
    return [];
  }
}

async function openaiPrediction(match) {
  const key = env("OPENAI_API_KEY");
  if (!key) return null;
  try {
    const prompt = [
      "You are RWDNEWS sports analyst. Write a cautious pre-match outlook.",
      "Do NOT invent injuries, table positions, or odds. Use only the fixture facts given.",
      "Return strict JSON with keys:",
      "headline (string), mostLikelyOutcome (string), homeWin (number 0-100), draw (number 0-100), awayWin (number 0-100),",
      "confidence (Low|Moderate|High), dataQuality (Limited|Usable|Strong), analysis (2-4 sentences),",
      "keyFactors (array of 3 short strings), uncertainty (1 sentence), updateTrigger (1 short sentence).",
      match.sport === "football"
        ? "For football, homeWin+draw+awayWin must equal 100."
        : "For non-football sports, draw must be 0 and homeWin+awayWin must equal 100.",
      `Fixture: ${match.league} — ${match.home} vs ${match.away}.`,
      `Status: ${match.status}. Start: ${match.startTime || "unknown"}. Sport: ${match.sport}.`,
      match.live ? `Live score: ${match.homeScore ?? "-"} - ${match.awayScore ?? "-"}.` : "Not live yet.",
    ].join("\n");

    const r = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: env("OPENAI_MODEL") || "gpt-4o-mini",
        temperature: 0.3,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: "Return only valid JSON. No betting tips. Be cautious." },
          { role: "user", content: prompt },
        ],
      }),
      signal: AbortSignal.timeout(12000),
    });

    if (!r.ok) return null;
    const d = await r.json();
    const text = d?.choices?.[0]?.message?.content;
    if (!text) return null;
    const parsed = JSON.parse(text);

    let homeWin = Number(parsed.homeWin) || 34;
    let draw = Number(parsed.draw) || 32;
    let awayWin = Number(parsed.awayWin) || 34;

    if (match.sport !== "football") {
      draw = 0;
      const sum = homeWin + awayWin || 1;
      homeWin = Math.round((homeWin / sum) * 100);
      awayWin = Math.max(0, 100 - homeWin);
    } else {
      const sum = homeWin + draw + awayWin || 1;
      homeWin = Math.round((homeWin / sum) * 100);
      draw = Math.round((draw / sum) * 100);
      awayWin = Math.max(0, 100 - homeWin - draw);
    }

    return {
      configured: true,
      provider: "OpenAI",
      match,
      prediction: {
        headline: String(parsed.headline || `${match.home} vs ${match.away} — RWDNEWS outlook`),
        mostLikelyOutcome: String(parsed.mostLikelyOutcome || "No strong lean"),
        homeWin,
        draw,
        awayWin,
        confidence: String(parsed.confidence || "Low"),
        dataQuality: String(parsed.dataQuality || "Limited"),
        analysis: String(parsed.analysis || "Cautious outlook based on available fixture data only."),
        keyFactors: Array.isArray(parsed.keyFactors)
          ? parsed.keyFactors.map(String).slice(0, 5)
          : ["Fixture confirmed", "Limited form inputs", "Outcomes remain uncertain"],
        uncertainty: String(
          parsed.uncertainty ||
            "Sports results are inherently uncertain. This is commentary, not a guarantee.",
        ),
        updateTrigger: String(
          parsed.updateTrigger || "New verified team news, lineups or live match state",
        ),
      },
      disclaimer:
        "RWDNEWS predictions are informational sports analysis only — not betting or financial advice.",
      generatedAt: new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

function baseline(match) {
  const football = match.sport === "football";
  return {
    configured: Boolean(env("OPENAI_API_KEY")),
    provider: "RWDNEWS baseline",
    match,
    prediction: {
      headline: `${match.home} vs ${match.away} — cautious pre-match outlook`,
      mostLikelyOutcome: "No strong lean from available data",
      homeWin: football ? 38 : 52,
      draw: football ? 26 : 0,
      awayWin: football ? 36 : 48,
      confidence: "Low",
      dataQuality: "Limited",
      analysis:
        "RWDNEWS has the verified fixture. Without enough confirmed form data, probabilities stay close and confidence stays low.",
      keyFactors: [
        "Fixture confirmed",
        "No invented injuries, rankings or historical results",
        "Match outcomes remain uncertain",
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
    const matches = [...(await loadApiFootballLive()), ...(await loadMatches())];
    const unique = matches
      .filter((m, i, a) => a.findIndex((x) => x.id === m.id) === i)
      .filter((m) => m.home && m.away);

    const id = qs.id || "";
    if (!id) {
      return {
        statusCode: 200,
        headers: { "Content-Type": "application/json", "Cache-Control": "public, max-age=30" },
        body: JSON.stringify({
          matches: unique.filter((m) => !m.live && !m.completed).slice(0, 100),
          live: unique.filter((m) => m.live).slice(0, 50),
          aiConfigured: Boolean(env("OPENAI_API_KEY")),
          providerConfigured: Boolean(env("API_FOOTBALL_KEY") || env("API_SPORTS_KEY")),
          generatedAt: new Date().toISOString(),
        }),
      };
    }

    const match = unique.find((m) => m.id === id);
    if (!match) {
      return {
        statusCode: 404,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: "Match not found" }),
      };
    }

    const result = (await openaiPrediction(match)) || baseline(match);
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
