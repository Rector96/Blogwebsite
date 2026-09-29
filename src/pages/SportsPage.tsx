import React, { useEffect, useMemo, useState } from "react";
import { Helmet } from "react-helmet-async";
import { SiteFooter } from "../components/SiteFooter";

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
  completed?: boolean;
};

type Story = {
  id: string;
  original_url: string;
  image: string;
  timestamp: string;
  source: string;
  original_title: string;
  ai_hook_title: string;
  ai_summary: string[];
};

type MainTab = "news" | "scores";
type DayFilter = "live" | "yesterday" | "today" | "tomorrow";

const LEAGUE_CHIPS = [
  { id: "all", label: "All" },
  { id: "premier league", label: "EPL" },
  { id: "champions league", label: "UCL" },
  { id: "la liga", label: "La Liga" },
  { id: "serie a", label: "Serie A" },
  { id: "bundesliga", label: "Bundesliga" },
  { id: "nba", label: "NBA" },
];

function teamInitials(name: string) {
  return (
    String(name || "")
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase() || "")
      .join("")
      .slice(0, 2) || "•"
  );
}

const AVATAR_COLORS = [
  "bg-blue-500",
  "bg-emerald-500",
  "bg-violet-500",
  "bg-rose-500",
  "bg-amber-500",
  "bg-cyan-500",
  "bg-indigo-500",
  "bg-teal-500",
];

function avatarColor(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h + name.charCodeAt(i) * 17) % AVATAR_COLORS.length;
  return AVATAR_COLORS[h];
}

function dayBounds(filter: DayFilter) {
  const now = new Date();
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  if (filter === "yesterday") start.setDate(start.getDate() - 1);
  if (filter === "tomorrow") start.setDate(start.getDate() + 1);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start: start.getTime(), end: end.getTime() };
}

function matchInDay(m: Match, filter: DayFilter) {
  if (filter === "live") return Boolean(m.live);
  if (!m.startTime) return filter === "today";
  const t = new Date(m.startTime).getTime();
  if (Number.isNaN(t)) return false;
  const { start, end } = dayBounds(filter);
  return t >= start && t < end;
}

function timeOrScore(m: Match) {
  if (m.live || (m.homeScore != null && m.awayScore != null)) {
    return `${m.homeScore ?? 0} - ${m.awayScore ?? 0}`;
  }
  if (!m.startTime) return "TBA";
  const d = new Date(m.startTime);
  if (Number.isNaN(d.getTime())) return "TBA";
  return d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

function storyHref(item: Story) {
  const title = (item.ai_hook_title || item.original_title)
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 90);
  return "/news/" + title + "--" + encodeURIComponent(item.id);
}

function MatchRow({ match }: { match: Match }) {
  return (
    <article className="rounded-2xl border border-white/60 bg-white/90 p-3.5 shadow-sm backdrop-blur-sm transition active:scale-[0.99]">
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
        <div className="flex min-w-0 items-center gap-2 justify-self-end text-right">
          <span className="truncate text-sm font-semibold text-slate-900">{match.home}</span>
          {match.homeLogo ? (
            <img src={match.homeLogo} alt="" className="size-8 shrink-0 object-contain" loading="lazy" />
          ) : (
            <span
              className={`flex size-8 shrink-0 items-center justify-center rounded-full text-[10px] font-black text-white ${avatarColor(match.home)}`}
            >
              {teamInitials(match.home)}
            </span>
          )}
        </div>
        <div className="min-w-[72px] text-center">
          {match.live ? (
            <span className="mb-1 inline-flex rounded-full bg-red-600 px-2 py-0.5 text-[9px] font-black text-white uppercase animate-pulse">
              ● Live
            </span>
          ) : null}
          <div className="text-lg font-black tabular-nums leading-none text-slate-900">{timeOrScore(match)}</div>
          {!match.live ? <p className="mt-1 text-[10px] text-slate-500">{match.status}</p> : null}
        </div>
        <div className="flex min-w-0 items-center gap-2 justify-self-start">
          {match.awayLogo ? (
            <img src={match.awayLogo} alt="" className="size-8 shrink-0 object-contain" loading="lazy" />
          ) : (
            <span
              className={`flex size-8 shrink-0 items-center justify-center rounded-full text-[10px] font-black text-white ${avatarColor(match.away)}`}
            >
              {teamInitials(match.away)}
            </span>
          )}
          <span className="truncate text-sm font-semibold text-slate-900">{match.away}</span>
        </div>
      </div>
    </article>
  );
}

export default function SportsPage() {
  const [data, setData] = useState<{
    live: Match[];
    featured: Match[];
    upcoming: Match[];
    results: Match[];
    news: Story[];
  }>({ live: [], featured: [], upcoming: [], results: [], news: [] });
  const [tab, setTab] = useState<MainTab>("scores");
  const [day, setDay] = useState<DayFilter>("today");
  const [league, setLeague] = useState("all");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const [sportsResponse, newsResponse] = await Promise.all([
          fetch("/api/sports", { headers: { Accept: "application/json" } }),
          fetch("/api/news", { headers: { Accept: "application/json" } }),
        ]);
        if (!sportsResponse.ok) throw new Error("Sports unavailable");
        const sportsData = await sportsResponse.json();
        let externalNews: Story[] = [];
        if (newsResponse.ok) {
          const newsData = await newsResponse.json();
          externalNews = Array.isArray(newsData?.articles)
            ? newsData.articles.filter((a: Story) =>
                /sports|football|soccer|premier|champions|nba|nfl|tennis|transfer/i.test(
                  `${a.original_title} ${a.ai_hook_title}`,
                ),
              )
            : [];
        }
        if (cancelled) return;
        const combined = [...(sportsData.news || []), ...externalNews];
        const seen = new Set<string>();
        const news = combined
          .filter((a: Story) => {
            const key = a.original_url || a.id;
            if (!key || seen.has(key)) return false;
            seen.add(key);
            return true;
          })
          .slice(0, 24);
        setData({
          live: sportsData.live || [],
          featured: sportsData.featured || [],
          upcoming: sportsData.upcoming || [],
          results: sportsData.results || [],
          news,
        });
      } catch {
        /* keep empty */
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    const t = window.setInterval(() => void load(), 30000);
    return () => {
      cancelled = true;
      window.clearInterval(t);
    };
  }, []);

  const pool = useMemo(() => {
    const all = [...data.live, ...data.featured, ...data.upcoming, ...data.results];
    return all.filter((m, i, arr) => arr.findIndex((x) => x.id === m.id) === i);
  }, [data]);

  const filtered = useMemo(() => {
    return pool
      .filter((m) => matchInDay(m, day))
      .filter((m) => league === "all" || m.league.toLowerCase().includes(league))
      .sort((a, b) => {
        if (a.live !== b.live) return a.live ? -1 : 1;
        return new Date(a.startTime || 0).getTime() - new Date(b.startTime || 0).getTime();
      });
  }, [pool, day, league]);

  const byLeague = useMemo(() => {
    const map = new Map<string, Match[]>();
    for (const m of filtered) {
      const key = m.league || "Other";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(m);
    }
    return Array.from(map.entries());
  }, [filtered]);

  return (
    <main className="min-h-dvh bg-gradient-to-b from-slate-50 via-indigo-50/40 to-slate-100 pb-28 text-slate-950">
      <Helmet>
        <title>Live scores & sports news | RockBrief</title>
        <meta
          name="description"
          content="Live football scores, fixtures and sports briefings — mobile-first like a native fan app."
        />
      </Helmet>

      <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-3 py-3">
          <a href="/sport" className="text-base font-black tracking-tight text-slate-900">
            Fan scores
          </a>
          <a href="/" className="text-xs font-semibold text-indigo-600">
            Home
          </a>
        </div>
        <div className="mx-auto flex max-w-3xl gap-2 px-3 pb-3">
          {(
            [
              ["scores", "Scores"],
              ["news", "News"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={
                tab === id
                  ? "flex-1 rounded-full bg-indigo-600 py-2.5 text-xs font-black text-white shadow-sm"
                  : "flex-1 rounded-full border border-slate-200 bg-white py-2.5 text-xs font-bold text-slate-600"
              }
            >
              {label}
            </button>
          ))}
        </div>
        {tab === "scores" ? (
          <div className="border-t border-slate-100 bg-slate-50/80">
            <div className="mx-auto flex max-w-3xl gap-2 overflow-x-auto px-3 py-2 [scrollbar-width:none]">
              {(
                [
                  ["live", "LIVE"],
                  ["today", "Today"],
                  ["tomorrow", "Tomorrow"],
                  ["yesterday", "Results"],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setDay(id)}
                  className={
                    day === id
                      ? "shrink-0 rounded-full bg-indigo-600 px-3 py-1 text-[11px] font-bold text-white"
                      : "shrink-0 rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-semibold text-slate-600"
                  }
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="mx-auto flex max-w-3xl gap-1.5 overflow-x-auto px-3 pb-2 [scrollbar-width:none]">
              {LEAGUE_CHIPS.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setLeague(c.id)}
                  className={
                    league === c.id
                      ? "shrink-0 rounded-full bg-slate-900 px-3 py-1 text-[11px] font-bold text-white"
                      : "shrink-0 rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-semibold text-slate-600"
                  }
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>
        ) : null}
      </header>

      <div className="mx-auto max-w-3xl px-3 py-4">
        {tab === "scores" ? (
          <section>
            {loading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-16 animate-pulse rounded-2xl bg-white/80" />
                ))}
              </div>
            ) : byLeague.length ? (
              <div className="space-y-5">
                {byLeague.map(([leagueName, matches]) => (
                  <div key={leagueName}>
                    <p className="mb-2 text-[10px] font-extrabold tracking-wider text-slate-400 uppercase">
                      {leagueName}
                    </p>
                    <div className="space-y-2">
                      {matches.map((m) => (
                        <MatchRow key={m.id} match={m} />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="rounded-2xl bg-white/80 p-6 text-center text-sm text-slate-500">
                No matches for this filter right now. Check LIVE or Today.
              </p>
            )}
          </section>
        ) : (
          <section className="space-y-2.5">
            {data.news.length ? (
              data.news.map((s) => (
                <a
                  key={s.id}
                  href={storyHref(s)}
                  className="flex gap-3 rounded-2xl border border-white/60 bg-white/90 p-3 shadow-sm active:scale-[0.99]"
                >
                  {s.image && !String(s.image).includes("logo") ? (
                    <img
                      src={s.image}
                      alt=""
                      className="size-16 shrink-0 rounded-xl object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <div className="size-16 shrink-0 rounded-xl bg-gradient-to-br from-indigo-200 to-slate-200" />
                  )}
                  <div className="min-w-0">
                    <p className="text-[10px] font-bold tracking-wide text-indigo-600 uppercase">
                      {s.source}
                    </p>
                    <p className="mt-0.5 line-clamp-2 text-sm font-bold text-slate-900">
                      {s.ai_hook_title || s.original_title}
                    </p>
                  </div>
                </a>
              ))
            ) : (
              <p className="rounded-2xl bg-white/80 p-6 text-center text-sm text-slate-500">
                Sports stories will appear here as the bot publishes.
              </p>
            )}
          </section>
        )}
      </div>

      <SiteFooter />
    </main>
  );
}
