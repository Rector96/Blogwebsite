import React, { useEffect, useState } from "react";

type Match = {
  id: string; sport: string; league: string; home: string; away: string;
  homeScore?: number | null; awayScore?: number | null; status: string; live: boolean;
};

export default function SportsPage() {
  const [data, setData] = useState<{live: Match[]; featured: Match[]; upcoming: Match[]}>({live:[],featured:[],upcoming:[]});
  const [loading, setLoading] = useState(true);
  const [outlook, setOutlook] = useState<any>(null);

  const load = async () => {
    try {
      const r = await fetch("/api/sports");
      const d = await r.json();
      setData({ live: d.live || [], featured: d.featured || [], upcoming: d.upcoming || [] });
    } finally { setLoading(false); }
  };
  useEffect(() => { void load(); const t = window.setInterval(() => void load(), 30000); return () => window.clearInterval(t); }, []);

  const preview = async (match: Match) => {
    const r = await fetch("/api/sports?action=preview&id=" + encodeURIComponent(match.id));
    const d = await r.json();
    setOutlook(d);
  };

  const cards = [...data.live, ...data.featured, ...data.upcoming].filter((m, i, arr) => arr.findIndex(x => x.id === m.id) === i).slice(0, 40);

  return <main className="min-h-dvh bg-neutral-50 text-neutral-950">
    <header className="border-b bg-neutral-950 text-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-5 sm:px-6">
        <a href="/" className="font-display text-xl font-bold">RWDNEWS</a>
        <a href="/" className="text-xs font-semibold text-neutral-300">← Back to news</a>
      </div>
    </header>
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <p className="text-[10px] font-extrabold tracking-[0.2em] text-teal-800 uppercase">Live sports centre</p>
      <h1 className="font-display mt-1 text-3xl font-semibold sm:text-4xl">Scores, major leagues & match outlooks</h1>
      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-neutral-600">Live scores and fixtures across football, basketball, cricket and tennis, with major competitions highlighted. Data refreshes automatically.</p>

      {outlook ? <section className="mt-6 border border-teal-200 bg-white p-5">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-display text-xl font-semibold">{outlook.match?.home} vs {outlook.match?.away}</h2>
          <button onClick={() => setOutlook(null)} className="text-xs text-neutral-500">Close</button>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {["situation","factors","outlook"].map(k => <div key={k} className="bg-neutral-50 p-3"><p className="text-[10px] font-bold uppercase text-teal-800">{k}</p><p className="mt-1 text-sm leading-relaxed">{outlook[k] || "Not enough verified data."}</p></div>)}
        </div>
        <p className="mt-3 text-[10px] text-neutral-500">RWDNEWS outlook is informational only and is not a guaranteed result or betting advice.</p>
      </section> : null}

      {loading ? <p className="mt-8 text-sm text-neutral-500">Loading scores…</p> : <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map(m => <article key={m.id} className="border bg-white p-4">
          <div className="flex items-center justify-between gap-2 text-[10px] font-bold uppercase"><span className="truncate text-teal-800">{m.league}</span><span className={m.live ? "text-red-600" : "text-neutral-400"}>{m.live ? "● LIVE" : m.status}</span></div>
          <div className="mt-4 space-y-2 text-sm"><div className="flex justify-between gap-4"><span>{m.home}</span><strong>{m.homeScore ?? "–"}</strong></div><div className="flex justify-between gap-4"><span>{m.away}</span><strong>{m.awayScore ?? "–"}</strong></div></div>
          <button onClick={() => void preview(m)} className="mt-4 text-xs font-bold text-teal-800">Match outlook →</button>
        </article>)}
      </div>}

      <div className="mt-10 flex flex-wrap gap-2">{["Premier League","UEFA Champions League","La Liga","Bundesliga","Serie A","Ligue 1","NBA","NFL","MLB","NHL"].map(x => <span key={x} className="rounded-full border bg-white px-3 py-1.5 text-xs font-semibold">{x}</span>)}</div>
      <p className="mt-5 text-[10px] leading-relaxed text-neutral-500">Sports data: SportScore. Coverage depends on the provider's current feed. Major-league badges identify competitions RWDNEWS plans to surface as data is available.</p>
    </div>
  </main>;
}
