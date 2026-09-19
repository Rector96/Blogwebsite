type Match = {
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

function env(name: string) {
  return process.env[name] || "";
}

async function loadMatches(req: Request): Promise<Match[]> {
  const url = new URL("/api/sports", req.url);
  const response = await fetch(url, {
    headers: { Accept: "application/json", "User-Agent": "RWDNEWS/1.0 prediction-engine" },
    signal: AbortSignal.timeout(12000),
  });
  if (!response.ok) throw new Error("Sports data unavailable");
  const data: any = await response.json();
  const all = [
    ...(Array.isArray(data?.live) ? data.live : []),
    ...(Array.isArray(data?.featured) ? data.featured : []),
    ...(Array.isArray(data?.upcoming) ? data.upcoming : []),
  ];
  const seen = new Set<string>();
  return all.filter((m: Match) => {
    if (!m?.id || !m.home || !m.away || seen.has(m.id)) return false;
    seen.add(m.id);
    return true;
  });
}

function probabilityTotal(p: any) {
  const values = [Number(p?.homeWin), Number(p?.draw), Number(p?.awayWin)].map((n) =>
    Number.isFinite(n) ? n : 0,
  );
  const total = values.reduce((a, b) => a + b, 0);
  return total > 0 ? total : 100;
}

async function makePrediction(match: Match) {
  const key = env("OPENAI_API_KEY");
  if (!key) {
    return {
      configured: false,
      message: "OpenAI prediction engine is not configured yet. The sports data feed is live, but RWDNEWS will not invent a prediction without the AI engine.",
    };
  }

  const model = env("OPENAI_MODEL") || "gpt-5.6-luna";
  const payload = {
    model,
    store: false,
    input: [
      {
        role: "system",
        content:
          "You are the RWDNEWS Sports Prediction Engine. Produce cautious, data-grounded sports commentary from ONLY the verified match record supplied by RWDNEWS. Never invent form, injuries, suspensions, rankings, head-to-head records, odds, weather, lineups, player availability, statistics or news. If a factor is missing, say it is unavailable. A prediction is probabilistic commentary, never a guarantee and never betting advice. Do not claim 90% accuracy. Confidence must reflect the quality and completeness of the supplied data. For football use home/draw/away probabilities. For other sports use the same three fields only as a generic outcome framing where appropriate; otherwise explain the limitation and keep probabilities conservative. Return concise original RWDNEWS commentary.",
      },
      {
        role: "user",
        content: JSON.stringify({
          task: "Analyze this upcoming or live match and produce a transparent prediction using only these verified fields.",
          match,
          currentTime: new Date().toISOString(),
        }),
      },
    ],
    max_output_tokens: 900,
    text: {
      format: {
        type: "json_schema",
        name: "rwdnews_sports_prediction",
        strict: true,
        schema: {
          type: "object",
          additionalProperties: false,
          properties: {
            headline: { type: "string" },
            mostLikelyOutcome: { type: "string" },
            homeWin: { type: "number" },
            draw: { type: "number" },
            awayWin: { type: "number" },
            confidence: { type: "string", enum: ["Low", "Moderate", "High"] },
            dataQuality: { type: "string", enum: ["Limited", "Usable", "Strong"] },
            analysis: { type: "string" },
            keyFactors: { type: "array", items: { type: "string" } },
            uncertainty: { type: "string" },
            updateTrigger: { type: "string" },
          },
          required: [
            "headline",
            "mostLikelyOutcome",
            "homeWin",
            "draw",
            "awayWin",
            "confidence",
            "dataQuality",
            "analysis",
            "keyFactors",
            "uncertainty",
            "updateTrigger",
          ],
        },
      },
    },
  };

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(30000),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`OpenAI prediction request failed (${response.status}) ${detail.slice(0, 240)}`);
  }

  const data: any = await response.json();
  const text = String(data?.output_text || "");
  const parsed = JSON.parse(text);
  const total = probabilityTotal(parsed);
  const normalize = (value: unknown) => {
    const n = Number(value);
    return Number.isFinite(n) ? Math.max(0, Math.min(100, (n / total) * 100)) : 0;
  };

  return {
    configured: true,
    provider: "OpenAI",
    model,
    generatedAt: new Date().toISOString(),
    match,
    prediction: {
      ...parsed,
      homeWin: Number(normalize(parsed.homeWin).toFixed(1)),
      draw: Number(normalize(parsed.draw).toFixed(1)),
      awayWin: Number(normalize(parsed.awayWin).toFixed(1)),
    },
    disclaimer:
      "RWDNEWS predictions are AI-assisted statistical commentary based on available verified sports data. They are not guarantees of match results and are not betting, financial or gambling advice. Sports outcomes are inherently uncertain and predictions may change when verified information changes.",
  };
}

export default async (req: Request) => {
  if (req.method !== "GET") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "content-type": "application/json" },
    });
  }

  try {
    const matches = await loadMatches(req);
    const id = new URL(req.url).searchParams.get("id") || "";
    if (!id) {
      return new Response(
        JSON.stringify({
          matches: matches.filter((m) => !m.live).slice(0, 80),
          aiConfigured: Boolean(env("OPENAI_API_KEY")),
          provider: "OpenAI",
          generatedAt: new Date().toISOString(),
        }),
        { headers: { "content-type": "application/json", "cache-control": "public, max-age=30, stale-while-revalidate=120" } },
      );
    }

    const match = matches.find((m) => m.id === id);
    if (!match) {
      return new Response(JSON.stringify({ error: "Match not found" }), {
        status: 404,
        headers: { "content-type": "application/json" },
      });
    }

    const result = await makePrediction(match);
    return new Response(JSON.stringify(result), {
      headers: { "content-type": "application/json", "cache-control": "public, max-age=60, stale-while-revalidate=300" },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Prediction unavailable",
        aiConfigured: Boolean(env("OPENAI_API_KEY")),
      }),
      { status: 502, headers: { "content-type": "application/json" } },
    );
  }
};

export const config = { path: "/api/sports-prediction" };
