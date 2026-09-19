import React, { useEffect, useMemo, useState } from "react";
import { Helmet } from "react-helmet-async";
import { ArticleReader } from "../components/ArticleReader";

type Match = {
  id: string;
  sport: string;
  sportLabel?: string;
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
  venue?: string;
  completed?: boolean;
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

const sports = [
  ["all", "All sports", "🏆"],
  ["football", "Football", "⚽"],
  ["basketball", "Basketball", "🏀"],
  ["tennis", "Tennis", "🎾"],
  ["baseball", "Baseball", "⚾"],
  ["hockey", "Hockey", "🏒"],
];

function timeLabel(iso?: string) {
  if (!iso) return "Time TBA";
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? "Time TBA"
    : d.toLocaleString(undefined, {
        weekday: "short",
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      });
}

function matchPath(id: string) {
  return `/sport/match/${encodeURIComponent(id)}`;
}

function scoreText(m: Match) {
  return m.homeScore == null && m.awayScore == null ? "—" : `${m.homeScore ?? 0} - ${m.awayScore ?? 0}`;
}

function MatchCard({ match }: { match: Match }) {
  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
      <a href={matchPath(match.id)} className="block">
        <div className="flex items-center justify-between gap-2 text-[10px] font-bold tracking-wide uppercase">
          <span className="truncate text-teal-800">{match.league}</span>
          <span className={match.live ? "text-red-600" : "text-neutral-400"}>
            {match.live ? "● LIVE" : match.status}
          </span>
        </div>
        <div className="mt-4 grid grid-cols-[1fr_auto] items-center gap-3">
          <div className="space-y-3 text-sm font-semibold">
            <div className="flex items-center gap-2 truncate">
              {match.homeLogo ? (
                <img src={match.homeLogo} alt="" className="size-6 object-contain" />
              ) : (
                <span className="size-6 rounded-full bg-neutral-100" />
              )}
              <span className="truncate">{match.home}</span>
            </div>
            <div className="flex items-center gap-2 truncate">
              {match.awayLogo ? (
                <img src={match.awayLogo} alt="" className="size-6 object-contain" />
              ) : (
                <span className="size-6 rounded-full bg-neutral-100" />
              )}
              <span className="truncate">{match.away}</span>
            </div>
          </div>
          <div className="text-right font-display text-lg font-bold tabular-nums">
            <div>{match.homeScore ?? "—"}</div>
            <div>{match.awayScore ?? "—"}</div>
          </div>
        </div>
        <p className="mt-4 text-[10px] text-neutral-400">{timeLabel(match.startTime)}</p>
        <p className="mt-2 text-xs font-extrabold text-teal-800">Match centre →</p>
      </a>
      <a
        href={`/sport/predictions?id=${encodeURIComponent(match.id)}`}
        className="mt-2 inline-block text-xs font-extrabold text-amber-700"
      >
        Predict →
      </a>
    </div>
  );
}

export default function SportsPage() {
  const path = typeof window !== "undefined" ? window.location.pathname : "/sport";
  const matchId = path.startsWith("/sport/match/")
    ? decodeURIComponent(path.slice("/sport/match/".length))
    : "";
  const mode =
    path === "/sport/live"
      ? "live"
      : path === "/sport/results"
        ? "results"
        : path === "/sport/fixtures"
          ? "fixtures"
          : "home";

  const [data, setData] = useState<{
    live: Match[];
    featured: Match[];
    upcoming: Match[];
    results: Match[];
    news: Story[];
    rumors: Story[];
    majorLeagues: { name: string; available: boolean }[];
    bySport: Record<string, Match[]>;
    counts?: {
      matches: number;
      live: number;
      results: number;
      upcoming: number;
      news: number;
      rumors: number;
    };
  }>({
    live: [],
    featured: [],
    upcoming: [],
    results: [],
    news: [],
    rumors: [],
    majorLeagues: [],
    bySport: {},
  });
  const [selectedSport, setSelectedSport] = useState("all");
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState<any>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [storyTab, setStoryTab] = useState<"news" | "rumors">("news");
  const [activeStory, setActiveStory] = useState<Story | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const [sportsResponse, newsResponse] = await Promise.all([
        fetch("/api/sports", { headers: { Accept: "application/json" } }),
        fetch("/api/news", { headers: { Accept: "application/json" } }),
      ]);
      if (!sportsResponse.ok) throw new Error("Sports feed unavailable");
      const sportsData = await sportsResponse.json();
      let externalNews: Story[] = [];
      if (newsResponse.ok) {
        const newsData = await newsResponse.json();
        externalNews = Array.isArray(newsData?.articles)
          ? newsData.articles.filter((a: Story) =>
              /sports|football|soccer|premier league|champions league|uefa|fifa|nba|nfl|mlb|nhl|tennis|cricket|basketball|baseball|hockey|rugby|boxing|athletics|formula 1|transfer|arsenal|chelsea|liverpool|manchester|barcelona|madrid/i.test(
                `${a.original_title} ${a.original_description} ${a.ai_hook_title}`,
              ),
            )
          : [];
      }
      const combined = [...(Array.isArray(sportsData?.news) ? sportsData.news : []), ...externalNews];
      const seen = new Set<string>();
      const news = combined
        .filter((a: Story) => {
          const key = a.original_url || a.id;
          if (!key || seen.has(key)) return false;
          seen.add(key);
          return true;
        })
        .sort((a: Story, b: Story) => Date.parse(b.timestamp) - Date.parse(a.timestamp))
        .slice(0, 120);
      setData({
        live: Array.isArray(sportsData.live) ? sportsData.live : [],
        featured: Array.isArray(sportsData.featured) ? sportsData.featured : [],
        upcoming: Array.isArray(sportsData.upcoming) ? sportsData.upcoming : [],
        results: Array.isArray(sportsData.results) ? sportsData.results : [],
        news,
        rumors: news.filter((a) =>
          /transfer|rumou?r|linked|bid|offer|talks|negotiat|target|loan|interest|set to join/i.test(
            `${a.original_title} ${a.original_description} ${a.ai_hook_title}`,
          ),
        ),
        majorLeagues: Array.isArray(sportsData.majorLeagues) ? sportsData.majorLeagues : [],
        bySport: sportsData.bySport || {},
        counts: sportsData.counts,
      });
    } finally {
      setLoading(false);
    }
  };

  const loadDetail = async () => {
    if (!matchId) return;
    setDetailLoading(true);
    try {
      const r = await fetch(`/api/sports?action=match&id=${encodeURIComponent(matchId)}`);
      if (!r.ok) throw new Error("Match unavailable");
      setDetail(await r.json());
    } catch {
      setDetail(null);
    } finally {
      setDetailLoading(false);
    }
  };

  useEffect(() => {
    void load();
    const t = window.setInterval(() => void load(), 30000);
    return () => window.clearInterval(t);
  }, []);
  useEffect(() => {
    if (matchId) void loadDetail();
  }, [matchId]);

  const filtered = useMemo(() => {
    let source: Match[];
    if (mode === "live") source = data.live;
    else if (mode === "results") source = data.results.length ? data.results : data.featured;
    else if (mode === "fixtures") source = data.upcoming;
    else source = [...data.live, ...data.featured, ...data.upcoming, ...data.results];
    const unique = source.filter((m, i, arr) => arr.findIndex((x) => x.id === m.id) === i);
    return unique.filter((m) => selectedSport === "all" || m.sport === selectedSport).slice(0, 100);
  }, [data, mode, selectedSport]);

  if (matchId) {
    const m = detail?.match as Match | undefined;
    return (
      <main className="min-h-dvh bg-[#f4f4f2] text-neutral-950">
        <Helmet>
          <title>{m ? `${m.home} vs ${m.away} | RWDNEWS Sports` : "Match Centre | RWDNEWS Sports"}</title>
        </Helmet>
        <header className="border-b border-neutral-800 bg-neutral-950 text-white">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
            <a href="/sport" className="font-display font-bold">
              RWDNEWS SPORTS
            </a>
            <a href="/" className="text-xs text-neutral-300">
              News home
            </a>
          </div>
        </header>
        <div className="mx-auto max-w-5xl px-4 py-6 sm:py-10">
          <a href="/sport" className="text-xs font-bold text-teal-800">
            ← Back to Sports
          </a>
          {detailLoading ? (
            <div className="mt-6 rounded-2xl bg-white p-8">Loading match centre…</div>
          ) : m ? (
            <section className="mt-5 rounded-3xl bg-neutral-950 p-6 text-white shadow-xl sm:p-10">
              <p className="text-[10px] font-extrabold tracking-[0.18em] text-amber-400 uppercase">
                {m.league} · {m.sportLabel || m.sport}
              </p>
              <div className="mt-8 grid grid-cols-[1fr_auto_1fr] items-center gap-3">
                <div className="text-center">
                  {m.homeLogo ? <img src={m.homeLogo} alt="" className="mx-auto size-16 object-contain" /> : null}
                  <h1 className="font-display mt-3 text-lg font-bold sm:text-2xl">{m.home}</h1>
                </div>
                <div className="text-center">
                  <div className="font-display text-3xl font-black sm:text-5xl">{scoreText(m)}</div>
                  <p className={m.live ? "mt-2 text-xs font-bold text-red-400" : "mt-2 text-xs text-neutral-400"}>
                    {m.live ? "LIVE" : m.status}
                  </p>
                </div>
                <div className="text-center">
                  {m.awayLogo ? <img src={m.awayLogo} alt="" className="mx-auto size-16 object-contain" /> : null}
                  <h2 className="font-display mt-3 text-lg font-bold sm:text-2xl">{m.away}</h2>
                </div>
              </div>
              <p className="mt-6 text-center text-xs text-neutral-400">
                {timeLabel(m.startTime)}
                {m.venue ? ` · ${m.venue}` : ""}
              </p>
              <div className="mt-6 flex justify-center">
                <a
                  href={`/sport/predictions?id=${encodeURIComponent(m.id)}`}
                  className="rounded-full bg-amber-400 px-5 py-2 text-xs font-extrabold text-neutral-950"
                >
                  Open prediction outlook →
                </a>
              </div>
            </section>
          ) : (
            <div className="mt-6 rounded-2xl border bg-white p-8 text-center">
              This match is no longer in the live feed. Return to Sports for the latest fixtures.
            </div>
          )}
        </div>
      </main>
    );
  }

  const sportStoryRe: Record<string, RegExp> = {
    football: /football|soccer|premier league|champions league|uefa|fifa|transfer|arsenal|chelsea|liverpool|manchester|barcelona|real madrid|nfl/i,
    basketball: /basketball|nba|wnba/i,
    tennis: /tennis|atp|wta/i,
    baseball: /baseball|mlb/i,
    hockey: /hockey|nhl/i,
  };
  const storyPool = storyTab === "rumors" ? data.rumors : data.news;
  const stories = storyPool
    .filter(
      (s) =>
        selectedSport === "all" ||
        sportStoryRe[selectedSport]?.test(
          `${s.original_title} ${s.original_description} ${s.ai_hook_title}`,
        ),
    )
    .slice(0, 36);

  const title =
    mode === "live"
      ? "Live Scores"
      : mode === "fixtures"
        ? "Fixtures"
        : mode === "results"
          ? "Results"
          : "Sports";

  return (
    <main className="min-h-dvh bg-[#f4f4f2] text-neutral-950">
      <Helmet>
        <title>{title} | RWDNEWS</title>
        <meta
          name="description"
          content="Live scores, fixtures, results, sports news and match predictions on RWDNEWS."
        />
      </Helmet>

      <header className="border-b border-neutral-800 bg-neutral-950 text-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-4 sm:px-6">
          <a href="/sport" className="font-display text-lg font-black tracking-tight">
            RWDNEWS SPORTS
          </a>
          <a href="/" className="text-xs font-semibold text-neutral-300">
            News home
          </a>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
        <section className="rounded-3xl bg-neutral-950 p-6 text-white shadow-lg sm:p-9">
          <p className="text-[10px] font-black tracking-[0.2em] text-amber-400 uppercase">
            RWDNEWS Sports Centre
          </p>
          <h1 className="font-display mt-2 text-3xl font-black sm:text-5xl">{title}</h1>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-neutral-300">
            Scores, fixtures, results and sports news in one place. Open any story to read the full
            briefing without leaving RWDNEWS.
          </p>
          {data.counts ? (
            <p className="mt-4 text-[11px] text-neutral-400">
              {data.counts.matches} fixtures · {data.counts.live} live · {data.counts.results} results ·{" "}
              {data.counts.news} sports stories
            </p>
          ) : null}
          <div className="mt-6 flex flex-wrap gap-2">
            {[
              ["/sport", "Sports"],
              ["/sport/live", "Live"],
              ["/sport/fixtures", "Fixtures"],
              ["/sport/results", "Results"],
              ["/sport/predictions", "Predictions"],
            ].map(([href, label]) => (
              <a
                key={href}
                href={href}
                className={
                  path === href
                    ? "rounded-full bg-amber-400 px-4 py-2 text-xs font-black text-neutral-950"
                    : "rounded-full border border-neutral-700 px-4 py-2 text-xs font-bold text-white"
                }
              >
                {label}
              </a>
            ))}
          </div>
        </section>

        <section className="mt-6">
          <div className="flex gap-2 overflow-x-auto pb-1">
            {sports.map(([id, label, icon]) => (
              <button
                key={id}
                type="button"
                onClick={() => setSelectedSport(id)}
                className={
                  selectedSport === id
                    ? "shrink-0 rounded-full bg-neutral-950 px-4 py-2 text-xs font-bold text-white"
                    : "shrink-0 rounded-full border bg-white px-4 py-2 text-xs font-bold text-neutral-700"
                }
              >
                {icon} {label}
              </button>
            ))}
          </div>
        </section>

        <section className="mt-8">
          <div className="flex items-end justify-between border-b border-neutral-900 pb-3">
            <div>
              <p className="text-[10px] font-black tracking-[0.16em] text-red-700 uppercase">
                Match centre
              </p>
              <h2 className="font-display text-2xl font-black">
                {mode === "live"
                  ? "Live now"
                  : mode === "results"
                    ? "Latest results"
                    : mode === "fixtures"
                      ? "Upcoming fixtures"
                      : "Matches"}
              </h2>
            </div>
            <span className="text-xs text-neutral-500">{filtered.length} shown</span>
          </div>
          {loading ? (
            <div className="py-10 text-sm text-neutral-500">Loading live sports data…</div>
          ) : filtered.length ? (
            <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {filtered.map((m) => (
                <MatchCard key={m.id} match={m} />
              ))}
            </div>
          ) : (
            <div className="mt-5 rounded-2xl border border-dashed bg-white p-10 text-center text-sm text-neutral-500">
              No matches for this filter right now. Sports news below is still updating from the live
              wire.
            </div>
          )}
        </section>

        <section className="mt-12">
          <div className="flex flex-wrap items-end justify-between gap-3 border-b border-neutral-900 pb-3">
            <div>
              <p className="text-[10px] font-black tracking-[0.16em] text-teal-800 uppercase">
                Sports desk
              </p>
              <h2 className="font-display text-2xl font-black">Latest sports news</h2>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setStoryTab("news")}
                className={
                  storyTab === "news"
                    ? "rounded-full bg-neutral-950 px-3 py-2 text-xs font-bold text-white"
                    : "rounded-full border bg-white px-3 py-2 text-xs font-bold"
                }
              >
                Latest
              </button>
              <button
                type="button"
                onClick={() => setStoryTab("rumors")}
                className={
                  storyTab === "rumors"
                    ? "rounded-full bg-neutral-950 px-3 py-2 text-xs font-bold text-white"
                    : "rounded-full border bg-white px-3 py-2 text-xs font-bold"
                }
              >
                Transfers
              </button>
            </div>
          </div>
          {stories.length ? (
            <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {stories.map((s) => (
                <article
                  key={s.id}
                  className="cursor-pointer overflow-hidden rounded-2xl border bg-white shadow-sm transition hover:shadow-md"
                  onClick={() => setActiveStory(s)}
                >
                  {s.image ? (
                    <img src={s.image} alt="" className="aspect-[16/10] w-full object-cover" />
                  ) : (
                    <div className="flex aspect-[16/10] items-center justify-center bg-neutral-100 text-xs text-neutral-400">
                      Sports
                    </div>
                  )}
                  <div className="p-4">
                    <p className="text-[10px] font-bold text-neutral-500 uppercase">{s.source}</p>
                    <h3 className="font-display mt-2 text-lg font-bold leading-snug">
                      {s.ai_hook_title || s.original_title}
                    </h3>
                    <p className="mt-2 line-clamp-4 text-sm leading-6 text-neutral-600">
                      {s.ai_summary?.[0] || s.original_description || "Open for the full RWDNEWS briefing."}
                    </p>
                    <p className="mt-3 text-xs font-black text-teal-800">Read full briefing →</p>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="mt-5 rounded-2xl border border-dashed bg-white p-8 text-center text-sm text-neutral-500">
              Sports stories are refreshing. Pull again in a moment.
            </div>
          )}
        </section>

        <p className="mt-10 text-[10px] leading-6 text-neutral-500">
          Scores and match information are supplied by sports data providers and refreshed
          automatically. Predictions are informational analysis, not betting advice.
        </p>
      </div>

      {activeStory ? (
        <ArticleReader
          article={{
            id: activeStory.id,
            original_url: activeStory.original_url,
            image: activeStory.image || "",
            timestamp: activeStory.timestamp,
            source: activeStory.source,
            original_title: activeStory.original_title,
            original_description: activeStory.original_description,
            ai_hook_title: activeStory.ai_hook_title || activeStory.original_title,
            ai_summary: activeStory.ai_summary?.length
              ? activeStory.ai_summary
              : [
                  activeStory.original_description ||
                    "RWDNEWS is tracking this sports story from the published source.",
                  "Key facts stay on-site so you can understand the report without leaving.",
                ],
            tags: ["#Sports"],
            read_time: "3 min read",
          }}
          saved={false}
          onClose={() => setActiveStory(null)}
          onToggleSave={() => undefined}
        />
      ) : null}
    </main>
  );
}
