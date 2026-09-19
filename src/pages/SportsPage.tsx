import React, { useEffect, useMemo, useState } from "react";

type Match = {
  id: string;
  sport: string;
  league: string;
  home: string;
  away: string;
  homeScore?: number | null;
  awayScore?: number | null;
  status: string;
  live: boolean;
  startTime?: string;
  homeLogo?: string;
  awayLogo?: string;
};

type Story = {
  id: string;
  original_url: string;
  image: string;
  timestamp: string;
  source: string;
  original_title: string;
  original_description: string;
  ai_hook_title: string;
  ai_summary: string[];
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

export default function SportsPage() {
  const [data, setData] = useState<{
    live: Match[];
    featured: Match[];
    upcoming: Match[];
    news: Story[];
    rumors: Story[];
    majorLeagues: { name: string; available: boolean }[];
    counts?: { matches: number; live: number; news: number };
  }>({
    live: [],
    featured: [],
    upcoming: [],
    news: [],
    rumors: [],
    majorLeagues: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sport, setSport] = useState("all");
  const [storyTab, setStoryTab] = useState<"news" | "rumors">("news");

  const load = async () => {
    try {
      setError(null);
      const r = await fetch("/api/sports", { headers: { Accept: "application/json" } });
      if (!r.ok) throw new Error("Sports feed unavailable");
      const d = await r.json();
      if (d.error && !d.news?.length && !d.featured?.length) throw new Error(d.error);
      setData({
        live: Array.isArray(d.live) ? d.live : [],
        featured: Array.isArray(d.featured) ? d.featured : [],
        upcoming: Array.isArray(d.upcoming) ? d.upcoming : [],
        news: Array.isArray(d.news) ? d.news : [],
        rumors: Array.isArray(d.rumors) ? d.rumors : [],
        majorLeagues: Array.isArray(d.majorLeagues) ? d.majorLeagues : [],
        counts: d.counts,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load sports");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    const t = window.setInterval(() => void load(), 45000);
    return () => window.clearInterval(t);
  }, []);

  const cards = useMemo(() => {
    const source = [...data.live, ...data.featured, ...data.upcoming].filter(
      (m, i, arr) => arr.findIndex((x) => x.id === m.id) === i,
    );
    return source.filter((m) => sport === "all" || m.sport === sport).slice(0, 48);
  }, [data, sport]);

  const stories = storyTab === "rumors" ? data.rumors : data.news;

  return (
    <main className="min-h-dvh bg-[#f4f4f2] text-neutral-950">
      {/* Top bar */}
      <header className="border-b border-neutral-800 bg-neutral-950 text-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-4 sm:px-6">
          <a href="/" className="font-display text-lg font-bold tracking-tight sm:text-xl">
            RWDNEWS
          </a>
          <nav className="flex items-center gap-2 sm:gap-3">
            <a
              href="/sports/predictions"
              className="rounded-full bg-amber-500 px-3 py-1.5 text-[11px] font-extrabold text-neutral-950 sm:px-4 sm:text-xs"
            >
              AI Predictions
            </a>
            <a href="/" className="text-[11px] font-semibold text-neutral-300 sm:text-xs">
              News home
            </a>
          </nav>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
        {/* Hero */}
        <div className="rounded-2xl border border-neutral-200 bg-neutral-950 p-5 text-white shadow-lg sm:p-8">
          <p className="text-[10px] font-extrabold tracking-[0.2em] text-amber-400 uppercase">
            Sports desk
          </p>
          <h1 className="font-display mt-1 text-3xl font-semibold sm:text-4xl">
            Scores, news & predictions
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-neutral-300">
            Live boards from major leagues, sports headlines, and one-tap match
            outlooks. Built for fans who want speed and clarity.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <a
              href="/sports/predictions"
              className="inline-flex h-11 items-center rounded-full bg-amber-500 px-5 text-sm font-extrabold text-neutral-950"
            >
              Open AI Predictions →
            </a>
            <button
              type="button"
              onClick={() => void load()}
              className="inline-flex h-11 items-center rounded-full border border-neutral-600 px-5 text-sm font-semibold text-white"
            >
              Refresh scores
            </button>
          </div>
          {data.counts ? (
            <p className="mt-4 text-[11px] text-neutral-400">
              {data.counts.matches} fixtures · {data.counts.live} live · {data.counts.news} sports
              stories
            </p>
          ) : null}
        </div>

        {/* Sport filters */}
        <div className="mt-6 flex flex-wrap gap-2">
          {[
            ["all", "All"],
            ["football", "Football"],
            ["basketball", "Basketball"],
            ["tennis", "Tennis"],
            ["baseball", "Baseball"],
            ["hockey", "Hockey"],
          ].map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setSport(id)}
              className={
                sport === id
                  ? "rounded-full bg-neutral-950 px-3 py-1.5 text-xs font-bold text-white"
                  : "rounded-full border border-neutral-200 bg-white px-3 py-1.5 text-xs font-semibold text-neutral-700"
              }
            >
              {label}
            </button>
          ))}
        </div>

        {error ? (
          <div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
            {error}. Tap refresh after the next deploy if this persists.
          </div>
        ) : null}

        {/* Scores */}
        <section className="mt-8">
          <div className="flex items-end justify-between border-b border-neutral-900 pb-2">
            <div>
              <p className="text-[10px] font-extrabold tracking-[0.16em] text-red-700 uppercase">
                Live & fixtures
              </p>
              <h2 className="font-display text-2xl font-semibold">Match centre</h2>
            </div>
            <a href="/sports/predictions" className="text-xs font-bold text-amber-700">
              Predict a match →
            </a>
          </div>

          {loading ? (
            <p className="mt-6 text-sm text-neutral-500">Loading scores…</p>
          ) : cards.length ? (
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {cards.map((m) => (
                <article
                  key={m.id}
                  className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm"
                >
                  <div className="flex items-center justify-between gap-2 text-[9px] font-bold uppercase">
                    <span className="truncate text-teal-800">{m.league}</span>
                    <span className={m.live ? "text-red-600" : "text-neutral-400"}>
                      {m.live ? "● LIVE" : m.status}
                    </span>
                  </div>
                  <div className="mt-4 space-y-3 text-sm">
                    <div className="flex items-center justify-between gap-3">
                      <span className="flex min-w-0 items-center gap-2 truncate font-medium">
                        {m.homeLogo ? (
                          <img src={m.homeLogo} alt="" className="size-5 object-contain" />
                        ) : null}
                        {m.home}
                      </span>
                      <strong className="tabular-nums">{m.homeScore ?? "–"}</strong>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span className="flex min-w-0 items-center gap-2 truncate font-medium">
                        {m.awayLogo ? (
                          <img src={m.awayLogo} alt="" className="size-5 object-contain" />
                        ) : null}
                        {m.away}
                      </span>
                      <strong className="tabular-nums">{m.awayScore ?? "–"}</strong>
                    </div>
                  </div>
                  {m.startTime ? (
                    <p className="mt-3 text-[10px] text-neutral-400">{timeLabel(m.startTime)}</p>
                  ) : null}
                  <a
                    href={`/sports/predictions?id=${encodeURIComponent(m.id)}`}
                    className="mt-3 inline-flex text-xs font-extrabold text-amber-700"
                  >
                    Match outlook / predict →
                  </a>
                </article>
              ))}
            </div>
          ) : (
            <div className="mt-4 rounded-xl border border-dashed border-neutral-300 bg-white p-8 text-center">
              <p className="font-display text-lg font-semibold">No fixtures on this filter right now</p>
              <p className="mt-1 text-sm text-neutral-500">Try All sports or check back later.</p>
            </div>
          )}
        </section>

        {/* News */}
        <section className="mt-12">
          <div className="flex flex-wrap items-end justify-between gap-3 border-b border-neutral-900 pb-2">
            <div>
              <p className="text-[10px] font-extrabold tracking-[0.16em] text-teal-800 uppercase">
                Sports journalism
              </p>
              <h2 className="font-display text-2xl font-semibold">News & transfers</h2>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setStoryTab("news")}
                className={
                  storyTab === "news"
                    ? "rounded-full bg-neutral-950 px-3 py-1.5 text-xs font-bold text-white"
                    : "rounded-full border bg-white px-3 py-1.5 text-xs font-semibold"
                }
              >
                Latest
              </button>
              <button
                type="button"
                onClick={() => setStoryTab("rumors")}
                className={
                  storyTab === "rumors"
                    ? "rounded-full bg-neutral-950 px-3 py-1.5 text-xs font-bold text-white"
                    : "rounded-full border bg-white px-3 py-1.5 text-xs font-semibold"
                }
              >
                Transfers
              </button>
            </div>
          </div>

          {stories.length ? (
            <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {stories.map((story) => (
                <article
                  key={story.id}
                  className="overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-sm"
                >
                  {story.image ? (
                    <img
                      src={story.image}
                      alt=""
                      className="aspect-[16/10] w-full object-cover bg-neutral-100"
                    />
                  ) : (
                    <div className="flex aspect-[16/10] items-center justify-center bg-neutral-100 text-xs text-neutral-400">
                      Sports
                    </div>
                  )}
                  <div className="p-4">
                    <div className="flex justify-between gap-2 text-[9px] font-bold uppercase text-neutral-500">
                      <span>{story.source}</span>
                      <span>{new Date(story.timestamp).toLocaleDateString()}</span>
                    </div>
                    <h3 className="font-display mt-2 text-lg font-semibold leading-snug">
                      {story.ai_hook_title || story.original_title}
                    </h3>
                    <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-neutral-600">
                      {story.ai_summary?.[0] || story.original_description}
                    </p>
                    <a
                      href={story.original_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-3 inline-block text-xs font-extrabold text-teal-800"
                    >
                      Read source report →
                    </a>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="mt-5 rounded-xl border border-dashed bg-white p-8 text-center text-sm text-neutral-500">
              No sports stories in this section yet. Refresh after the live wire updates.
            </div>
          )}
        </section>

        {/* Leagues */}
        <section className="mt-12">
          <h2 className="font-display text-xl font-semibold">Leagues covered</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {data.majorLeagues.map((x) => (
              <span
                key={x.name}
                className={
                  x.available
                    ? "rounded-full border border-teal-200 bg-teal-50 px-3 py-1.5 text-xs font-semibold text-teal-900"
                    : "rounded-full border bg-white px-3 py-1.5 text-xs font-semibold text-neutral-400"
                }
              >
                {x.name}
                {x.available ? " · live" : ""}
              </span>
            ))}
          </div>
        </section>

        <p className="mt-10 text-[10px] leading-relaxed text-neutral-500">
          Scores via ESPN public boards. Predictions are informational commentary only — not betting
          advice. RWDNEWS does not invent injuries, odds or confirmed transfers.
        </p>
      </div>
    </main>
  );
}
