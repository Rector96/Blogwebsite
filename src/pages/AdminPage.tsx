import { useEffect, useState, type FormEvent } from "react";
import { Helmet } from "react-helmet-async";

type Dashboard = {
  sponsors: Array<{ id: string; sponsor_name: string; headline: string; placement: string; active: boolean; monthly_fee_usd: number | null }>;
  leads: Array<{ id: string; name: string | null; email: string; company: string | null; message: string | null; status: string; created_at: string }>;
  events: Array<{ event_name: string; day: string; event_count: number }>;
};

async function api(path: string, options?: RequestInit) {
  const response = await fetch(path, { ...options, headers: { "content-type": "application/json", ...(options?.headers || {}) } });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Request failed");
  return data;
}

export default function AdminPage() {
  const [password, setPassword] = useState("");
  const [authed, setAuthed] = useState(false);
  const [data, setData] = useState<Dashboard | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const load = async () => {
    try {
      const result = await api("/api/admin");
      setData(result);
      setAuthed(true);
      setError("");
    } catch {
      setAuthed(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const login = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await api("/api/admin", { method: "POST", body: JSON.stringify({ action: "login", password }) });
      setPassword("");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Login failed");
    }
  };

  const updateSponsor = async (id: string, active: boolean) => {
    try {
      await api("/api/admin", { method: "POST", body: JSON.stringify({ action: "sponsor_status", id, active }) });
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : "Update failed"); }
  };

  const updateLead = async (id: string, status: string) => {
    try {
      await api("/api/admin", { method: "POST", body: JSON.stringify({ action: "lead_status", id, status }) });
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : "Update failed"); }
  };

  const logout = async () => {
    setBusy(true);
    try {
      await api("/api/admin", { method: "POST", body: JSON.stringify({ action: "logout" }) });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Logout failed");
    } finally {
      setBusy(false);
      setAuthed(false);
      setData(null);
    }
  };

  if (!authed || !data) {
    return (
      <div className="grid min-h-dvh place-items-center bg-neutral-950 p-4">
        <Helmet><title>RWDNEWS Admin</title><meta name="robots" content="noindex,nofollow,noarchive" /></Helmet>
        <form onSubmit={login} className="w-full max-w-sm border border-neutral-800 bg-white p-6">
          <p className="text-[10px] font-bold tracking-[0.18em] text-amber-800 uppercase">Private</p>
          <h1 className="font-display mt-2 text-3xl font-semibold">RWDNEWS Admin</h1>
          <p className="mt-2 text-sm text-neutral-500">Sponsors, advertiser leads and engagement reporting.</p>
          <input type="password" value={password} onChange={e => setPassword(e.target.value)} className="mt-5 h-11 w-full border px-3" placeholder="Admin password" required />
          <button className="mt-3 h-11 w-full bg-neutral-950 text-sm font-bold text-white">Sign in</button>
          {error ? <p className="mt-3 text-xs text-red-700">{error}</p> : null}
        </form>
      </div>
    );
  }

  const totals = data.events.reduce<Record<string, number>>((acc, e) => {
    acc[e.event_name] = (acc[e.event_name] || 0) + Number(e.event_count);
    return acc;
  }, {});

  return (
    <div className="min-h-dvh bg-neutral-100 text-neutral-950">
      <Helmet><title>RWDNEWS Admin</title></Helmet>
      <header className="border-b bg-neutral-950 text-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-5 sm:px-6">
          <div><p className="text-[10px] font-bold tracking-[0.18em] text-amber-400 uppercase">Private dashboard</p><h1 className="font-display text-2xl font-semibold">RWDNEWS Admin</h1></div>
          <div className="flex items-center gap-2"><a href="/" className="border border-neutral-700 px-3 py-2 text-xs font-semibold text-amber-400">Open site</a><button onClick={() => void logout()} disabled={busy} className="border border-neutral-700 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">Log out</button></div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl space-y-6 px-4 py-6 sm:px-6 sm:py-8">
        {error ? <div className="border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</div> : null}
        <section><div className="mb-3 flex items-end justify-between"><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-neutral-500">Overview</p><h2 className="font-display text-2xl font-semibold">Performance</h2></div><p className="text-xs text-neutral-500">Recorded product events</p></div><div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {["article_open","article_share","article_save","newsletter_signup","sponsor_click","advertise_open"].map(k => (
            <div key={k} className="border bg-white p-4"><p className="text-[10px] font-bold uppercase text-neutral-500">{k.replace("_"," ")}</p><p className="mt-2 text-2xl font-bold">{totals[k] || 0}</p></div>
          ))}
        </div></section>
        <section className="border bg-white">
          <div className="border-b p-4"><h2 className="font-display text-xl font-semibold">Sponsors / ads</h2><p className="text-xs text-neutral-500">Only active real sponsor rows are shown publicly.</p></div>
          <div className="divide-y">
            {data.sponsors.length ? data.sponsors.map(s => (
              <div key={s.id} className="grid gap-3 p-4 md:grid-cols-[1fr_auto_auto] md:items-center">
                <div><p className="text-xs font-bold text-amber-800">{s.sponsor_name}</p><p className="font-semibold">{s.headline}</p><p className="mt-1 text-xs text-neutral-500">{s.placement} · {s.monthly_fee_usd ? "$" + s.monthly_fee_usd + "/mo" : "direct deal"}</p></div>
                <span className={s.active ? "text-xs font-bold text-teal-800" : "text-xs font-bold text-neutral-400"}>{s.active ? "ACTIVE" : "OFF"}</span>
                <button disabled={busy} onClick={() => void updateSponsor(s.id, !s.active)} className="h-9 border px-3 text-xs font-semibold disabled:opacity-50">{s.active ? "Pause" : "Activate"}</button>
              </div>
            )) : <p className="p-4 text-sm text-neutral-500">No sponsor inventory yet. Add real sponsors from Supabase or your ad network.</p>}
          </div>
        </section>
        <section className="border bg-white">
          <div className="border-b p-4"><h2 className="font-display text-xl font-semibold">Advertiser leads</h2></div>
          <div className="divide-y">
            {data.leads.length ? data.leads.map(l => (
              <div key={l.id} className="grid gap-3 p-4 md:grid-cols-[1fr_auto] md:items-center">
                <div><p className="font-semibold">{l.company || l.name || "Unnamed lead"}</p><p className="text-sm">{l.email}</p><p className="mt-1 text-xs text-neutral-500">{l.message || "Sponsorship inquiry"} · {new Date(l.created_at).toLocaleString()}</p></div>
                <select value={l.status} disabled={busy} onChange={e => void updateLead(l.id, e.target.value)} className="h-9 border px-2 text-xs disabled:opacity-50"><option>new</option><option>contacted</option><option>won</option><option>lost</option></select>
              </div>
            )) : <p className="p-4 text-sm text-neutral-500">No advertiser leads yet.</p>}
          </div>
        </section>
      </main>
    </div>
  );
}
