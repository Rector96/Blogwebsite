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
  image_credit?: string;
  image_source_url?: string;
  image_is_illustrative?: boolean;
};

type MainTab = "news" | "scores" | "predictions";
type DayFilter = "live" | "yesterday" | "today" | "tomorrow";

const LEAGUE_CHIPS = [
  { id: "all", label: "All" },
  { id: "premier league", label: "EPL" },
  { id: "champions league", label: "UCL" },
  { id: "la liga", label: "La Liga" },
  { id: "serie a", label: "Serie A" },
  { id: "bundesliga", label: "Bundesliga" },
  { id: "ligue 1", label: "Ligue 1" },
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
    <article className="rounded-2xl border border-neutral-200 bg-white p-3 shadow-sm">
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
              <span className="mb-1 inline-flex rounded-full bg-red-600 px-2 py-0.5 text-[9px] font-black text-white uppercase animate-pulse">
                ● Live
              </span>
            ) : null}
            <div className="font-display text-lg font-black tabular-nums leading-none">{timeOrScore(match)}</div>
            {!match.live ? <p className="mt-1 text-[10px] text-neutral-500">{match.status}</p> : null}
          </div>
          <div className="flex min-w-0 items-center gap-2 justify-self-start">
            {match.awayLogo ? (
              <img src={match.awayLogo} alt="" className="size-7 shrink-0 object-contain" loading="lazy" />
            ) : (
              <span className="size-7 shrink-0 rounded-full bg-neutral-100" />
            )}
            <span className="truncate text-sm font-semibold">{match.away}</span>
          </div>
        </div>
      </a>
      <div className="mt-2.5 flex justify-center">
        <a
          href={`/sport/predictions?id=${encodeURIComponent(match.id)}`}
          className="inline-flex rounded-full bg-amber-400 px-3 py-1.5 text-[11px] font-extrabold text-neutral-950"
        >
          📊 AI outlook
        </a>
      </div>
    </article>
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
    providers?: { apiFootballKeyPresent?: boolean; scoreboard?: string };
  }>({
    live: [],
    featured: [],
    upcoming: [],
    results: [],
    news: [],
    affiliateUrl: "",
  });
  const [tab, setTab] = useState<MainTab>("news"); // news first by design
  const [day, setDay] = useState<DayFilter>("today");
  const [league, setLeague] = useState("all");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [detail, setDetail] = useState<any>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [readIds, setReadIds] = useState<Set<string>>(() =>
    typeof window !== "undefined" ? loadReadIds() : new Set(),
  );

  const load = async () => {
    setLoading(true);
    setLoadError(null);
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
        .slice(0, 30);

      setData({
        live: sportsData.live || [],
        featured: sportsData.featured || [],
        upcoming: sportsData.upcoming || [],
        results: sportsData.results || [],
        news,
        affiliateUrl: sportsData.affiliateUrl || "",
        counts: sportsData.counts,
        providers: sportsData.providers,
      });
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Sports feed unavailable");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    const t = window.setInterval(() => void load(), 30000);
    return () => window.clearInterval(t);
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

  const matchCount = data.counts?.matches ?? pool.length;

  if (matchId) {
    const m = detail?.match as Match | undefined;
    return (
      <main className="min-h-dvh bg-[#f4f4f2] pb-20 text-neutral-950">
        <Helmet>
          <title>{m ? `${m.home} vs ${m.away} | RWDNEWS Sports` : "Match | RWDNEWS"}</title>
        </Helmet>
        <header className="sticky top-0 z-30 border-b border-neutral-800 bg-neutral-950 text-white">
          <div className="mx-auto flex max-w-3xl items-center justify-between px-3 py-3">
            <a href="/sport" className="text-sm font-bold">
              ← Sports
            </a>
            <a href="/" className="text-xs text-neutral-400">
              Home
            </a>
          </div>
        </header>
        <div className="mx-auto max-w-3xl px-3 py-6">
          {detailLoading ? (
            <p className="text-sm text-neutral-500">Loading…</p>
          ) : m ? (
            <section className="rounded-3xl bg-neutral-950 p-6 text-white">
              <p className="text-center text-[10px] font-extrabold tracking-wider text-amber-400 uppercase">
                {m.league}
              </p>
              <div className="mt-6 grid grid-cols-[1fr_auto_1fr] items-center gap-2 text-center">
                <div>
                  {m.homeLogo ? <img src={m.homeLogo} alt="" className="mx-auto size-14 object-contain" /> : null}
                  <h1 className="mt-2 text-sm font-bold sm:text-lg">{m.home}</h1>
                </div>
                <div>
                  <div className="font-display text-3xl font-black">{timeOrScore(m)}</div>
                  <p className="mt-1 text-xs text-neutral-400">{m.live ? "LIVE" : m.status}</p>
                </div>
                <div>
                  {m.awayLogo ? <img src={m.awayLogo} alt="" className="mx-auto size-14 object-contain" /> : null}
                  <h2 className="mt-2 text-sm font-bold sm:text-lg">{m.away}</h2>
                </div>
              </div>
              <a
                href={`/sport/predictions?id=${encodeURIComponent(m.id)}`}
                className="mt-6 block rounded-full bg-amber-400 py-3 text-center text-xs font-extrabold text-neutral-950"
              >
                📊 AI outlook (not betting advice)
              </a>
            </section>
          ) : (
            <p className="text-sm text-neutral-500">Match not in feed right now.</p>
          )}
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-dvh bg-[#f4f4f2] pb-28 text-neutral-950">
      <Helmet>
        <title>Sports News & Scores | RWDNEWS</title>
        <meta
          name="description"
          content="Sports news briefings first, then live scores and cautious match outlooks on RWDNEWS. Sources credited."
        />
      </Helmet>

      <header className="sticky top-0 z-40 border-b border-neutral-800 bg-neutral-950 text-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-3 py-3">
          <a href="/sport" className="font-display text-base font-black tracking-tight">
            RWDNEWS SPORTS
          </a>
          <a href="/" className="text-xs font-semibold text-neutral-300">
            Home
          </a>
        </div>

        {/* Main tabs: News first */}
        <div className="border-t border-white/10">
          <div className="mx-auto flex max-w-3xl gap-1 px-2 py-2">
            {(
              [
                ["news", "News"],
                ["scores", matchCount ? `Scores (${matchCount})` : "Scores"],
                ["predictions", "Outlooks"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setTab(id)}
                className={
                  tab === id
                    ? "flex-1 rounded-full bg-amber-400 py-2 text-xs font-black text-neutral-950"
                    : "flex-1 rounded-full border border-white/15 py-2 text-xs font-bold text-white"
                }
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {tab === "scores" ? (
          <>
            <div className="border-t border-white/5">
              <div className="mx-auto flex max-w-3xl gap-2 overflow-x-auto px-3 py-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {(
                  [
                    ["live", "Live"],
                    ["today", "Today"],
                    ["tomorrow", "Tomorrow"],
                    ["yesterday", "Yesterday"],
                  ] as const
                ).map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setDay(id)}
                    className={
                      day === id
                        ? "shrink-0 rounded-full bg-white px-3 py-1 text-[11px] font-bold text-neutral-950"
                        : "shrink-0 rounded-full border border-white/20 px-3 py-1 text-[11px] font-semibold text-neutral-300"
                    }
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
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
          </>
        ) : null}
      </header>

      <div className="mx-auto max-w-3xl px-3 py-4">
        {/* ——— NEWS FIRST ——— */}
        {tab === "news" ? (
          <section>
            <p className="text-[11px] text-neutral-500">
              Sports briefings · sources credited · not full republished articles
            </p>
            {loading ? (
              <div className="mt-4 space-y-3">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="h-20 animate-pulse rounded-2xl bg-neutral-200/80" />
                ))}
              </div>
            ) : data.news.length ? (
              <div className="mt-3 space-y-2.5">
                {data.news.map((s) => {
                  const isRead = readIds.has(s.id);
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => {
                        openStory(s);
                        setReadIds(loadReadIds());
                      }}
                      className={`flex w-full gap-3 rounded-2xl border bg-white p-2.5 text-left shadow-sm ${
                        isRead ? "opacity-70" : ""
                      }`}
                    >
                      {s.image && !/rwdnews-logo/i.test(s.image) ? (
                        <div className="relative size-[88px] shrink-0 overflow-hidden rounded-xl bg-neutral-100">
                          <img
                            src={s.image}
                            alt={s.ai_hook_title || s.original_title || "Sports story"}
                            className="size-full object-cover"
                            loading="lazy"
                            onError={(event) => {
                              event.currentTarget.style.display = "none";
                            }}
                          />
                          {s.image_is_illustrative ? (
                            <span className="absolute bottom-1 left-1 rounded bg-black/70 px-1.5 py-0.5 text-[8px] font-bold text-white">
                              Illustrative
                            </span>
                          ) : null}
                        </div>
                      ) : (
                        <div className="grid size-[88px] shrink-0 place-items-center rounded-xl bg-neutral-100 text-[10px] font-bold text-neutral-400">
                          SPORT
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="text-[9px] font-bold tracking-wider text-amber-800 uppercase">
                          {s.source}
                        </p>
                        <p className="mt-0.5 line-clamp-3 text-[15px] font-semibold leading-snug">
                          {s.ai_hook_title || s.original_title}
                        </p>
                        {s.image_credit ? (
                          <p className="mt-1 truncate text-[9px] text-neutral-400">
                            {s.image_credit}
                          </p>
                        ) : null}
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : loadError ? (
              <div className="mt-6 rounded-2xl border border-red-200 bg-white p-6 text-center">
                <p className="text-sm font-bold text-neutral-900">Sports feed could not refresh</p>
                <p className="mt-1 text-xs text-neutral-500">Your existing news remains available while we retry.</p>
                <button
                  type="button"
                  onClick={() => void load()}
                  className="mt-4 rounded-full bg-neutral-950 px-4 py-2 text-xs font-bold text-white"
                >
                  Try again
                </button>
              </div>
            ) : (
              <div className="mt-6 rounded-2xl border border-dashed bg-white p-8 text-center text-sm text-neutral-500">
                No sports stories yet. Refresh in a moment.
              </div>
            )}
            <div className="my-6">
              <AdSlot slot="sports_news_mid" variant="inline" label="Advertisement" className="min-h-[90px]" />
            </div>
            <button
              type="button"
              onClick={() => setTab("scores")}
              className="w-full rounded-2xl border border-neutral-300 bg-white py-3 text-xs font-bold text-neutral-800"
            >
              View scores & fixtures →
            </button>
          </section>
        ) : null}

        {/* ——— SCORES ——— */}
        {tab === "scores" ? (
          <section>
            <p className="text-[11px] text-neutral-500">
              {filtered.length} matches · {day}
              {league !== "all" ? ` · ${league}` : ""}
            </p>
            {loading ? (
              <div className="mt-4 space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-24 animate-pulse rounded-2xl bg-neutral-200/80" />
                ))}
              </div>
            ) : byLeague.length ? (
              <div className="mt-4 space-y-7">
                {byLeague.map(([leagueName, matches]) => (
                  <div key={leagueName}>
                    <h2 className="mb-2 border-b border-neutral-300 pb-1.5 text-[11px] font-black tracking-wider text-teal-900 uppercase">
                      {leagueName}
                    </h2>
                    <div className="space-y-2.5">
                      {matches.map((m) => (
                        <MatchRow key={m.id} match={m} />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="mt-6 rounded-2xl border border-dashed bg-white p-6 text-center text-sm text-neutral-600">
                <p className="font-semibold">Scores are updating</p>
                <p className="mt-2 text-xs leading-relaxed text-neutral-500">
                  Fixtures load from API-Football and ESPN when the providers respond. Sports news above stays
                  available. If this stays empty after a redeploy, check that{" "}
                  <code className="text-[10px]">API_FOOTBALL_KEY</code> is set exactly and the plan allows
                  fixtures.
                </p>
                <button
                  type="button"
                  onClick={() => setTab("news")}
                  className="mt-4 rounded-full bg-neutral-950 px-4 py-2 text-xs font-bold text-white"
                >
                  Back to sports news
                </button>
              </div>
            )}
          </section>
        ) : null}

        {/* ——— PREDICTIONS ——— */}
        {tab === "predictions" ? (
          <section>
            <p className="text-sm leading-relaxed text-neutral-600">
              Match outlooks are <strong>informational only</strong> — not betting advice. We only generate an
              outlook when you open a fixture, so the site stays fast and we do not invent results.
            </p>
            {pool.filter((m) => !m.completed).length ? (
              <div className="mt-4 space-y-2">
                {pool
                  .filter((m) => !m.completed)
                  .slice(0, 20)
                  .map((m) => (
                    <a
                      key={m.id}
                      href={`/sport/predictions?id=${encodeURIComponent(m.id)}`}
                      className="block rounded-2xl border border-neutral-200 bg-white p-3.5 shadow-sm"
                    >
                      <p className="text-[9px] font-bold tracking-wider text-teal-800 uppercase">{m.league}</p>
                      <p className="mt-1 text-sm font-semibold">
                        {m.home} vs {m.away}
                      </p>
                      <p className="mt-1 text-[11px] text-amber-700 font-bold">Open AI outlook →</p>
                    </a>
                  ))}
              </div>
            ) : (
              <div className="mt-6 rounded-2xl border border-dashed bg-white p-6 text-center text-sm text-neutral-500">
                Outlooks appear when fixtures are in the board. Read sports news in the meantime — it does not
                depend on the scores API.
                <div className="mt-4">
                  <button
                    type="button"
                    onClick={() => setTab("news")}
                    className="rounded-full bg-neutral-950 px-4 py-2 text-xs font-bold text-white"
                  >
                    Sports news
                  </button>
                </div>
              </div>
            )}
            <p className="mt-4 text-[10px] text-neutral-400">18+ where applicable. Gamble responsibly.</p>
          </section>
        ) : null}

        <section className="mt-6 rounded-2xl border border-neutral-200 bg-white p-4 text-xs leading-6 text-neutral-600">
          <p>
            Some sports stories use illustrative imagery when a publisher image is unavailable. Those images are
            selected for the story's sport/topic and credited to the photographer.
          </p>
          <a
            href="https://www.pexels.com"
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 inline-flex font-bold text-teal-800 underline underline-offset-2"
          >
            Photos provided by Pexels
          </a>
        </section>

        <section className="mt-10 rounded-2xl border border-neutral-200 bg-white p-5 text-sm leading-7 text-neutral-700">
          <h2 className="font-display text-base font-bold text-neutral-950">RWDNEWS Sports</h2>
          <p className="mt-2">
            Global sports briefings with sources credited. Scores and cautious match outlooks when data
            providers are available. We do not invent results or guarantee outcomes.
          </p>
        </section>
      </div>

      <div className="sm:hidden">
        <StickyAdBanner slot="sports_sticky" />
      </div>
      <SiteFooter />
    </main>
  );
}
