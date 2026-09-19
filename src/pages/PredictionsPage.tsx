import React, { useEffect, useMemo, useState } from "react";

type Match = {
  id: string;
  sport: string;
  league: string;
  home: string;
  away: string;
  status: string;
  live?: boolean;
  startTime?: string;
  homeLogo?: string;
  awayLogo?: string;
  completed?: boolean;
};

type Prediction = {
  headline: string;
  mostLikelyOutcome: string;
  homeWin: number;
  draw: number;
  awayWin: number;
  confidence: string;
  dataQuality: string;
  analysis: string;
  keyFactors: string[];
  uncertainty: string;
  updateTrigger: string;
};

function timeLabel(iso?: string) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function PredictionsPage() {
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string>("");
  const [prediction, setPrediction] = useState<{
    prediction?: Prediction;
    disclaimer?: string;
    configured?: boolean;
  } | null>(null);
  const [predicting, setPredicting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const id = params.get("id") || "";
    if (id) setSelectedId(id);

    (async () => {
      try {
        const [sportsRes, predRes] = await Promise.all([
          fetch("/api/sports", { headers: { Accept: "application/json" } }),
          fetch("/api/sports-prediction", { headers: { Accept: "application/json" } }),
        ]);

        const list: Match[] = [];
        if (sportsRes.ok) {
          const d = await sportsRes.json();
          list.push(...(d.upcoming || []), ...(d.featured || []), ...(d.live || []));
        }
        if (predRes.ok) {
          const d = await predRes.json();
          list.push(...(d.matches || []), ...(d.live || []));
        }

        const unique = list
          .filter((m) => m?.id && m.home && m.away && m.completed !== true)
          .filter((m, i, arr) => arr.findIndex((x) => x.id === m.id) === i)
          .sort(
            (a, b) =>
              new Date(a.startTime || 0).getTime() - new Date(b.startTime || 0).getTime(),
          );

        setMatches(unique);
        if (id && unique.some((m) => m.id === id)) setSelectedId(id);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const selected = useMemo(
    () => matches.find((m) => m.id === selectedId) || null,
    [matches, selectedId],
  );

  const runPrediction = async (id: string) => {
    setSelectedId(id);
    setPredicting(true);
    setPrediction(null);
    setError(null);
    try {
      const r = await fetch(`/api/sports-prediction?id=${encodeURIComponent(id)}`, {
        headers: { Accept: "application/json" },
      });
      if (!r.ok) throw new Error("Prediction unavailable for this fixture");
      const d = await r.json();
      setPrediction(d);
      window.history.replaceState({}, "", `/sport/predictions?id=${encodeURIComponent(id)}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Prediction failed");
    } finally {
      setPredicting(false);
    }
  };

  useEffect(() => {
    if (selectedId && matches.length && !prediction && !predicting) {
      void runPrediction(selectedId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, matches.length]);

  const p = prediction?.prediction;

  return (
    <main className="min-h-dvh bg-[#f4f4f2] text-neutral-950">
      <header className="border-b border-neutral-800 bg-neutral-950 text-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-4 sm:px-6">
          <a href="/" className="font-display text-lg font-bold sm:text-xl">
            RWDNEWS
          </a>
          <nav className="flex items-center gap-3">
            <a href="/sport" className="text-xs font-semibold text-neutral-300">
              ← Sports desk
            </a>
          </nav>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
        <div className="rounded-2xl border border-amber-200 bg-gradient-to-br from-neutral-950 to-neutral-900 p-5 text-white shadow-lg sm:p-8">
          <p className="text-[10px] font-extrabold tracking-[0.2em] text-amber-400 uppercase">
            Match outlooks
          </p>
          <h1 className="font-display mt-1 text-3xl font-semibold sm:text-4xl">Predictions</h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-neutral-300">
            Pick a fixture for probabilities and a clear, cautious outlook. Not betting advice.
          </p>
        </div>

        {error ? (
          <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
            {error}
          </div>
        ) : null}

        <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_380px]">
          <section>
            <h2 className="font-display text-xl font-semibold">Choose a match</h2>
            <p className="mt-1 text-sm text-neutral-500">Tap any card for an instant outlook.</p>

            {loading ? (
              <p className="mt-6 text-sm text-neutral-500">Loading fixtures…</p>
            ) : matches.length ? (
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {matches.slice(0, 48).map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => void runPrediction(m.id)}
                    className={`rounded-xl border p-4 text-left transition ${
                      selectedId === m.id
                        ? "border-amber-500 bg-amber-50 shadow-md"
                        : "border-neutral-200 bg-white shadow-sm hover:border-neutral-400"
                    }`}
                  >
                    <p className="text-[9px] font-bold tracking-wider text-teal-800 uppercase">
                      {m.league}
                    </p>
                    <p className="mt-2 font-display text-base font-semibold leading-snug">
                      {m.home} vs {m.away}
                    </p>
                    <p className="mt-1 text-[11px] text-neutral-500">
                      {m.live ? "LIVE" : m.status}
                      {m.startTime ? ` · ${timeLabel(m.startTime)}` : ""}
                    </p>
                  </button>
                ))}
              </div>
            ) : (
              <div className="mt-6 rounded-xl border border-dashed bg-white p-8 text-center text-sm text-neutral-600">
                <p className="font-display text-lg font-semibold text-neutral-900">
                  No fixtures on the board right now
                </p>
                <p className="mt-2">
                  When leagues publish the next set of matches, they will appear here automatically.
                  You can still follow sports news on the Sports desk.
                </p>
                <a
                  href="/sport"
                  className="mt-4 inline-flex rounded-full bg-neutral-950 px-4 py-2 text-xs font-bold text-white"
                >
                  Open Sports desk →
                </a>
              </div>
            )}
          </section>

          <aside className="lg:sticky lg:top-6 lg:self-start">
            <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-md">
              <p className="text-[10px] font-extrabold tracking-[0.16em] text-amber-700 uppercase">
                Outlook panel
              </p>

              {predicting ? (
                <p className="mt-4 text-sm text-neutral-500">Building outlook…</p>
              ) : p && selected ? (
                <>
                  <h3 className="font-display mt-2 text-xl font-semibold leading-snug">{p.headline}</h3>
                  <p className="mt-1 text-sm text-neutral-600">
                    {selected.home} vs {selected.away}
                  </p>

                  <div className="mt-5 space-y-2">
                    {[
                      ["Home win", p.homeWin, selected.home],
                      ["Draw", p.draw, "Draw"],
                      ["Away win", p.awayWin, selected.away],
                    ].map(([label, pct, name]) => (
                      <div key={String(label)}>
                        <div className="mb-1 flex justify-between text-[11px] font-semibold">
                          <span>{name as string}</span>
                          <span>{Number(pct).toFixed(0)}%</span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-neutral-100">
                          <div
                            className="h-full rounded-full bg-neutral-900"
                            style={{ width: `${Math.min(100, Number(pct))}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2 text-[10px] font-bold uppercase">
                    <span className="rounded-full bg-neutral-100 px-2 py-1">
                      Confidence: {p.confidence}
                    </span>
                    <span className="rounded-full bg-neutral-100 px-2 py-1">Data: {p.dataQuality}</span>
                  </div>

                  <p className="mt-4 text-sm leading-relaxed text-neutral-700">{p.analysis}</p>

                  {p.keyFactors?.length ? (
                    <ul className="mt-3 space-y-1 text-sm text-neutral-600">
                      {p.keyFactors.map((f, i) => (
                        <li key={i} className="flex gap-2">
                          <span className="text-amber-600">•</span>
                          <span>{f}</span>
                        </li>
                      ))}
                    </ul>
                  ) : null}

                  <p className="mt-4 text-xs leading-relaxed text-neutral-500">{p.uncertainty}</p>

                  {prediction?.disclaimer ? (
                    <p className="mt-4 border-t pt-3 text-[10px] leading-relaxed text-neutral-400">
                      {prediction.disclaimer}
                    </p>
                  ) : null}
                </>
              ) : (
                <p className="mt-4 text-sm text-neutral-500">
                  Select a match on the left to see probabilities and analysis.
                </p>
              )}
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}
