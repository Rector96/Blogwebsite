import React, { useEffect, useMemo, useState } from "react";
import { Helmet } from "react-helmet-async";

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
  return Number.isNaN(d.getTime()) ? "Time TBA" : d.toLocaleString(undefined, {
    weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
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
    <a href={matchPath(match.id)} className="block rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex items-center justify-between gap-2 text-[10px] font-bold uppercase tracking-wide">
        <span className="truncate text-teal-800">{match.league}</span>
        <span className={match.live ? "text-red-600" : "text-neutral-400"}>{match.live ? "● LIVE" : match.status}</span>
      </div>
      <div className="mt-4 grid grid-cols-[1fr_auto] items-center gap-3">
        <div className="space-y-3 text-sm font-semibold">
          <div className="flex items-center gap-2 truncate">
            {match.homeLogo ? <img src={match.homeLogo} alt="" className="size-6 object-contain" /> : <span className="size-6 rounded-full bg-neutral-100" />}
            <span className="truncate">{match.home}</span>
          </div>
          <div className="flex items-center gap-2 truncate">
            {match.awayLogo ? <img src={match.awayLogo} alt="" className="size-6 object-contain" /> : <span className="size-6 rounded-full bg-neutral-100" />}
            <span className="truncate">{match.away}</span>
          </div>
        </div>
        <div className="text-right font-display text-lg font-bold tabular-nums">
          <div>{match.homeScore ?? "—"}</div>
          <div>{match.awayScore ?? "—"}</div>
        </div>
      </div>
      <p className="mt-4 text-[10px] text-neutral-400">{timeLabel(match.startTime)}</p>
      <p className="mt-2 text-xs font-extrabold text-teal-800">Open match centre →</p>
    </a>
  );
}

export default function SportsPage() {
  const path = typeof window !== "undefined" ? window.location.pathname : "/sport";
  const matchId = path.startsWith("/sport/match/") ? decodeURIComponent(path.slice("/sport/match/".length)) : "";
  const mode = path === "/sport/live" ? "live" : path === "/sport/results" ? "results" : path === "/sport/fixtures" ? "fixtures" : "home";

  const [data, setData] = useState<{ live: Match[]; featured: Match[]; upcoming: Match[]; results: Match[]; news: Story[]; rumors: Story[]; majorLeagues: {name:string;available:boolean}[]; bySport: Record<string, Match[]>; counts?: {matches:number;live:number;results:number;upcoming:number;news:number;rumors:number}; providers?: any }>({
    live: [], featured: [], upcoming: [], results: [], news: [], rumors: [], majorLeagues: [], bySport: {},
  });
  const [selectedSport, setSelectedSport] = useState("all");
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState<any>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [storyTab, setStoryTab] = useState<"news"|"rumors">("news");

  const load = async () => {
    setLoading(true);
    try {
      const [sportsResponse, newsResponse] = await Promise.all([
        fetch("/api/sports", { headers: { Accept: "application/json" } }),
        fetch("/api/news", { headers: { Accept: "application/json" } }),
      ]);
      if (!sportsResponse.ok) throw new Error("Sports feed unavailable");
      const sportsData = await sportsResponse.json();
      let news: Story[] = [];
      if (newsResponse.ok) {
        const newsData = await newsResponse.json();
        news = Array.isArray(newsData?.articles) ? newsData.articles.filter((a: Story) =>
          /sports|football|soccer|premier league|champions league|uefa|fifa|nba|nfl|mlb|nhl|tennis|cricket|basketball|baseball|hockey|rugby|boxing|athletics|formula 1|transfer|arsenal|chelsea|liverpool|manchester|barcelona|madrid/i.test(
            `${a.original_title} ${a.original_description} ${a.ai_hook_title}`,
          ),
        ) : [];
      }
      setData({ ...sportsData, news, rumors: news.filter((a) => /transfer|rumou?r|linked|bid|offer|talks|negotiat|target|loan/i.test(`${a.original_title} ${a.original_description}`)) });
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

  useEffect(() => { void load(); const t = window.setInterval(() => void load(), 30000); return () => window.clearInterval(t); }, []);
  useEffect(() => { if (matchId) void loadDetail(); }, [matchId]);

  const filtered = useMemo(() => {
    let source: Match[];
    if (mode === "live") source = data.live;
    else if (mode === "results") source = data.results;
    else if (mode === "fixtures") source = data.upcoming;
    else source = [...data.live, ...data.featured, ...data.upcoming];
    const unique = source.filter((m, i, arr) => arr.findIndex(x => x.id === m.id) === i);
    return unique.filter(m => selectedSport === "all" || m.sport === selectedSport).slice(0, 100);
  }, [data, mode, selectedSport]);

  if (matchId) {
    const m = detail?.match as Match | undefined;
    return (
      <main className="min-h-dvh bg-[#f4f4f2] text-neutral-950">
        <Helmet><title>{m ? `${m.home} vs ${m.away} | RWDNEWS Sports` : "Match Centre | RWDNEWS Sports"}</title><meta name="description" content="Live score, match status, timeline and verified details on RWDNEWS Sports." /></Helmet>
        <header className="border-b border-neutral-800 bg-neutral-950 text-white">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4"><a href="/sport" className="font-display font-bold">RWDNEWS SPORTS</a><a href="/" className="text-xs text-neutral-300">News home</a></div>
        </header>
        <div className="mx-auto max-w-5xl px-4 py-6 sm:py-10">
          <a href="/sport" className="text-xs font-bold text-teal-800">← Back to Sports</a>
          {detailLoading ? <div className="mt-6 rounded-2xl bg-white p-8">Loading match centre…</div> : m ? (
            <>
              <section className="mt-5 rounded-3xl bg-neutral-950 p-6 text-white shadow-xl sm:p-10">
                <p className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-amber-400">{m.league} · {m.sportLabel || m.sport}</p>
                <div className="mt-8 grid grid-cols-[1fr_auto_1fr] items-center gap-3">
                  <div className="text-center"><img src={m.homeLogo || ""} alt="" className="mx-auto size-16 object-contain" /><h1 className="mt-3 font-display text-lg font-bold sm:text-2xl">{m.home}</h1></div>
                  <div className="text-center"><div className="font-display text-3xl font-black sm:text-5xl">{scoreText(m)}</div><p className={m.live ? "mt-2 text-xs font-bold text-red-400" : "mt-2 text-xs text-neutral-400"}>{m.live ? "LIVE" : m.status}</p></div>
                  <div className="text-center"><img src={m.awayLogo || ""} alt="" className="mx-auto size-16 object-contain" /><h2 className="mt-3 font-display text-lg font-bold sm:text-2xl">{m.away}</h2></div>
                </div>
                <p className="mt-6 text-center text-xs text-neutral-400">{timeLabel(m.startTime)}{m.venue ? ` · ${m.venue}` : ""}</p>
              </section>
              <div className="mt-6 grid gap-5 lg:grid-cols-[1.5fr_1fr]">
                <section className="rounded-2xl border bg-white p-5">
                  <h2 className="font-display text-xl font-bold">Match details</h2>
                  {detail.detail?.round ? <p className="mt-3 text-sm"><strong>Round:</strong> {detail.detail.round}</p> : null}
                  {detail.detail?.referee ? <p className="mt-2 text-sm"><strong>Referee:</strong> {detail.detail.referee}</p> : null}
                  {detail.detail?.city ? <p className="mt-2 text-sm"><strong>Venue:</strong> {detail.detail.city}</p> : null}
                  {detail.detail?.events?.length ? <div className="mt-6"><h3 className="font-bold">Timeline</h3><div className="mt-3 space-y-2">{detail.detail.events.map((e:any,i:number)=><div key={i} className="flex gap-3 border-b py-2 text-sm"><span className="w-10 font-bold">{e.minute ? `${e.minute}'` : "•"}</span><span><strong>{e.type}</strong> · {e.player || e.detail}{e.assist ? ` · assist ${e.assist}` : ""}</span></div>)}</div></div> : null}
                  {detail.detail?.plays?.length ? <div className="mt-6"><h3 className="font-bold">Recent play</h3><div className="mt-3 space-y-2">{detail.detail.plays.map((p:any,i:number)=><p key={i} className="border-b py-2 text-sm"><span className="font-bold">{p.clock}</span> {p.text}</p>)}</div></div> : null}
                  {!detail.detail?.events?.length && !detail.detail?.plays?.length ? <p className="mt-3 text-sm text-neutral-500">Detailed events will appear when the provider supplies them.</p> : null}
                </section>
                <aside className="space-y-5">
                  <section className="rounded-2xl border bg-white p-5"><h2 className="font-display text-lg font-bold">About this score</h2><p className="mt-2 text-sm leading-6 text-neutral-600">RWDNEWS keeps the score and match data inside the platform. Live information is refreshed automatically.</p><a href="/sport/predictions" className="mt-4 inline-flex rounded-full bg-amber-400 px-4 py-2 text-xs font-extrabold">Open predictions →</a></section>
                </aside>
              </div>
            </>
          ) : <div className="mt-6 rounded-2xl border bg-white p-8 text-center">This match is no longer available in the live feed. Return to Sports to see the latest fixtures.</div>}
        </div>
      </main>
    );
  }

  const stories = (storyTab === "rumors" ? data.rumors : data.news).slice(0, 24);
  const title = mode === "live" ? "Live Scores" : mode === "fixtures" ? "Fixtures" : mode === "results" ? "Results" : "Sports";
  const description = mode === "home" ? "Live scores, fixtures, results, sports news and match details across major competitions." : `${title} from RWDNEWS Sports, with scores and verified match information.`;

  return (
    <main className="min-h-dvh bg-[#f4f4f2] text-neutral-950">
      <Helmet><title>{title} | RWDNEWS</title><meta name="description" content={description} /><link rel="canonical" href={`https://rwdnews.netlify.app${path}`} /></Helmet>
      <header className="border-b border-neutral-800 bg-neutral-950 text-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-4 sm:px-6"><a href="/sport" className="font-display text-lg font-black tracking-tight">RWDNEWS SPORTS</a><a href="/" className="text-xs font-semibold text-neutral-300">News home</a></div>
      </header>
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
        <section className="rounded-3xl bg-neutral-950 p-6 text-white shadow-lg sm:p-9">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-400">RWDNEWS Sports Centre</p>
          <h1 className="font-display mt-2 text-3xl font-black sm:text-5xl">{title}</h1>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-neutral-300">{description} Stay on RWDNEWS to check scores, open a match and see more detail.</p>
          <div className="mt-6 flex flex-wrap gap-2">
            {[["/sport","Sports"],["/sport/live","Live"],["/sport/fixtures","Fixtures"],["/sport/results","Results"],["/sport/predictions","Predictions"]].map(([href,label])=><a key={href} href={href} className={path===href ? "rounded-full bg-amber-400 px-4 py-2 text-xs font-black text-neutral-950" : "rounded-full border border-neutral-700 px-4 py-2 text-xs font-bold text-white"}>{label}</a>)}
          </div>
        </section>

        <section className="mt-6">
          <div className="flex gap-2 overflow-x-auto pb-1">
            {sports.map(([id,label,icon])=><button key={id} type="button" onClick={()=>setSelectedSport(id)} className={selectedSport===id ? "shrink-0 rounded-full bg-neutral-950 px-4 py-2 text-xs font-bold text-white" : "shrink-0 rounded-full border bg-white px-4 py-2 text-xs font-bold text-neutral-700"}>{icon} {label}</button>)}
          </div>
        </section>

        <section className="mt-8">
          <div className="flex items-end justify-between border-b border-neutral-900 pb-3"><div><p className="text-[10px] font-black uppercase tracking-[0.16em] text-red-700">{mode === "live" ? "Happening now" : "Match centre"}</p><h2 className="font-display text-2xl font-black">{mode === "live" ? "Live now" : "Matches"}</h2></div><span className="text-xs text-neutral-500">{filtered.length} shown</span></div>
          {loading ? <div className="py-10 text-sm text-neutral-500">Loading live sports data…</div> : filtered.length ? <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{filtered.map(m=><MatchCard key={m.id} match={m}/>)}</div> : <div className="mt-5 rounded-2xl border border-dashed bg-white p-10 text-center text-sm text-neutral-500">No matches for this filter right now.</div>}
        </section>

        {mode === "home" ? <section className="mt-12">
          <div className="flex flex-wrap items-end justify-between gap-3 border-b border-neutral-900 pb-3"><div><p className="text-[10px] font-black uppercase tracking-[0.16em] text-teal-800">Sports desk</p><h2 className="font-display text-2xl font-black">Latest sports news</h2></div><div className="flex gap-2"><button onClick={()=>setStoryTab("news")} className={storyTab==="news"?"rounded-full bg-neutral-950 px-3 py-2 text-xs font-bold text-white":"rounded-full border bg-white px-3 py-2 text-xs font-bold"}>Latest</button><button onClick={()=>setStoryTab("rumors")} className={storyTab==="rumors"?"rounded-full bg-neutral-950 px-3 py-2 text-xs font-bold text-white":"rounded-full border bg-white px-3 py-2 text-xs font-bold"}>Transfers</button></div></div>
          <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{stories.map(s=><article key={s.id} className="overflow-hidden rounded-2xl border bg-white shadow-sm">{s.image?<img src={s.image} alt="" className="aspect-[16/10] w-full object-cover"/>:<div className="aspect-[16/10] bg-neutral-100"/>}<div className="p-4"><p className="text-[10px] font-bold uppercase text-neutral-500">{s.source}</p><h3 className="font-display mt-2 text-lg font-bold leading-snug">{s.ai_hook_title||s.original_title}</h3><p className="mt-2 line-clamp-3 text-sm leading-6 text-neutral-600">{s.ai_summary?.[0]||s.original_description}</p><a href={s.original_url} target="_blank" rel="noreferrer" className="mt-3 inline-block text-xs font-black text-teal-800">Read source report →</a></div></article>)}</div>
        </section> : null}

        <section className="mt-12">
          <h2 className="font-display text-xl font-black">Competitions covered</h2>
          <div className="mt-4 flex flex-wrap gap-2">{data.majorLeagues.map(x=><span key={x.name} className={x.available?"rounded-full border border-teal-200 bg-teal-50 px-3 py-2 text-xs font-bold text-teal-900":"rounded-full border bg-white px-3 py-2 text-xs font-bold text-neutral-400"}>{x.name}</span>)}</div>
        </section>

        <p className="mt-10 text-[10px] leading-6 text-neutral-500">Scores and match information are supplied by sports data providers and refreshed automatically. RWDNEWS predictions are informational analysis, not betting advice.</p>
      </div>
    </main>
  );
}
