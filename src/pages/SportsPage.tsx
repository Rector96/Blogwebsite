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
  category?: string;
};

const sports = [
  ["all", "All", "🏆"],
  ["football", "Football", "⚽"],
  ["basketball", "Basketball", "🏀"],
  ["tennis", "Tennis", "🎾"],
  ["baseball", "Baseball", "⚾"],
  ["hockey", "Hockey", "🏒"],
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
    const arr = Array.from(set).slice(-200);
    localStorage.setItem(READ_KEY, JSON.stringify(arr));
  } catch {
    /* ignore */
  }
}

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

function scoreText(m: Match) {
  return m.homeScore == null && m.awayScore == null ? "—" : `${m.homeScore ?? 0} - ${m.awayScore ?? 0}`;
}

function MatchCard({ match }: { match: Match }) {
  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-3.5 shadow-sm sm:p-4">
      <a href={matchPath(match.id)} className="block active:opacity-90">
        <div className="flex items-center justify-between gap-2 text-[10px] font-bold tracking-wide uppercase">
          <span className="truncate text-teal-800">{match.league}</span>
          <span className={match.live ? "shrink-0 text-red-600" : "shrink-0 text-neutral-400"}>
            {match.live ? "● LIVE" : match.status}
          </span>
        </div>
        <div className="mt-3 grid grid-cols-[1fr_auto] items-center gap-2">
          <div className="min-w-0 space-y-2.5 text-sm font-semibold">
            <div className="flex items-center gap-2">
              {match.homeLogo ? (
                <img src={match.homeLogo} alt="" className="size-5 shrink-0 object-contain sm:size-6" />
              ) : (
                <span className="size-5 shrink-0 rounded-full bg-neutral-100 sm:size-6" />
              )}
              <span className="truncate">{match.home}</span>
            </div>
            <div className="flex items-center gap-2">
              {match.awayLogo ? (
                <img src={match.awayLogo} alt="" className="size-5 shrink-0 object-contain sm:size-6" />
              ) : (
                <span className="size-5 shrink-0 rounded-full bg-neutral-100 sm:size-6" />
              )}
              <span className="truncate">{match.away}</span>
            </div>
          </div>
          <div className="text-right font-display text-base font-bold tabular-nums sm:text-lg">
            <div>{match.homeScore ?? "—"}</div>
            <div>{match.awayScore ?? "—"}</div>
          </div>
        </div>
        <p className="mt-3 text-[10px] text-neutral-400">{timeLabel(match.startTime)}</p>
        <p className="mt-1.5 text-xs font-extrabold text-teal-800">Match centre →</p>
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
    affiliateUrl: string;
    counts?: {
      matches: number;
      live: number;
      results: number;
      upcoming: number;
      news: number;
    };
  }>({
    live: [],
    featured: [],
    upcoming: [],
    results: [],
    news: [],
    rumors: [],
    affiliateUrl: "",
  });
  const [selectedSport, setSelectedSport] = useState("all");
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState<any>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [storyTab, setStoryTab] = useState<"news" | "rumors">("news");
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
              /sports|football|soccer|premier league|champions league|uefa|fifa|nba|nfl|mlb|nhl|tennis|cricket|basketball|baseball|hockey|rugby|boxing|athletics|formula 1|transfer/i.test(
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
        affiliateUrl: typeof sportsData.affiliateUrl === "string" ? sportsData.affiliateUrl : "",
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
    const refreshMs = mode === "live" ? 15000 : 30000;
    const t = window.setInterval(() => void load(), refreshMs);
    return () => window.clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    const aff = detail?.affiliateUrl || data.affiliateUrl || "";
    return (
      <main className="min-h-dvh bg-[#f4f4f2] pb-20 text-neutral-950">
        <Helmet>
          <title>{m ? `${m.home} vs ${m.away} | RWDNEWS Sports` : "Match Centre | RWDNEWS Sports"}</title>
        </Helmet>
        <header className="sticky top-0 z-30 border-b border-neutral-800 bg-neutral-950 text-white">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-3 py-3 sm:px-4">
            <a href="/sport" className="font-display text-sm font-bold sm:text-base">
              RWDNEWS SPORTS
            </a>
            <a href="/" className="text-xs text-neutral-300">
              News
            </a>
          </div>
        </header>
        <div className="mx-auto max-w-5xl px-3 py-5 sm:px-4 sm:py-10">
          <a href="/sport" className="text-xs font-bold text-teal-800">
            ← Back to Sports
          </a>
          {detailLoading ? (
            <div className="mt-6 rounded-2xl bg-white p-8 text-sm">Loading match centre…</div>
          ) : m ? (
            <section className="mt-4 rounded-3xl bg-neutral-950 p-5 text-white shadow-xl sm:p-10">
              <p className="text-[10px] font-extrabold tracking-[0.18em] text-amber-400 uppercase">
                {m.league} · {m.sportLabel || m.sport}
              </p>
              <div className="mt-6 grid grid-cols-[1fr_auto_1fr] items-center gap-2 sm:mt-8 sm:gap-3">
                <div className="min-w-0 text-center">
                  {m.homeLogo ? (
                    <img src={m.homeLogo} alt="" className="mx-auto size-12 object-contain sm:size-16" />
                  ) : null}
                  <h1 className="font-display mt-2 truncate text-sm font-bold sm:mt-3 sm:text-2xl">{m.home}</h1>
                </div>
                <div className="text-center">
                  <div className="font-display text-2xl font-black sm:text-5xl">{scoreText(m)}</div>
                  <p className={m.live ? "mt-2 text-xs font-bold text-red-400" : "mt-2 text-xs text-neutral-400"}>
                    {m.live ? "LIVE" : m.status}
                  </p>
                </div>
                <div className="min-w-0 text-center">
                  {m.awayLogo ? (
                    <img src={m.awayLogo} alt="" className="mx-auto size-12 object-contain sm:size-16" />
                  ) : null}
                  <h2 className="font-display mt-2 truncate text-sm font-bold sm:mt-3 sm:text-2xl">{m.away}</h2>
                </div>
              </div>
              <p className="mt-5 text-center text-xs text-neutral-400">
                {timeLabel(m.startTime)}
                {m.venue ? ` · ${m.venue}` : ""}
              </p>
              <div className="mt-5 flex flex-col items-stretch justify-center gap-2 sm:flex-row sm:items-center">
                <a
                  href={`/sport/predictions?id=${encodeURIComponent(m.id)}`}
                  className="rounded-full bg-amber-400 px-5 py-2.5 text-center text-xs font-extrabold text-neutral-950"
                >
                  Prediction outlook →
                </a>
                {aff ? (
                  <a
                    href={aff}
                    target="_blank"
                    rel="noopener noreferrer sponsored"
                    className="rounded-full border border-emerald-400/50 px-5 py-2.5 text-center text-xs font-extrabold text-emerald-300"
                  >
                    Compare odds →
                  </a>
                ) : null}
              </div>
            </section>
          ) : (
            <div className="mt-6 rounded-2xl border bg-white p-8 text-center text-sm">
              This match is no longer in the live feed.
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
    <main className="min-h-dvh bg-[#f4f4f2] pb-24 text-neutral-950">
      <Helmet>
        <title>{title} | RWDNEWS</title>
        <meta
          name="description"
          content="Live scores, fixtures, results, sports news and match predictions on RWDNEWS."
        />
      </Helmet>

      <header className="sticky top-0 z-30 border-b border-neutral-800 bg-neutral-950/95 text-white backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-3 py-3 sm:px-6">
          <a href="/sport" className="font-display text-base font-black tracking-tight sm:text-lg">
            RWDNEWS SPORTS
          </a>
          <a href="/" className="text-xs font-semibold text-neutral-300">
            News home
          </a>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-3 py-5 sm:px-6 sm:py-8">
        <section className="rounded-3xl bg-neutral-950 p-5 text-white shadow-lg sm:p-9">
          <p className="text-[10px] font-black tracking-[0.2em] text-amber-400 uppercase">
            RWDNEWS Sports Centre
          </p>
          <h1 className="font-display mt-2 text-2xl font-black sm:text-5xl">{title}</h1>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-neutral-300">
            Scores, fixtures, results and short sports briefings. Tap a story to read on RWDNEWS, then
            open the full report on the publisher.
          </p>
          {data.counts ? (
            <p className="mt-3 text-[11px] text-neutral-400">
              {data.counts.matches} fixtures · {data.counts.live} live · {data.counts.results} results ·{" "}
              {data.counts.news} stories
            </p>
          ) : null}
          <div className="mt-5 flex gap-2 overflow-x-auto pb-1">
            {[
              ["/sport", "Sports"],
              ["/sport/live", "Live"],
              ["/sport/results", "Results"],
              ["/sport/fixtures", "Fixtures"],
              ["/sport/predictions", "Predict"],
            ].map(([href, label]) => (
              <a
                key={href}
                href={href}
                className={
                  path === href
                    ? "shrink-0 rounded-full bg-amber-400 px-3.5 py-2 text-xs font-black text-neutral-950"
                    : "shrink-0 rounded-full border border-neutral-700 px-3.5 py-2 text-xs font-bold text-white"
                }
              >
                {label}
              </a>
            ))}
          </div>
        </section>

        <section className="mt-5">
          <div className="flex gap-2 overflow-x-auto pb-1">
            {sports.map(([id, label, icon]) => (
              <button
                key={id}
                type="button"
                onClick={() => setSelectedSport(id)}
                className={
                  selectedSport === id
                    ? "shrink-0 rounded-full bg-neutral-950 px-3.5 py-2 text-xs font-bold text-white"
                    : "shrink-0 rounded-full border bg-white px-3.5 py-2 text-xs font-bold text-neutral-700"
                }
              >
                {icon} {label}
              </button>
            ))}
          </div>
        </section>

        <section className="mt-7">
          <div className="flex items-end justify-between border-b border-neutral-900 pb-3">
            <div>
              <p className="text-[10px] font-black tracking-[0.16em] text-red-700 uppercase">
                {mode === "live" ? "Live scoreboard" : "Match centre"}
              </p>
              <h2 className="font-display text-xl font-black sm:text-2xl">
                {mode === "live"
                  ? "Live now"
                  : mode === "results"
                    ? "Latest results"
                    : mode === "fixtures"
                      ? "Upcoming fixtures"
                      : "Matches"}
              </h2>
            </div>
            <span className="text-xs text-neutral-500">{filtered.length}</span>
          </div>
          {loading ? (
            <div className="py-10 text-sm text-neutral-500">Loading live sports data…</div>
          ) : filtered.length ? (
            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {filtered.map((m) => (
                <MatchCard key={m.id} match={m} />
              ))}
            </div>
          ) : (
            <div className="mt-5 rounded-2xl border border-dashed bg-white p-8 text-center text-sm text-neutral-500">
              No matches for this filter right now. Check sports news below.
            </div>
          )}
          <div className="mt-5">
            <AdSlot slot="sports_mid" variant="inline" label="Advertisement" className="min-h-[90px]" />
          </div>
        </section>

        <section className="mt-10">
          <div className="flex flex-wrap items-end justify-between gap-3 border-b border-neutral-900 pb-3">
            <div>
              <p className="text-[10px] font-black tracking-[0.16em] text-teal-800 uppercase">Sports desk</p>
              <h2 className="font-display text-xl font-black sm:text-2xl">Latest sports news</h2>
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
            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {stories.map((s) => {
                const isRead = readIds.has(s.id);
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => {
                      openStory(s);
                      setReadIds(loadReadIds());
                    }}
                    className={`overflow-hidden rounded-2xl border bg-white text-left shadow-sm transition active:scale-[0.99] ${
                      isRead ? "border-neutral-100 opacity-75" : "border-neutral-200"
                    }`}
                  >
                    <div className="grid grid-cols-[100px_1fr] sm:grid-cols-[120px_1fr]">
                      {s.image ? (
                        <img src={s.image} alt="" className="h-full min-h-[96px] w-full object-cover" />
                      ) : (
                        <div className="min-h-[96px] bg-neutral-100" />
                      )}
                      <div className="p-3">
                        <div className="flex items-center gap-2">
                          <p className="text-[9px] font-extrabold tracking-wider text-amber-800 uppercase">
                            {s.source}
                          </p>
                          {isRead ? (
                            <span className="text-[9px] font-bold text-neutral-400">Read</span>
                          ) : (
                            <span className="size-1.5 rounded-full bg-teal-600" title="Unread" />
                          )}
                        </div>
                        <h3 className="font-display mt-1 line-clamp-3 text-[15px] font-semibold leading-snug">
                          {s.ai_hook_title || s.original_title}
                        </h3>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            <p className="mt-6 text-sm text-neutral-500">No sports stories in this filter yet.</p>
          )}
        </section>
      </div>

      {data.live.length > 0 && mode !== "live" ? (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-neutral-800 bg-neutral-950/95 px-3 py-2.5 backdrop-blur sm:hidden">
          <a
            href="/sport/live"
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-red-600 py-2.5 text-xs font-extrabold text-white"
          >
            ● {data.live.length} live now — open scoreboard
          </a>
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
