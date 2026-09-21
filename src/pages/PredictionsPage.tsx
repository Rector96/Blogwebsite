import React, { useEffect, useMemo, useState } from "react";
import { Helmet } from "react-helmet-async";

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
  const [affiliateUrl, setAffiliateUrl] = useState("");

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
          if (typeof d.affiliateUrl === "string") setAffiliateUrl(d.affiliateUrl);
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
      // Scroll outlook into view on mobile
      window.setTimeout(() => {
        document.getElementById("outlook-panel")?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 80);
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
    <main className="min-h-dvh bg-[#f4f4f2] pb-24 text-neutral-950">
      <Helmet>
        <title>Predictions | RWDNEWS Sports</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Helmet>

      <header className="sticky top-0 z-30 border-b border-neutral-800 bg-neutral-950/95 text-white backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-3 py-3 sm:px-6">
          <a href="/sport" className="font-display text-base font-bold sm:text-lg">
            RWDNEWS SPORTS
          </a>
          <a href="/sport" className="text-xs font-semibold text-neutral-300">
            ← Desk
          </a>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-3 py-5 sm:px-6 sm:py-8">
        <div className="rounded-2xl border border-amber-200 bg-gradient-to-br from-neutral-950 to-neutral-900 p-4 text-white shadow-lg sm:p-8">
          <p className="text-[10px] font-extrabold tracking-[0.2em] text-amber-400 uppercase">
            Match outlooks
          </p>
          <h1 className="font-display mt-1 text-2xl font-semibold sm:text-4xl">Predictions</h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-neutral-300">
            Free outlooks for entertainment. Not betting advice. 18+ where required.
          </p>
        </div>

        {error ? (
          <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
            {error}
          </div>
        ) : null}

        <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_min(380px,100%)]">
          <section>
            <h2 className="font-display text-lg font-semibold sm:text-xl">Choose a match</h2>
            <p className="mt-1 text-sm text-neutral-500">Tap a card — outlook opens below on mobile.</p>

            {loading ? (
              <p className="mt-6 text-sm text-neutral-500">Loading fixtures…</p>
            ) : matches.length ? (
              <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                {matches.slice(0, 48).map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => void runPrediction(m.id)}
                    className={`rounded-xl border p-3.5 text-left transition active:scale-[0.99] sm:p-4 ${
                      selectedId === m.id
                        ? "border-amber-500 bg-amber-50 shadow-md"
                        : "border-neutral-200 bg-white shadow-sm hover:border-neutral-400"
                    }`}
                  >
                    <p className="truncate text-[9px] font-bold tracking-wider text-teal-800 uppercase">
                      {m.league}
                    </p>
                    <p className="mt-2 font-display text-[15px] font-semibold leading-snug sm:text-base">
                      {m.home} vs {m.away}
                    </p>
                    <p className="mt-1 text-[11px] text-neutral-500">
                      {m.live ? (
                        <span className="font-bold text-red-600">LIVE</span>
                      ) : (
                        m.status
                      )}
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
                <a
                  href="/sport"
                  className="mt-4 inline-flex rounded-full bg-neutral-950 px-4 py-2 text-xs font-bold text-white"
                >
                  Open Sports desk →
                </a>
              </div>
            )}
          </section>

          <aside id="outlook-panel" className="lg:sticky lg:top-20 lg:self-start">
            <div className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-md sm:p-5">
              <p className="text-[10px] font-extrabold tracking-[0.16em] text-amber-700 uppercase">
                Outlook panel
              </p>

              {predicting ? (
                <p className="mt-4 text-sm text-neutral-500">Building outlook…</p>
              ) : p && selected ? (
                <>
                  <h3 className="font-display mt-2 text-lg font-semibold leading-snug sm:text-xl">
                    {p.headline}
                  </h3>
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
                          <span className="truncate pr-2">{name as string}</span>
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

                  {/* Affiliate zone — high attention under prediction */}
                  {affiliateUrl ? (
                    <div className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                      <p className="text-[10px] font-extrabold tracking-wider text-emerald-900 uppercase">
                        Compare odds
                      </p>
                      <p className="mt-1 text-xs text-neutral-600">
                        Optional partner link. 18+ · Gamble responsibly.
                      </p>
                      <a
                        href={affiliateUrl}
                        target="_blank"
                        rel="noopener noreferrer sponsored"
                        className="mt-3 flex w-full items-center justify-center rounded-xl bg-emerald-700 px-4 py-3 text-sm font-bold text-white"
                      >
                        See live odds →
                      </a>
                    </div>
                  ) : null}

                  {prediction?.disclaimer ? (
                    <p className="mt-4 border-t pt-3 text-[10px] leading-relaxed text-neutral-400">
                      {prediction.disclaimer}
                    </p>
                  ) : null}
                </>
              ) : (
                <p className="mt-4 text-sm text-neutral-500">
                  Select a match to see probabilities and analysis.
                </p>
              )}
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}
