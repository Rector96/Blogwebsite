import React, { useEffect, useState } from "react";

type Match = {
  id: string;
  sport: string;
  league: string;
  home: string;
  away: string;
  status: string;
  startTime?: string;
  live: boolean;
  source?: string;
};

type Prediction = {
  headline: string;
  mostLikelyOutcome: string;
  homeWin: number;
  draw: number;
  awayWin: number;
  confidence: "Low" | "Moderate" | "High";
  dataQuality: "Limited" | "Usable" | "Strong";
  analysis: string;
  keyFactors: string[];
  uncertainty: string;
  updateTrigger: string;
};

function timeLabel(iso?: string) {
  if (!iso) return "Time TBC";
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? "Time TBC"
    : d.toLocaleString(undefined, { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

export default function SportsPredictionsPage() {
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Match | null>(null);
  const [prediction, setPrediction] = useState<Prediction | null>(null);
  const [predictionLoading, setPredictionLoading] = useState(false);
  const [aiConfigured, setAiConfigured] = useState(false);
  const [error, setError] = useState("");

  const load = async () => {
    try {
      const r = await fetch("/api/sports-prediction", { headers: { Accept: "application/json" } });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Prediction feed unavailable");
      setMatches(Array.isArray(d.matches) ? d.matches : []);
      setAiConfigured(Boolean(d.aiConfigured));
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Prediction feed unavailable");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    const t = window.setInterval(() => void load(), 60000);
    return () => window.clearInterval(t);
  }, []);

  const analyze = async (match: Match) => {
    setSelected(match);
    setPrediction(null);
    setPredictionLoading(true);
    setError("");
    try {
      const r = await fetch("/api/sports-prediction?id=" + encodeURIComponent(match.id), {
        headers: { Accept: "application/json" },
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || d.message || "AI prediction unavailable");
      if (!d.configured) {
        setError(d.message || "OpenAI prediction engine is not configured yet.");
        return;
      }
      setPrediction(d.prediction || null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "AI prediction unavailable");
    } finally {
      setPredictionLoading(false);
    }
  };

  return (
    <main className="min-h-dvh bg-neutral-50 text-neutral-950">
      <header className="border-b bg-neutral-950 text-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-5 sm:px-6">
          <a href="/sports" className="font-display text-xl font-bold">RWDNEWS Sports</a>
          <a href="/" className="text-xs font-semibold text-neutral-300">← News</a>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <p className="text-[10px] font-extrabold tracking-[0.2em] text-teal-800 uppercase">RWDNEWS AI</p>
        <h1 className="font-display mt-1 text-3xl font-semibold sm:text-5xl">Sports Predictions</h1>
        <p className="mt-3 max-w-3xl text-sm leading-relaxed text-neutral-600">
          Transparent, source-data-driven match commentary. OpenAI handles the reasoning layer; RWDNEWS supplies the verified sports data and publishes the result with uncertainty clearly shown.
        </p>

        <div className="mt-5 border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
          <strong>Important:</strong> RWDNEWS will not promise 90% accuracy or present predictions as guaranteed results. We will track predictions against actual results so users can see the real performance over time.
        </div>

        {!aiConfigured ? (
          <div className="mt-5 border border-neutral-200 bg-white p-5">
            <p className="text-sm font-bold">OpenAI engine is waiting for an API key.</p>
            <p className="mt-1 text-sm text-neutral-600">
              The page and sports data are already live-ready. When an OpenAI API key with available API credit is added to the server environment, AI predictions can run without exposing the key to visitors.
            </p>
          </div>
        ) : null}

        {error ? <div className="mt-5 border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</div> : null}

        <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_420px]">
          <section>
            <div className="flex items-end justify-between border-b border-neutral-900 pb-2">
              <div>
                <p className="text-[10px] font-extrabold tracking-[0.18em] text-teal-800 uppercase">Upcoming board</p>
                <h2 className="font-display text-2xl font-semibold">Choose a match</h2>
              </div>
              <span className="text-[10px] text-neutral-500">{matches.length} matches</span>
            </div>

            {loading ? (
              <p className="mt-6 text-sm text-neutral-500">Loading verified fixtures…</p>
            ) : matches.length ? (
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {matches.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => void analyze(m)}
                    className={`border bg-white p-4 text-left transition hover:border-neutral-900 ${selected?.id === m.id ? "border-neutral-950 shadow-sm" : "border-neutral-200"}`}
                  >
                    <div className="flex items-center justify-between gap-2 text-[9px] font-bold uppercase">
                      <span className="truncate text-teal-800">{m.league}</span>
                      <span className="text-neutral-400">{m.sport}</span>
                    </div>
                    <div className="mt-4 space-y-2 text-sm">
                      <div className="flex justify-between gap-3"><span>{m.home}</span><strong>vs</strong></div>
                      <div className="flex justify-between gap-3"><span>{m.away}</span><strong>•</strong></div>
                    </div>
                    <p className="mt-3 text-[10px] text-neutral-400">{timeLabel(m.startTime)}</p>
                  </button>
                ))}
              </div>
            ) : (
              <div className="mt-5 border border-dashed bg-white p-8 text-center text-sm text-neutral-500">
                No verified upcoming matches are available right now.
              </div>
            )}
          </section>

          <aside className="lg:sticky lg:top-5 lg:self-start">
            <div className="border border-neutral-200 bg-white p-5">
              {!selected ? (
                <div className="py-8 text-center">
                  <p className="font-display text-xl font-semibold">AI Match Analysis</p>
                  <p className="mt-2 text-sm text-neutral-500">Select a fixture to generate the RWDNEWS prediction.</p>
                </div>
              ) : predictionLoading ? (
                <div className="py-8 text-center">
                  <p className="font-display text-xl font-semibold">OpenAI is analyzing…</p>
                  <p className="mt-2 text-sm text-neutral-500">Using only the verified match record supplied to RWDNEWS.</p>
                </div>
              ) : prediction ? (
                <div>
                  <p className="text-[10px] font-extrabold tracking-[0.18em] text-teal-800 uppercase">RWDNEWS AI prediction</p>
                  <h2 className="font-display mt-1 text-2xl font-semibold">{prediction.headline}</h2>
                  <div className="mt-4 border bg-neutral-50 p-4">
                    <p className="text-[10px] font-bold uppercase text-neutral-500">Most likely outcome</p>
                    <p className="mt-1 text-lg font-bold">{prediction.mostLikelyOutcome}</p>
                    <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs">
                      <div className="border bg-white p-3"><strong className="block text-lg">{prediction.homeWin}%</strong><span>Home</span></div>
                      <div className="border bg-white p-3"><strong className="block text-lg">{prediction.draw}%</strong><span>Draw</span></div>
                      <div className="border bg-white p-3"><strong className="block text-lg">{prediction.awayWin}%</strong><span>Away</span></div>
                    </div>
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
                    <div className="border p-3"><span className="block text-neutral-400">Confidence</span><strong>{prediction.confidence}</strong></div>
                    <div className="border p-3"><span className="block text-neutral-400">Data quality</span><strong>{prediction.dataQuality}</strong></div>
                  </div>
                  <div className="mt-5">
                    <h3 className="font-display text-lg font-semibold">AI commentary</h3>
                    <p className="mt-2 text-sm leading-7 text-neutral-700">{prediction.analysis}</p>
                  </div>
                  <div className="mt-5">
                    <h3 className="font-display text-lg font-semibold">Key factors</h3>
                    <ul className="mt-2 list-disc space-y-2 pl-5 text-sm leading-6 text-neutral-700">
                      {prediction.keyFactors.map((x, i) => <li key={i}>{x}</li>)}
                    </ul>
                  </div>
                  <div className="mt-5 border-t pt-4 text-xs leading-6 text-neutral-500">
                    <strong>Uncertainty:</strong> {prediction.uncertainty}<br />
                    <strong>Update trigger:</strong> {prediction.updateTrigger}
                  </div>
                </div>
              ) : (
                <div className="py-8 text-center text-sm text-neutral-500">No prediction was generated.</div>
              )}
            </div>
          </aside>
        </div>

        <section className="mt-8 border border-neutral-200 bg-neutral-950 p-5 text-white sm:p-6">
          <p className="text-[10px] font-extrabold tracking-[0.18em] text-amber-400 uppercase">RWDNEWS methodology</p>
          <h2 className="font-display mt-1 text-2xl font-semibold">Facts first. Commentary second.</h2>
          <p className="mt-2 max-w-4xl text-sm leading-7 text-neutral-300">
            RWDNEWS provides the verified fixture and score data. OpenAI produces original commentary from that data. The model is instructed to disclose missing information rather than fill gaps with guesses. Prediction accuracy will be measured against real results instead of being promised in advance.
          </p>
          <p className="mt-4 text-xs leading-6 text-neutral-400">
            Disclaimer: RWDNEWS predictions are AI-assisted statistical commentary based on available verified sports data. They are not guarantees of match results and are not betting, financial or gambling advice. Sports outcomes are inherently uncertain.
          </p>
        </section>
      </div>
    </main>
  );
}
