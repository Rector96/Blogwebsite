import React, { useEffect, useMemo, useState } from "react";
import { Helmet } from "react-helmet-async";
import { AdSlot } from "../components/AdSlot";

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
  homeScore?: number | null;
  awayScore?: number | null;
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

export default function Match outlooksPage() {
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState("");
  const [prediction, setPrediction] = useState<{
    prediction?: Prediction;
    disclaimer?: string;
    match?: Match;
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
    () => matches.find((m) => m.id === selectedId) || prediction?.match || null,
    [matches, selectedId, prediction],
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
      window.setTimeout(() => {
        document.getElementById("prediction-panel")?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 60);
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
  const leanTeam =
    p && selected
      ? p.homeWin >= p.awayWin && p.homeWin >= p.draw
        ? selected.home
        : p.awayWin >= p.homeWin && p.awayWin >= p.draw
          ? selected.away
          : "Draw"
      : "";

  return (
    <main className="min-h-dvh bg-[#f4f4f2] pb-16 text-neutral-950">
      <Helmet>
        <title>
          {selected
            ? `${selected.home} vs ${selected.away} Outlook | RWDNEWS`
            : "Match Outlooks | RWDNEWS Sports"}
        </title>
        <meta
          name="description"
          content="AI match outlooks, win probabilities and cautious sports analysis on RWDNEWS. Not betting advice."
        />
      </Helmet>

      <header className="sticky top-0 z-30 border-b border-neutral-800 bg-neutral-950/95 text-white backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-3 py-3">
          <a href="/sport" className="text-sm font-bold">
            ← Sports desk
          </a>
          <span className="text-[10px] font-extrabold tracking-wider text-amber-400 uppercase">
            Predictions
          </span>
        </div>
      </header>

      <div className="mx-auto max-w-3xl px-3 py-5">
        {/* Section A — Match header when selected */}
        {selected ? (
          <section
            id="prediction-panel"
            className="overflow-hidden rounded-3xl bg-neutral-950 text-white shadow-xl"
          >
            <div className="bg-gradient-to-b from-teal-900/40 to-transparent px-4 pb-6 pt-5">
              <p className="text-center text-[10px] font-extrabold tracking-[0.16em] text-amber-400 uppercase">
                {selected.league}
              </p>
              <div className="mt-5 grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                <div className="text-center">
                  {selected.homeLogo ? (
                    <img
                      src={selected.homeLogo}
                      alt=""
                      className="mx-auto size-16 object-contain sm:size-20"
                      loading="lazy"
                    />
                  ) : (
                    <div className="mx-auto size-16 rounded-full bg-white/10 sm:size-20" />
                  )}
                  <h1 className="mt-2 text-sm font-bold sm:text-lg">{selected.home}</h1>
                </div>
                <div className="text-center">
                  <p className="text-xs text-neutral-400">vs</p>
                  {selected.live ? (
                    <span className="mt-1 inline-block rounded-full bg-red-600 px-2 py-0.5 text-[9px] font-black uppercase">
                      Live
                    </span>
                  ) : (
                    <p className="mt-1 text-[11px] text-neutral-400">{timeLabel(selected.startTime)}</p>
                  )}
                </div>
                <div className="text-center">
                  {selected.awayLogo ? (
                    <img
                      src={selected.awayLogo}
                      alt=""
                      className="mx-auto size-16 object-contain sm:size-20"
                      loading="lazy"
                    />
                  ) : (
                    <div className="mx-auto size-16 rounded-full bg-white/10 sm:size-20" />
                  )}
                  <h2 className="mt-2 text-sm font-bold sm:text-lg">{selected.away}</h2>
                </div>
              </div>
            </div>

            {/* Section B — AI dashboard */}
            <div className="border-t border-white/10 bg-white px-4 py-5 text-neutral-950">
              {predicting ? (
                <p className="text-sm text-neutral-500">Building match outlook…</p>
              ) : p ? (
                <>
                  <p className="text-[10px] font-extrabold tracking-[0.14em] text-amber-700 uppercase">
                    Model outlook
                  </p>
                  <h3 className="font-display mt-1 text-xl font-semibold leading-snug">{p.headline}</h3>

                  <div className="mt-5 space-y-3">
                    {[
                      [selected.home, p.homeWin, "bg-teal-700"],
                      ["Draw", p.draw, "bg-neutral-500"],
                      [selected.away, p.awayWin, "bg-amber-600"],
                    ].map(([name, pct, bar]) => (
                      <div key={String(name)}>
                        <div className="mb-1 flex justify-between text-xs font-bold">
                          <span className="truncate pr-2">{name as string}</span>
                          <span>{Number(pct).toFixed(0)}%</span>
                        </div>
                        <div className="h-2.5 overflow-hidden rounded-full bg-neutral-100">
                          <div
                            className={`h-full rounded-full ${bar as string}`}
                            style={{ width: `${Math.min(100, Number(pct))}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2 text-[10px] font-bold uppercase">
                    <span className="rounded-full bg-neutral-100 px-2.5 py-1">
                      Confidence: {p.confidence}
                    </span>
                    <span className="rounded-full bg-neutral-100 px-2.5 py-1">
                      Data: {p.dataQuality}
                    </span>
                  </div>

                  <p className="mt-4 text-sm leading-relaxed text-neutral-700">{p.analysis}</p>

                  {p.keyFactors?.length ? (
                    <ul className="mt-3 space-y-1.5 text-sm text-neutral-600">
                      {p.keyFactors.map((f, i) => (
                        <li key={i} className="flex gap-2">
                          <span className="text-amber-600">•</span>
                          <span>{f}</span>
                        </li>
                      ))}
                    </ul>
                  ) : null}

                  {/* Section C — Cash engine */}
                  <div className="mt-5">
                    <AdSlot
                      slot="prediction_rect"
                      variant="article"
                      label="Advertisement"
                      className="min-h-[100px]"
                    />
                  </div>

                  {affiliateUrl ? (
                    <a
                      href={affiliateUrl}
                      target="_blank"
                      rel="noopener noreferrer sponsored"
                      className="mt-4 flex w-full items-center justify-center rounded-2xl bg-emerald-700 px-4 py-3.5 text-sm font-extrabold text-white shadow-md active:scale-[0.99]"
                    >
                      {leanTeam && leanTeam !== "Draw"
                        ? `👉 Compare odds — lean ${leanTeam}`
                        : "👉 Compare live odds"}
                    </a>
                  ) : null}

                  <p className="mt-3 text-[10px] leading-relaxed text-neutral-400">
                    {p.uncertainty} {prediction?.disclaimer || "Not betting advice. 18+."}
                  </p>

                  {/* Verified-data status */}
                  <div className="mt-6 rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
                    <h4 className="text-xs font-extrabold tracking-wider text-neutral-800 uppercase">
                      Data & model notes
                    </h4>
                    <div className="mt-3 grid gap-2 sm:grid-cols-3">
                      <div className="rounded-xl bg-white p-3">
                        <p className="text-[10px] font-bold uppercase text-neutral-500">Home model</p>
                        <p className="mt-1 text-lg font-black">{p.homeWin}%</p>
                      </div>
                      <div className="rounded-xl bg-white p-3">
                        <p className="text-[10px] font-bold uppercase text-neutral-500">Draw model</p>
                        <p className="mt-1 text-lg font-black">{p.draw}%</p>
                      </div>
                      <div className="rounded-xl bg-white p-3">
                        <p className="text-[10px] font-bold uppercase text-neutral-500">Away model</p>
                        <p className="mt-1 text-lg font-black">{p.awayWin}%</p>
                      </div>
                    </div>
                    <p className="mt-3 text-[11px] leading-relaxed text-neutral-500">
                      {p.dataQuality} data quality. RWDNEWS does not display invented form, rankings or head-to-head results. New verified team information can change the outlook.
                    </p>
                  </div>
                </>
              ) : (
                <p className="text-sm text-neutral-500">Select a fixture below to load the outlook.</p>
              )}
            </div>
          </section>
        ) : (
          <div className="rounded-2xl border border-amber-200 bg-neutral-950 p-5 text-white">
            <p className="text-[10px] font-extrabold tracking-wider text-amber-400 uppercase">
              Match outlooks
            </p>
            <h1 className="font-display mt-1 text-2xl font-semibold">Predictions</h1>
            <p className="mt-2 text-sm text-neutral-300">
              Pick a fixture. The model runs only when you open a match — faster on mobile.
            </p>
          </div>
        )}

        {error ? (
          <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
            {error}
          </div>
        ) : null}

        {/* Fixture picker — lazy: prediction only on click */}
        <section className="mt-8">
          <h2 className="font-display text-lg font-semibold">Choose a match</h2>
          <p className="mt-1 text-sm text-neutral-500">Outlook loads on tap — we never batch-predict 100 games.</p>

          {loading ? (
            <p className="mt-4 text-sm text-neutral-500">Loading fixtures…</p>
          ) : matches.length ? (
            <div className="mt-3 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              {matches.slice(0, 40).map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => void runPrediction(m.id)}
                  className={`rounded-xl border p-3.5 text-left transition active:scale-[0.99] ${
                    selectedId === m.id
                      ? "border-amber-500 bg-amber-50 shadow-md"
                      : "border-neutral-200 bg-white shadow-sm"
                  }`}
                >
                  <p className="truncate text-[9px] font-bold tracking-wider text-teal-800 uppercase">
                    {m.league}
                  </p>
                  <p className="mt-1.5 text-[15px] font-semibold leading-snug">
                    {m.home} vs {m.away}
                  </p>
                  <p className="mt-1 text-[11px] text-neutral-500">
                    {m.live ? <span className="font-bold text-red-600">LIVE</span> : m.status}
                    {m.startTime ? ` · ${timeLabel(m.startTime)}` : ""}
                  </p>
                </button>
              ))}
            </div>
          ) : (
            <div className="mt-4 rounded-xl border border-dashed bg-white p-6 text-center text-sm">
              No fixtures right now.{" "}
              <a href="/sport" className="font-bold text-teal-800">
                Back to Sports
              </a>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
