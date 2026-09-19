import React, { useEffect, useMemo, useState } from "react";

type Match = {
  id: string; sport: string; league: string; home: string; away: string;
  homeScore?: number | null; awayScore?: number | null; status: string; live: boolean;
  startTime?: string; homeLogo?: string; awayLogo?: string; source?: string;
};
type Story = {
  id: string; original_url: string; image: string; timestamp: string; source: string;
  original_title: string; original_description: string; ai_hook_title: string;
  ai_summary: string[]; category: string; story_type?: string;
};

function timeLabel(iso?: string) {
  if (!iso) return "Time TBC";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "Time TBC";
  return d.toLocaleString(undefined, { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

export default function SportsPage() {
  const [data, setData] = useState<{
    live: Match[]; featured: Match[]; upcoming: Match[]; news: Story[]; rumors: Story[];
    majorLeagues: {name: string; available: boolean}[];
  }>({live:[],featured:[],upcoming:[],news:[],rumors:[],majorLeagues:[]});
  const [loading, setLoading] = useState(true);
  const [sport, setSport] = useState("all");
  const [section, setSection] = useState("all");
  const [editorial, setEditorial] = useState<any>(null);
  const [editorialLoading, setEditorialLoading] = useState(false);

  const load = async () => {
    try {
      const r = await fetch("/api/sports", { headers: { Accept: "application/json" } });
      if (!r.ok) throw new Error("Sports feed unavailable");
      const d = await r.json();
      setData({
        live: Array.isArray(d.live) ? d.live : [],
        featured: Array.isArray(d.featured) ? d.featured : [],
        upcoming: Array.isArray(d.upcoming) ? d.upcoming : [],
        news: Array.isArray(d.news) ? d.news : [],
        rumors: Array.isArray(d.rumors) ? d.rumors : [],
        majorLeagues: Array.isArray(d.majorLeagues) ? d.majorLeagues : [],
      });
    } catch {
      setData((v) => ({...v, live: [], featured: [], upcoming: [], news: [], rumors: []}));
    } finally { setLoading(false); }
  };

  useEffect(() => {
    void load();
    const t = window.setInterval(() => void load(), 30000);
    return () => window.clearInterval(t);
  }, []);

  const openEditorial = async (story: Story) => {
    setEditorialLoading(true);
    try {
      const r = await fetch("/api/sports?action=editorial&id=" + encodeURIComponent(story.id));
      const d = await r.json();
      setEditorial(d);
    } finally {
      setEditorialLoading(false);
    }
  };

  const cards = useMemo(() => {
    const source = [...data.live, ...data.featured, ...data.upcoming]
      .filter((m, i, arr) => arr.findIndex(x => x.id === m.id) === i);
    return source.filter(m => sport === "all" || m.sport === sport).slice(0, 80);
  }, [data, sport]);

  const visibleStories = section === "rumors" ? data.rumors : data.news;

  return <main className="min-h-dvh bg-neutral-50 text-neutral-950">
    <header className="border-b bg-neutral-950 text-white">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-5 sm:px-6">
        <a href="/" className="font-display text-xl font-bold">RWDNEWS</a>
        <a href="/" className="text-xs font-semibold text-neutral-300">← Back to news</a>
      </div>
    </header>

    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <p className="text-[10px] font-extrabold tracking-[0.2em] text-teal-800 uppercase">RWDNEWS Sports</p>
      <div className="mt-1 flex flex-col justify-between gap-3 md:flex-row md:items-end">
        <div>
          <h1 className="font-display text-3xl font-semibold sm:text-5xl">Sports Desk</h1>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-neutral-600">
            Live scores, fixtures, major leagues, source-backed sports news, transfer reports and detailed RWDNEWS editorial briefings — all kept separate from the general news wire.
          </p>
        </div>
        <span className="border border-neutral-200 bg-white px-3 py-2 text-[10px] font-bold uppercase text-neutral-500">Updated automatically</span>
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
        {[["all","All Sports"],["football","Football"],["basketball","Basketball"],["cricket","Cricket"],["tennis","Tennis"]].map(([id,label]) =>
          <button key={id} onClick={() => setSport(id)} className={sport === id ? "rounded-full bg-neutral-950 px-3 py-1.5 text-xs font-bold text-white" : "rounded-full border bg-white px-3 py-1.5 text-xs font-semibold"}>{label}</button>
        )}
      </div>

      {editorial ? <section className="mt-8 border border-teal-200 bg-white p-5 sm:p-7">
        <div className="flex items-start justify-between gap-4 border-b pb-4">
          <div>
            <p className="text-[10px] font-extrabold tracking-[0.18em] text-teal-800 uppercase">RWDNEWS Sports Editorial</p>
            <h2 className="font-display mt-1 text-2xl font-semibold sm:text-3xl">{editorial.headline}</h2>
            <p className="mt-2 text-sm leading-relaxed text-neutral-600">{editorial.summary}</p>
          </div>
          <button onClick={() => setEditorial(null)} className="shrink-0 text-xs font-semibold text-neutral-500">Close</button>
        </div>
        <div className="mt-6 space-y-6">
          {(Array.isArray(editorial.sections) ? editorial.sections : []).map((s: any, i: number) =>
            <section key={i}>
              <h3 className="font-display text-lg font-semibold">{s.title}</h3>
              <p className="mt-2 whitespace-pre-line text-[15px] leading-8 text-neutral-700">{s.body}</p>
            </section>
          )}
        </div>
        <div className="mt-7 border-t pt-4 text-xs text-neutral-500">
          Source: <strong>{editorial.source}</strong>. RWDNEWS editorial is source-bounded and does not treat rumors as confirmed facts.
          {editorial.sourceUrl ? <>{" "} <a href={editorial.sourceUrl} target="_blank" rel="noopener noreferrer" className="font-semibold underline">Read the original report →</a></> : null}
        </div>
      </section> : null}

      {editorialLoading ? <div className="mt-5 border border-teal-100 bg-teal-50 p-4 text-sm text-teal-900">Preparing the source-backed editorial…</div> : null}

      <section className="mt-8">
        <div className="flex items-center justify-between border-b border-neutral-900 pb-2">
          <div>
            <p className="text-[10px] font-extrabold tracking-[0.18em] text-red-700 uppercase">Live & recent</p>
            <h2 className="font-display text-2xl font-semibold">Scores & fixtures</h2>
          </div>
          <span className="text-[10px] font-semibold text-neutral-500">{data.live.length} live</span>
        </div>

        {loading ? <p className="mt-6 text-sm text-neutral-500">Loading global sports feeds…</p> :
          cards.length ? <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {cards.map(m => <article key={m.id} className="border bg-white p-4">
              <div className="flex items-center justify-between gap-2 text-[9px] font-bold uppercase">
                <span className="truncate text-teal-800">{m.league}</span>
                <span className={m.live ? "text-red-600" : "text-neutral-400"}>{m.live ? "● LIVE" : m.status}</span>
              </div>
              <div className="mt-4 space-y-3 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <span className="flex min-w-0 items-center gap-2 truncate"><img src={m.homeLogo || ""} alt="" className={m.homeLogo ? "size-5 object-contain" : "hidden"} />{m.home}</span>
                  <strong>{m.homeScore ?? "–"}</strong>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="flex min-w-0 items-center gap-2 truncate"><img src={m.awayLogo || ""} alt="" className={m.awayLogo ? "size-5 object-contain" : "hidden"} />{m.away}</span>
                  <strong>{m.awayScore ?? "–"}</strong>
                </div>
              </div>
              <p className="mt-3 text-[10px] text-neutral-400">{timeLabel(m.startTime)}</p>
            </article>)}
          </div> :
          <div className="mt-4 border border-dashed bg-white p-8 text-center">
            <p className="font-display text-lg font-semibold">No match board is reporting right now.</p>
            <p className="mt-1 text-sm text-neutral-500">The editorial sports wire remains available below; RWDNEWS will not invent fixtures or scores.</p>
          </div>
        }
      </section>

      <section className="mt-10">
        <div className="flex flex-wrap items-end justify-between gap-3 border-b border-neutral-900 pb-2">
          <div>
            <p className="text-[10px] font-extrabold tracking-[0.18em] text-teal-800 uppercase">Sports journalism</p>
            <h2 className="font-display text-2xl font-semibold">News, reports & analysis</h2>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setSection("all")} className={section === "all" ? "bg-neutral-950 px-3 py-1.5 text-xs font-bold text-white" : "border bg-white px-3 py-1.5 text-xs font-semibold"}>Latest</button>
            <button onClick={() => setSection("rumors")} className={section === "rumors" ? "bg-neutral-950 px-3 py-1.5 text-xs font-bold text-white" : "border bg-white px-3 py-1.5 text-xs font-semibold"}>Transfers & reports</button>
          </div>
        </div>

        {visibleStories.length ? <div className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {visibleStories.map(story =>
            <article key={story.id} className="overflow-hidden border bg-white">
              <img src={story.image} alt="" className="aspect-[16/10] w-full object-cover" />
              <div className="p-4">
                <div className="flex items-center justify-between gap-2 text-[9px] font-bold uppercase text-neutral-500">
                  <span>{story.source}</span>
                  <span>{new Date(story.timestamp).toLocaleDateString()}</span>
                </div>
                <h3 className="font-display mt-2 text-lg font-semibold leading-snug">{story.ai_hook_title || story.original_title}</h3>
                <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-neutral-600">{story.ai_summary?.[0] || story.original_description}</p>
                <button onClick={() => void openEditorial(story)} className="mt-4 text-xs font-extrabold text-teal-800">Read detailed RWDNEWS editorial →</button>
              </div>
            </article>
          )}
        </div> :
          <div className="mt-5 border border-dashed bg-white p-8 text-center text-sm text-neutral-500">No source-backed stories are available in this section yet. RWDNEWS will not manufacture sports news or rumors.</div>
        }
      </section>

      <section className="mt-10">
        <div className="border-b border-neutral-900 pb-2">
          <p className="text-[10px] font-extrabold tracking-[0.18em] text-amber-700 uppercase">Major competitions</p>
          <h2 className="font-display text-2xl font-semibold">League coverage</h2>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {data.majorLeagues.map(x => <span key={x.name} className={x.available ? "rounded-full border border-teal-200 bg-teal-50 px-3 py-1.5 text-xs font-semibold text-teal-900" : "rounded-full border bg-white px-3 py-1.5 text-xs font-semibold text-neutral-400"}>{x.name}{x.available ? " · feed" : " · awaiting feed"}</span>)}
        </div>
      </section>

      <p className="mt-8 text-[10px] leading-relaxed text-neutral-500">
        Sports scores are supplied by SportScore and ESPN feeds; news is source-backed. SportScore requires visible attribution for its free API tier. RWDNEWS does not fabricate scores, fixtures, injuries, odds or rumor confirmations.
      </p>
    </div>
  </main>;
}
