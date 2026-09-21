import React, { useEffect, useMemo, useState } from "react";
import { Helmet } from "react-helmet-async";
import { SiteFooter } from "../components/SiteFooter";
import { AdSlot, StickyAdBanner } from "../components/AdSlot";

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

type DayFilter = "live" | "yesterday" | "today" | "tomorrow";

const LEAGUE_CHIPS = [
  { id: "all", label: "All" },
  { id: "premier league", label: "EPL" },
  { id: "champions league", label: "UCL" },
  { id: "la liga", label: "La Liga" },
  { id: "serie a", label: "Serie A" },
  { id: "bundesliga", label: "Bundesliga" },
  { id: "ligue 1", label: "Ligue 1" },
  { id: "npfl", label: "NPFL" },
  { id: "nba", label: "NBA" },
  { id: "nfl", label: "NFL" },
];

const READ_KEY = "rwdnews_read_story_ids";

function loadReadIds(): Set<string> {
  try {
    const raw = localStorage.getItem(READ_KEY);
    const arr = raw ? (JSON.parse(raw) as string[]) : [];
    return new Set(Array.isArray(arr) ? arr : []);
  } catch {
    return new Set();
  }
}

function markRead(id: string) {
  try {
    const set = loadReadIds();
    set.add(id);
    localStorage.setItem(READ_KEY, JSON.stringify(Array.from(set).slice(-200)));
  } catch {
    /* ignore */
  }
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

function shortTime(iso?: string) {
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

function storyHref(item: Story) {
  const title = (item.ai_hook_title || item.original_title)
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 90);
  return "/news/" + title + "--" + encodeURIComponent(item.id);
}

function openStory(item: Story) {
  markRead(item.id);
  try {
    sessionStorage.setItem("rwdnews_pending_story", JSON.stringify(item));
    sessionStorage.setItem("rwdnews_pending_story_id", item.id);
  } catch {
    /* ignore */
  }
  window.location.href = storyHref(item);
}

function MatchRow({ match }: { match: Match }) {
  return (
    <article className="rounded-2xl border border-neutral-200 bg-white p-3 shadow-sm sm:p-3.5">
      <a href={`/sport/match/${encodeURIComponent(match.id)}`} className="block active:opacity-90">
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
          <div className="flex min-w-0 items-center gap-2 justify-self-end text-right">
            <span className="truncate text-sm font-semibold">{match.home}</span>
            {match.homeLogo ? (
              <img src={match.homeLogo} alt="" className="size-7 shrink-0 object-contain" loading="lazy" />
            ) : (
              <span className="size-7 shrink-0 rounded-full bg-neutral-100" />
            )}
          </div>

          <div className="min-w-[72px] text-center">
            {match.live ? (
              <span className="mb-1 inline-flex items-center gap-1 rounded-full bg-red-600 px-2 py-0.5 text-[9px] font-black tracking-wide text-white uppercase animate-pulse">
                ● Live
              </span>
            ) : null}
            <div className="font-display text-lg font-black tabular-nums leading-none sm:text-xl">
              {timeOrScore(match)}
            </div>
            {!match.live ? (
              <p className="mt-1 text-[10px] font-medium text-neutral-500">{match.status}</p>
            ) : null}
          </div>

          <div className="flex min-w-0 items-center gap-2 justify-self-start text-left">
            {match.awayLogo ? (
              <img src={match.awayLogo} alt="" className="size-7 shrink-0 object-contain" loading="lazy" />
            ) : (
              <span className="size-7 shrink-0 rounded-full bg-neutral-100" />
            )}
            <span className="truncate text-sm font-semibold">{match.away}</span>
          </div>
        </div>
        {match.venue ? (
          <p className="mt-2 text-center text-[10px] text-neutral-400">{match.venue}</p>
        ) : null}
      </a>
      <div className="mt-2.5 flex justify-center">
        <a
          href={`/sport/predictions?id=${encodeURIComponent(match.id)}`}
          className="inline-flex items-center gap-1 rounded-full bg-amber-400 px-3 py-1.5 text-[11px] font-extrabold text-neutral-950 shadow-sm"
        >
          📊 View AI Prediction & Stats
        </a>
      </div>
    </article>
  );
}

function seoBlurb(counts: { matches: number; live: number; leagues: string[] }) {
  const leagueText =
    counts.leagues.slice(0, 6).join(", ") ||
    "the Premier League, Champions League, La Liga, Serie A and more";
  return (
    `Get the latest live football scores, fixtures and AI-driven match predictions on RWDNEWS Sports. ` +
    `Today’s board covers ${counts.matches} fixtures across ${leagueText}` +
    (counts.live ? `, with ${counts.live} matches currently live` : "") +
    `. Follow English Premier League, UEFA Champions League, La Liga, Serie A, Bundesliga, Ligue 1, NPFL and major world leagues in one mobile-friendly scoreboard. ` +
    `Open any match for a cautious RWDNEWS outlook — probabilities, key talking points and source-backed sports news. ` +
    `RWDNEWS summaries are short briefings; full reports remain with the original publishers. ` +
    `Check live scores, results and tomorrow’s fixtures without leaving the site.`
  );
}

export default function SportsPage() {
  const path = typeof window !== "undefined" ? window.location.pathname : "/sport";
  const matchId = path.startsWith("/sport/match/")
    ? decodeURIComponent(path.slice("/sport/match/".length))
    : "";

  const [data, setData] = useState<{
    live: Match[];
    featured: Match[];
    upcoming: Match[];
    results: Match[];
    news: Story[];
    affiliateUrl: string;
    counts?: { matches: number; live: number; results: number; upcoming: number; news: number };
  }>({
    live: [],
    featured: [],
    upcoming: [],
    results: [],
    news: [],
    affiliateUrl: "",
  });
  const [day, setDay] = useState<DayFilter>("today");
  const [league, setLeague] = useState("all");
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState<any>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [readIds, setReadIds] = useState<Set<string>>(() =>
    typeof window !== "undefined" ? loadReadIds() : new Set(),
  );

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
              /sports|football|soccer|premier|champions|nba|nfl|tennis|transfer/i.test(
                `${a.original_title} ${a.ai_hook_title}`,
              ),
            )
          : [];
      }
      const combined = [...(sportsData.news || []), ...externalNews];
      const seen = new Set<string>();
      const news = combined
        .filter((a: Story) => {
          const key = a.original_url || a.id;
          if (!key || seen.has(key)) return false;
          seen.add(key);
          return true;
        })
        .sort((a: Story, b: Story) => Date.parse(b.timestamp) - Date.parse(a.timestamp))
        .slice(0, 24);

      setData({
        live: sportsData.live || [],
        featured: sportsData.featured || [],
        upcoming: sportsData.upcoming || [],
        results: sportsData.results || [],
        news,
        affiliateUrl: sportsData.affiliateUrl || "",
        counts: sportsData.counts,
      });

      // Prefer live tab when games are on
      if ((sportsData.live || []).length > 0) setDay("live");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    const t = window.setInterval(() => void load(), day === "live" ? 15000 : 45000);
    return () => window.clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!matchId) return;
    setDetailLoading(true);
    fetch(`/api/sports?action=match&id=${encodeURIComponent(matchId)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then(setDetail)
      .catch(() => setDetail(null))
      .finally(() => setDetailLoading(false));
  }, [matchId]);

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

  const leaguesForSeo = useMemo(
    () => Array.from(new Set(filtered.map((m) => m.league).filter(Boolean))),
    [filtered],
  );

  // ——— Match centre detail ———
  if (matchId) {
    const m = detail?.match as Match | undefined;
    const aff = detail?.affiliateUrl || data.affiliateUrl || "";
    return (
      <main className="min-h-dvh bg-[#f4f4f2] pb-20 text-neutral-950">
        <Helmet>
          <title>{m ? `${m.home} vs ${m.away} | RWDNEWS Sports` : "Match Centre | RWDNEWS"}</title>
        </Helmet>
        <header className="sticky top-0 z-30 border-b border-neutral-800 bg-neutral-950 text-white">
          <div className="mx-auto flex max-w-3xl items-center justify-between px-3 py-3">
            <a href="/sport" className="text-sm font-bold">
              ← Sports
            </a>
            <a href="/" className="text-xs text-neutral-400">
              News
            </a>
          </div>
        </header>
        <div className="mx-auto max-w-3xl px-3 py-6">
          {detailLoading ? (
            <p className="text-sm text-neutral-500">Loading match…</p>
          ) : m ? (
            <section className="rounded-3xl bg-neutral-950 p-6 text-white shadow-xl">
              <p className="text-center text-[10px] font-extrabold tracking-[0.18em] text-amber-400 uppercase">
                {m.league}
              </p>
              <div className="mt-6 grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                <div className="text-center">
                  {m.homeLogo ? (
                    <img src={m.homeLogo} alt="" className="mx-auto size-14 object-contain" />
                  ) : null}
                  <h1 className="mt-2 text-sm font-bold sm:text-lg">{m.home}</h1>
                </div>
                <div className="text-center">
                  <div className="font-display text-3xl font-black">{timeOrScore(m)}</div>
                  <p className={m.live ? "mt-1 text-xs font-bold text-red-400" : "mt-1 text-xs text-neutral-400"}>
                    {m.live ? "LIVE" : m.status}
                  </p>
                </div>
                <div className="text-center">
                  {m.awayLogo ? (
                    <img src={m.awayLogo} alt="" className="mx-auto size-14 object-contain" />
                  ) : null}
                  <h2 className="mt-2 text-sm font-bold sm:text-lg">{m.away}</h2>
                </div>
              </div>
              <p className="mt-4 text-center text-xs text-neutral-400">{shortTime(m.startTime)}</p>
              <div className="mt-5 flex flex-col gap-2">
                <a
                  href={`/sport/predictions?id=${encodeURIComponent(m.id)}`}
                  className="rounded-full bg-amber-400 py-3 text-center text-xs font-extrabold text-neutral-950"
                >
                  📊 View AI Prediction & Stats
                </a>
                {aff ? (
                  <a
                    href={aff}
                    target="_blank"
                    rel="noopener noreferrer sponsored"
                    className="rounded-full border border-emerald-400/40 py-3 text-center text-xs font-extrabold text-emerald-300"
                  >
                    Compare odds →
                  </a>
                ) : null}
              </div>
            </section>
          ) : (
            <p className="text-sm text-neutral-500">Match no longer in feed.</p>
          )}
        </div>
      </main>
    );
  }

  const dayTabs: { id: DayFilter; label: string }[] = [
    { id: "live", label: data.live.length ? `Live (${data.live.length})` : "Live" },
    { id: "yesterday", label: "Yesterday" },
    { id: "today", label: "Today" },
    { id: "tomorrow", label: "Tomorrow" },
  ];

  return (
    <main className="min-h-dvh bg-[#f4f4f2] pb-28 text-neutral-950">
      <Helmet>
        <title>Live Scores & Fixtures | RWDNEWS Sports</title>
        <meta
          name="description"
          content="Live football scores, Premier League fixtures, Champions League results and AI match predictions on RWDNEWS."
        />
      </Helmet>

      {/* Zone 1 — sticky header */}
      <header className="sticky top-0 z-40 border-b border-neutral-800 bg-neutral-950 text-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-3 py-3">
          <a href="/sport" className="font-display text-base font-black tracking-tight">
            RWDNEWS SPORTS
          </a>
          <a href="/" className="text-xs font-semibold text-neutral-300">
            News
          </a>
        </div>

        {/* Date ticker */}
        <div className="border-t border-white/10">
          <div className="mx-auto flex max-w-3xl gap-2 overflow-x-auto px-3 py-2.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {dayTabs.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setDay(t.id)}
                className={
                  day === t.id
                    ? "shrink-0 rounded-full bg-amber-400 px-3.5 py-1.5 text-xs font-black text-neutral-950"
                    : "shrink-0 rounded-full border border-white/20 px-3.5 py-1.5 text-xs font-bold text-white"
                }
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* League chips */}
        <div className="border-t border-white/5 bg-neutral-900/80">
          <div className="mx-auto flex max-w-3xl gap-1.5 overflow-x-auto px-3 py-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {LEAGUE_CHIPS.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setLeague(c.id)}
                className={
                  league === c.id
                    ? "shrink-0 rounded-full bg-white px-3 py-1 text-[11px] font-bold text-neutral-950"
                    : "shrink-0 rounded-full border border-white/15 px-3 py-1 text-[11px] font-semibold text-neutral-300"
                }
              >
                {c.label}
              </button>
            ))}
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-3xl px-3 py-4">
        <p className="text-[11px] text-neutral-500">
          {filtered.length} matches · {day === "live" ? "live now" : day}
          {league !== "all" ? ` · ${league}` : ""}
        </p>

        {/* Zone 2 — match feed grouped by league */}
        {loading ? (
          <div className="mt-8 space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-24 animate-pulse rounded-2xl bg-neutral-200/80" />
            ))}
          </div>
        ) : byLeague.length ? (
          <div className="mt-4 space-y-7">
            {byLeague.map(([leagueName, matches]) => (
              <section key={leagueName}>
                <h2 className="mb-2 border-b border-neutral-300 pb-1.5 text-[11px] font-black tracking-[0.14em] text-teal-900 uppercase">
                  {leagueName}
                </h2>
                <div className="space-y-2.5">
                  {matches.map((m) => (
                    <MatchRow key={m.id} match={m} />
                  ))}
                </div>
              </section>
            ))}
          </div>
        ) : (
          <div className="mt-8 rounded-2xl border border-dashed bg-white p-8 text-center text-sm text-neutral-500">
            No matches for this filter. Try Today or another league.
          </div>
        )}

        <div className="my-6">
          <AdSlot slot="sports_mid" variant="inline" label="Advertisement" className="min-h-[90px]" />
        </div>

        {/* Sports news strip */}
        {data.news.length ? (
          <section className="mt-8">
            <h2 className="font-display text-lg font-black">Sports news</h2>
            <div className="mt-3 space-y-2">
              {data.news.slice(0, 8).map((s) => {
                const isRead = readIds.has(s.id);
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => {
                      openStory(s);
                      setReadIds(loadReadIds());
                    }}
                    className={`flex w-full gap-3 rounded-xl border bg-white p-2.5 text-left ${
                      isRead ? "opacity-70" : ""
                    }`}
                  >
                    {s.image ? (
                      <img
                        src={s.image}
                        alt=""
                        className="size-16 shrink-0 rounded-lg object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <div className="size-16 shrink-0 rounded-lg bg-neutral-100" />
                    )}
                    <div className="min-w-0">
                      <p className="text-[9px] font-bold text-amber-800 uppercase">{s.source}</p>
                      <p className="mt-0.5 line-clamp-2 text-sm font-semibold leading-snug">
                        {s.ai_hook_title || s.original_title}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </section>
        ) : null}

        {/* Zone 3 — SEO footer text for Google */}
        <section className="mt-10 rounded-2xl border border-neutral-200 bg-white p-5 text-sm leading-7 text-neutral-700">
          <h2 className="font-display text-base font-bold text-neutral-950">
            Live scores & match predictions — RWDNEWS Sports
          </h2>
          <p className="mt-2">{seoBlurb({
            matches: filtered.length || data.counts?.matches || 0,
            live: data.live.length,
            leagues: leaguesForSeo,
          })}</p>
          <p className="mt-3 text-xs text-neutral-500">
            Predictions are informational commentary only — not betting advice. 18+ where applicable.
          </p>
        </section>
      </div>

      {data.live.length > 0 && day !== "live" ? (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-neutral-800 bg-neutral-950/95 px-3 py-2.5 sm:hidden">
          <button
            type="button"
            onClick={() => {
              setDay("live");
              window.scrollTo({ top: 0, behavior: "smooth" });
            }}
            className="flex w-full items-center justify-center rounded-xl bg-red-600 py-2.5 text-xs font-extrabold text-white"
          >
            ● {data.live.length} live — jump to scoreboard
          </button>
        </div>
      ) : (
        <div className="sm:hidden">
          <StickyAdBanner slot="sports_sticky" />
        </div>
      )}

      <SiteFooter />
    </main>
  );
}
