import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { Helmet } from "react-helmet-async";
import { BarChart3, Copy, DollarSign, Globe2, LogOut, Megaphone, Newspaper, Settings, Share2, ShieldCheck, Users, Search } from "lucide-react";
import RichArticleEditor from "../components/RichArticleEditor";

type Dashboard = {
  generated_at: string;
  overview: Record<string, number>;
  daily: Array<{ day: string; value: number }>;
  sources: Array<{ label: string; value: number }>;
  countries: Array<{ label: string; value: number }>;
  cities: Array<{ label: string; value: number }>;
  devices: Array<{ label: string; value: number }>;
  browsers: Array<{ label: string; value: number }>;
  top_paths: Array<{ label: string; value: number }>;
  top_articles: Array<{ id: string; views: number; article: any }>;
  engagement?: { recommendation_impressions: number; recommendation_clicks: number; recommendation_ctr: number; engaged_reads: number; return_visits: number; returning_sessions: number; search_events: number; external_source_clicks: number; };
  sponsors: any[];
  leads: any[];
  payments: any[];
  articles: any[];
  audit_logs: any[];
};

const tabs = [
  ["dashboard", "Dashboard", BarChart3],
  ["news", "News", Newspaper],
  ["research", "Research", Search],
  ["social", "Social", Share2],
  ["analytics", "Analytics", Globe2],
  ["monetization", "Monetization", DollarSign],
  ["audience", "Audience", Users],
  ["newsletter", "Newsletter", Megaphone],
  ["security", "Security", ShieldCheck],
  ["settings", "Settings", Settings],
] as const;

async function api(options?: RequestInit) {
  const response = await fetch("/api/admin", {
    credentials: "same-origin",
    ...options,
    headers: { "content-type": "application/json", ...(options?.headers || {}) },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Request failed");
  return data;
}
const money = (value: number) => "$" + Number(value || 0).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
const number = (value: number) => Number(value || 0).toLocaleString("en-US");

export default function AdminPage() {
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [authed, setAuthed] = useState(false);
  const [data, setData] = useState<Dashboard | null>(null);
  const [tab, setTab] = useState("dashboard");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<string>("");
  const [copied, setCopied] = useState("");
  const [researchTopic, setResearchTopic] = useState("");
  const [researchMode, setResearchMode] = useState<"news" | "documentary">("news");
  const [researchResult, setResearchResult] = useState<any>(null);
  const [sponsorForm, setSponsorForm] = useState({ sponsor_name: "", headline: "", cta_url: "", cta_text: "Learn more", placement: "sidebar", currency: "USD", amount: "75", duration_months: "1", disclosure: "Sponsored · Paid placement" });
  const [editingArticleId, setEditingArticleId] = useState<string | null>(null);\n  const [editingArticleBusy, setEditingArticleBusy] = useState(false);\n  const [storyForm, setStoryForm] = useState({
    headline: "", description: "", body: "", category: "Business", region: "Global",
    story_type: "RockBrief ORIGINAL", subject: "", author_name: "RockBrief Editorial",
    image: "", image_credit: "RockBrief", image_license: "Owned or licensed by RockBrief",
    image_source_url: "", original_url: "", tags: "", publish_at: "", editorial_status: "published",
    featured: false, pinned: false,
  });

  const load = async (showError = false) => {
    try {
      const result = await api();
      setData(result);
      setLastUpdated(String(result.generated_at || new Date().toISOString()));
      setAuthed(true);
      setError("");
      return true;
    } catch (e) {
      setAuthed(false);
      setData(null);
      if (showError) setError(e instanceof Error ? e.message : "The admin dashboard could not be loaded.");
      return false;
    }
  };
  useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const post = async (body: Record<string, unknown>) => {
    setBusy(true);
    try { await api({ method: "POST", body: JSON.stringify(body) }); await load(); }
    catch (e) { setError(e instanceof Error ? e.message : "Action failed"); }
    finally { setBusy(false); }
  };

  const login = async (e: FormEvent) => {
    e.preventDefault(); setBusy(true); setError("");
    try {
      await api({ method: "POST", body: JSON.stringify({ action: "login", password }) });
      setPassword("");
      const loaded = await load(true);
      if (!loaded) setError((current) => current || "Sign-in succeeded, but the admin dashboard session could not be loaded. Please refresh and try again.");
    } catch (e) { setError(e instanceof Error ? e.message : "Login failed"); }
    finally { setBusy(false); }
  };

  const addSponsor = async (e: FormEvent) => {
    e.preventDefault();
    await post({ action: "sponsor_create", ...sponsorForm, currency: "USD", amount: Number(sponsorForm.amount || 0), duration_months: Number(sponsorForm.duration_months || 1) });
    setSponsorForm({ sponsor_name: "", headline: "", cta_url: "", cta_text: "Learn more", placement: "sidebar", currency: "USD", amount: "75", duration_months: "1", disclosure: "Sponsored · Paid placement" });
  };

  const uploadStoryImage = async (file: File): Promise<string | null> => {
    if (!["image/jpeg","image/png","image/webp","image/avif"].includes(file.type)) { setError("Use JPG, PNG, WebP or AVIF."); return null; }
    if (file.size > 5 * 1024 * 1024) { setError("Image must be 5 MB or smaller."); return null; }
    setBusy(true); setError("");
    try {
      const data = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ""));
        reader.onerror = () => reject(new Error("Could not read image."));
        reader.readAsDataURL(file);
      });
      const result = await api({ method: "POST", body: JSON.stringify({ action: "article_image_upload", filename: file.name, mime_type: file.type, data }) });
      const url = String(result.url || "");
      setStoryForm(v => ({ ...v, image: url }));
      return url || null;
    } catch (e) { setError(e instanceof Error ? e.message : "Image upload failed"); return null; }
    finally { setBusy(false); }
  };

  const runResearch = async () => {
    if (!researchTopic.trim()) { setError("Enter a topic to research."); return; }
    setBusy(true); setError(""); setResearchResult(null);
    try {
      const response = await fetch("/api/research?topic=" + encodeURIComponent(researchTopic.trim()) + "&mode=" + researchMode, { credentials: "same-origin" });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "Research failed.");
      setResearchResult(result);
    } catch (e) { setError(e instanceof Error ? e.message : "Research failed."); }
    finally { setBusy(false); }
  };

  const useResearchAsStory = () => {
    const report = researchResult?.report;
    if (!report?.headline) {
      setError("Run a research report first.");
      return;
    }
    const sourceList = Array.isArray(researchResult.sources) ? researchResult.sources : [];
    const sourceLine = sourceList.length
      ? "Sources researched: " + sourceList.slice(0, 8).map((s: any, i: number) => (i + 1) + ". " + s.source + " — " + s.url).join("\n")
      : "";
    const body = [
      report.summary || "",
      ...(Array.isArray(report.sections) ? report.sections.map((s: any) => "## " + s.title + "\n\n" + s.body) : []),
      sourceLine,
      "RockBrief editorial note: This report was prepared from the source records shown in the Research Desk. Review the sources and verify the facts before publishing.",
    ].filter(Boolean).join("\n\n");
    const firstSource = sourceList[0];
    setStoryForm(v => ({
      ...v,
      headline: report.headline,
      description: report.summary || "",
      body,
      story_type: researchResult.mode === "news" ? "DEVELOPING" : "RockBrief ORIGINAL",
      original_url: firstSource?.url || "",
      image: "",
      image_credit: "",
      image_license: "",
      image_source_url: "",
      tags: "",
      editorial_status: "draft",
      featured: false,
      pinned: false,
    }));
    setTab("news");
    setError("");
  };

  const createStory = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    await post({
      action: "article_create",
      ...storyForm,
      tags: storyForm.tags.split(",").map(x => x.trim()).filter(Boolean),
    });
    setStoryForm({
      headline: "", description: "", body: "", category: "Business", region: "Global",
      story_type: "RockBrief ORIGINAL", subject: "", author_name: "RockBrief Editorial",
      image: "", image_credit: "RockBrief", image_license: "Owned or licensed by RockBrief",
      image_source_url: "", original_url: "", tags: "", publish_at: "", editorial_status: "published",
      featured: false, pinned: false,
    });
  };

  const editArticle = async (id: string) => {
    setEditingArticleBusy(true); setError("");
    try {
      const result = await api({ method: "POST", body: JSON.stringify({ action: "article_get", id }) });
      const a = result.article;
      setEditingArticleId(String(a.id));
      setStoryForm({
        headline: String(a.original_title || ""),
        description: String(a.original_description || ""),
        body: String(a.body || ""),
        category: String(a.category || "Business"),
        region: String(a.region || "Global"),
        story_type: String(a.story_type || "RockBrief ORIGINAL"),
        subject: String(a.subject || ""),
        author_name: String(a.author_name || "RockBrief Editorial"),
        image: String(a.image || ""),
        image_credit: String(a.image_credit || ""),
        image_license: String(a.image_license || ""),
        image_source_url: String(a.image_source_url || ""),
        original_url: String(a.original_url || ""),
        tags: Array.isArray(a.tags) ? a.tags.map((x: unknown) => String(x).replace(/^#/, "")).join(", ") : "",
        publish_at: a.timestamp ? new Date(a.timestamp).toISOString().slice(0,16) : "",
        editorial_status: a.editorial_status === "hidden" ? "draft" : String(a.editorial_status || "published"),
        featured: Boolean(a.featured), pinned: Boolean(a.pinned),
      });
      setTab("news");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (e) { setError(e instanceof Error ? e.message : "Could not load article."); }
    finally { setEditingArticleBusy(false); }
  };

  const saveEditedStory = async (e: FormEvent) => {
    e.preventDefault();
    if (!editingArticleId) return;
    setError("");
    await post({
      action: "article_update",
      id: editingArticleId,
      ...storyForm,
      tags: storyForm.tags.split(",").map(x => x.trim()).filter(Boolean),
      editorial_status: storyForm.editorial_status === "draft" ? "hidden" : storyForm.editorial_status,
    });
    setEditingArticleId(null);
    setStoryForm({
      headline: "", description: "", body: "", category: "Business", region: "Global",
      story_type: "RockBrief ORIGINAL", subject: "", author_name: "RockBrief Editorial",
      image: "", image_credit: "RockBrief", image_license: "Owned or licensed by RockBrief",
      image_source_url: "", original_url: "", tags: "", publish_at: "", editorial_status: "published",
      featured: false, pinned: false,
    });
  };

  const logout = async () => {
    await post({ action: "logout" });
    setAuthed(false); setData(null);
  };

  const activeSponsors = data?.sponsors.filter(s => s.active).length || 0;
  const pendingLeads = data?.leads.filter(l => l.status === "new").length || 0;
  const pendingPayments = data?.payments.filter(p => p.status === "pending").length || 0;
  const topCountries = useMemo(() => data?.countries.slice(0, 8) || [], [data]);
  const topSources = useMemo(() => data?.sources.slice(0, 8) || [], [data]);

  if (!authed || !data) {
    return <div className="grid min-h-dvh place-items-center bg-neutral-950 p-4">
      <Helmet><title>RockBrief Admin</title><meta name="robots" content="noindex,nofollow,noarchive" /></Helmet>
      <form onSubmit={login} className="w-full max-w-sm border border-neutral-800 bg-white p-6 shadow-2xl">
        <p className="text-[10px] font-bold tracking-[0.18em] text-amber-800 uppercase">Private operations</p>
        <h1 className="font-display mt-2 text-3xl font-semibold">RockBrief Admin</h1>
        <p className="mt-2 text-sm text-neutral-500">News, audience, sponsors, payments and platform operations.</p>
        <div className="relative mt-5"><input type={showPassword ? "text" : "password"} value={password} onChange={e => setPassword(e.target.value)} className="h-11 w-full border px-3 pr-20" placeholder="Admin password" autoComplete="current-password" required /><button type="button" onClick={() => setShowPassword(v => !v)} className="absolute top-1/2 right-2 -translate-y-1/2 px-2 py-1 text-xs font-semibold text-neutral-500">{showPassword ? "Hide" : "Show"}</button></div>
        <button disabled={busy} className="mt-3 h-11 w-full bg-neutral-950 text-sm font-bold text-white disabled:opacity-50">Sign in</button>
        {error ? <p className="mt-3 text-xs text-red-700">{error}</p> : null}
      </form>
    </div>;
  }

  return <div className="min-h-dvh bg-neutral-100 text-neutral-950">
    <Helmet><title>RockBrief Admin</title></Helmet>
    <header className="sticky top-0 z-40 border-b bg-neutral-950 text-white">
      <div className="mx-auto flex max-w-[1500px] items-center justify-between gap-4 px-4 py-4 sm:px-6">
        <div><p className="text-[10px] font-bold tracking-[0.18em] text-amber-400 uppercase">Private operations</p><h1 className="font-display text-xl font-semibold sm:text-2xl">RockBrief Admin</h1></div>
        <div className="flex items-center gap-2"><a href="/" className="border border-neutral-700 px-3 py-2 text-xs font-semibold text-amber-400">Open site</a><button onClick={() => void logout()} disabled={busy} className="grid size-9 place-items-center border border-neutral-700"><LogOut className="size-4" /></button></div>
      </div>
      <nav className="mx-auto flex max-w-[1500px] gap-1 overflow-x-auto px-3 pb-3 sm:px-5" aria-label="Admin sections">
        {tabs.map(([id, label, Icon]) => <button key={id} onClick={() => setTab(id)} className={tab === id ? "flex shrink-0 items-center gap-2 rounded-full bg-white px-3 py-2 text-xs font-bold text-neutral-950" : "flex shrink-0 items-center gap-2 rounded-full px-3 py-2 text-xs font-semibold text-neutral-400 hover:bg-neutral-800 hover:text-white"}><Icon className="size-3.5" />{label}</button>)}
      </nav>
    </header>

    <main className="mx-auto max-w-[1500px] space-y-6 px-4 py-5 sm:px-6 sm:py-7">
      {error ? <div className="border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</div> : null}

      {tab === "dashboard" ? <section className="space-y-6">
        <PageHeading title="Dashboard" subtitle={lastUpdated ? `Live data · updated ${new Date(lastUpdated).toLocaleTimeString()}` : "Loading live data…"} />
        <MetricGrid overview={data.overview} />
        {data.engagement ? <EngagementPanel data={data.engagement} /> : null}
        <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
          <Panel title="Daily page views" subtitle="Last 30 days"><DailyChart data={data.daily} /></Panel>
          <Panel title="Traffic sources" subtitle="Where readers arrive from"><Bars data={topSources} /></Panel>
        </div>
        <div className="grid gap-6 lg:grid-cols-3">
          <Panel title="Top countries"><Bars data={topCountries} /></Panel>
          <Panel title="Top stories"><div className="divide-y">{data.top_articles.slice(0,8).map((x) => <div key={x.id} className="py-3"><p className="text-xs text-neutral-500">{number(x.views)} views</p><p className="font-semibold">{x.article?.ai_hook_title || x.article?.original_title || x.id}</p></div>)}</div></Panel>
          <Panel title="Operations"><div className="space-y-3 text-sm"><StatusLine label="Active sponsors" value={number(activeSponsors)} /><StatusLine label="New advertiser leads" value={number(pendingLeads)} /><StatusLine label="Pending payments" value={number(pendingPayments)} /><StatusLine label="Newsletter subscribers" value={number(data.overview.newsletter_subscribers)} /></div></Panel>
        </div>
      </section> : null}

      {tab === "research" ? <section className="space-y-6">
        <PageHeading title="Research desk" subtitle="Research live topics before turning them into an RockBrief report or documentary. Only the admin can run this desk." />
        <Panel title="Research a topic" subtitle="The desk collects current source reports, then creates a source-bounded draft. It does not invent facts or treat headlines as proof.">
          <div className="grid gap-3 md:grid-cols-[1fr_auto_auto]">
            <input value={researchTopic} onChange={e=>setResearchTopic(e.target.value)} placeholder="Example: Dangote investment / Mossad history" className="h-11 border px-3 text-sm" onKeyDown={e=>{if(e.key==="Enter") void runResearch()}} />
            <select value={researchMode} onChange={e=>setResearchMode(e.target.value as "news" | "documentary")} className="h-11 border px-3 text-sm"><option value="news">Current news</option><option value="documentary">Documentary / explainer</option></select>
            <button type="button" disabled={busy} onClick={()=>void runResearch()} className="h-11 bg-neutral-950 px-5 text-xs font-bold text-white disabled:opacity-50">{busy ? "Researching…" : "Research now"}</button>
          </div>
        </Panel>
        {researchResult ? <div className="grid gap-6 lg:grid-cols-[1.3fr_0.7fr]">
          <Panel title={researchResult.report?.headline || researchResult.topic} subtitle={researchResult.report?.confidence || "Research draft"}>
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <button type="button" onClick={useResearchAsStory} className="bg-neutral-950 px-4 py-2 text-xs font-bold text-white">Use as RockBrief Report Draft</button>
              <span className="text-xs text-neutral-500">Review sources and facts before publishing.</span>
            </div>
            <p className="text-sm leading-relaxed text-neutral-700">{researchResult.report?.summary}</p>
            <div className="mt-5 space-y-5">{(researchResult.report?.sections || []).map((s:any,i:number)=><article key={i} className="border-t pt-4"><h3 className="font-display text-lg font-semibold">{s.title}</h3><p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-neutral-700">{s.body}</p><p className="mt-2 text-[10px] font-bold uppercase tracking-wider text-neutral-400">Sources: {(s.source_refs || []).join(", ") || "Not specified"}</p></article>)}</div>
          </Panel>
          <Panel title={researchResult.sourceCount + " source reports"} subtitle="Open the original source before publishing.">
            <div className="max-h-[650px] space-y-3 overflow-auto">{(researchResult.sources || []).map((s:any,i:number)=><a key={i} href={s.url} target="_blank" rel="noopener noreferrer" className="block border-b pb-3"><p className="text-xs font-semibold">{i+1}. {s.title}</p><p className="mt-1 text-[10px] text-neutral-500">{s.source} · {s.date || "date not supplied"}</p></a>)}</div>
          </Panel>
        </div> : null}
      </section> : null}

      {tab === "news" ? <section className="space-y-6">
        <PageHeading title="News operations" subtitle="Publish original RockBrief stories and manage the source-backed wire." />
        <Panel title={editingArticleId ? "Edit article" : "Create a story"} subtitle={editingArticleId ? "Update the complete article, metadata, image rights and publication state." : "Use this for original reporting, interviews, analysis or verified announcements. Published stories appear in the public feed immediately."}>
          <form onSubmit={editingArticleId ? saveEditedStory : createStory} className="grid gap-3 md:grid-cols-2">
            <input required placeholder="Headline" value={storyForm.headline} onChange={e=>setStoryForm(v=>({...v,headline:e.target.value}))} className="h-11 border px-3 text-sm md:col-span-2" />
            <textarea required placeholder="Short description / lead" value={storyForm.description} onChange={e=>setStoryForm(v=>({...v,description:e.target.value}))} className="min-h-24 border p-3 text-sm md:col-span-2" />
            <div className="md:col-span-2"><label className="mb-2 block text-xs font-bold uppercase tracking-wide text-neutral-500">Article editor</label><RichArticleEditor value={storyForm.body} onChange={body=>setStoryForm(v=>({...v,body}))} onImageUpload={uploadStoryImage} placeholder="Write or paste the full article here…" /></div>
            <select value={storyForm.category} onChange={e=>setStoryForm(v=>({...v,category:e.target.value}))} className="h-11 border px-3 text-sm"><option>Business</option><option>World</option><option>Europe</option><option>Middle East</option><option>Asia</option><option>Africa</option><option>Nigeria</option><option>Ghana</option><option>Sports</option><option>Tech</option><option>Crypto</option><option>Entertainment</option></select>
            <select value={storyForm.region} onChange={e=>setStoryForm(v=>({...v,region:e.target.value}))} className="h-11 border px-3 text-sm"><option>Global</option><option>Africa</option><option>Nigeria</option><option>Ghana</option><option>Europe</option><option>Middle East</option><option>Asia</option><option>North America</option><option>South America</option></select>
            <select value={storyForm.story_type} onChange={e=>setStoryForm(v=>({...v,story_type:e.target.value}))} className="h-11 border px-3 text-sm"><option>RockBrief ORIGINAL</option><option>DEVELOPING</option><option>WIRE</option></select>
            <input placeholder="Person / company / event" value={storyForm.subject} onChange={e=>setStoryForm(v=>({...v,subject:e.target.value}))} className="h-11 border px-3 text-sm" />
            <input placeholder="Author" value={storyForm.author_name} onChange={e=>setStoryForm(v=>({...v,author_name:e.target.value}))} className="h-11 border px-3 text-sm" />
            <div className="space-y-2 md:col-span-2">
              <label className="block text-xs font-bold uppercase tracking-wide text-neutral-500">Main image</label>
              <input type="file" accept="image/jpeg,image/png,image/webp,image/avif" disabled={busy} onChange={e=>{const f=e.target.files?.[0]; if(f) void uploadStoryImage(f)}} className="block w-full border p-3 text-sm" />
              <input required type="url" placeholder="Or paste an image URL" value={storyForm.image} onChange={e=>setStoryForm(v=>({...v,image:e.target.value}))} className="h-11 w-full border px-3 text-sm" />
              {storyForm.image ? <img src={storyForm.image} alt="Story preview" className="max-h-56 w-full rounded object-cover" /> : null}
              <p className="text-xs text-neutral-500">Maximum 5 MB. Use only images you own, licensed, or have permission to publish.</p>
            </div>
            <input placeholder="Image credit" value={storyForm.image_credit} onChange={e=>setStoryForm(v=>({...v,image_credit:e.target.value}))} className="h-11 border px-3 text-sm" />
            <input placeholder="Image licence / rights note" value={storyForm.image_license} onChange={e=>setStoryForm(v=>({...v,image_license:e.target.value}))} className="h-11 border px-3 text-sm" />
            <input type="url" placeholder="Image source URL (optional)" value={storyForm.image_source_url} onChange={e=>setStoryForm(v=>({...v,image_source_url:e.target.value}))} className="h-11 border px-3 text-sm" />
            <input type="url" placeholder="Original/source article URL (optional)" value={storyForm.original_url} onChange={e=>setStoryForm(v=>({...v,original_url:e.target.value}))} className="h-11 border px-3 text-sm" />
            <input placeholder="Tags, separated by commas" value={storyForm.tags} onChange={e=>setStoryForm(v=>({...v,tags:e.target.value}))} className="h-11 border px-3 text-sm" />
            <input type="datetime-local" value={storyForm.publish_at} onChange={e=>setStoryForm(v=>({...v,publish_at:e.target.value}))} className="h-11 border px-3 text-sm" />
            <div className="flex flex-wrap items-center gap-4 border p-3 text-xs md:col-span-2">
              <label className="flex items-center gap-2"><input type="checkbox" checked={storyForm.featured} onChange={e=>setStoryForm(v=>({...v,featured:e.target.checked}))} /> Feature on homepage</label>
              <label className="flex items-center gap-2"><input type="checkbox" checked={storyForm.pinned} onChange={e=>setStoryForm(v=>({...v,pinned:e.target.checked}))} /> Pin story</label>
              <select value={storyForm.editorial_status} onChange={e=>setStoryForm(v=>({...v,editorial_status:e.target.value}))} className="h-9 border px-2"><option value="published">Publish now</option><option value="draft">Save as draft</option></select>
            </div>
            <button disabled={busy} className="h-12 bg-neutral-950 px-5 text-xs font-bold text-white md:col-span-2">{editingArticleId ? "Save article changes" : storyForm.editorial_status === "draft" ? "Save draft" : "Publish story"}</button>
            <p className="text-xs text-neutral-500 md:col-span-2">Image rights: only use images you own, licensed, or are otherwise permitted to publish. The source/credit fields are displayed on the story.</p>
          </form>
        </Panel>
        <Panel title="Latest stories" subtitle="Hide, archive, feature or pin a story."><div className="divide-y">{data.articles.map(a => <div key={a.id} className="grid gap-3 py-4 lg:grid-cols-[1fr_auto] lg:items-center"><div><p className="text-[10px] font-bold uppercase tracking-wider text-amber-800">{a.source} · {a.story_type || "WIRE"} · {a.category || "News"} · {new Date(a.timestamp).toLocaleString()}</p><p className="mt-1 font-display text-lg font-semibold">{a.ai_hook_title || a.original_title}</p><p className="text-xs text-neutral-500">{a.editorial_status || "published"}{a.featured ? " · featured" : ""}{a.pinned ? " · pinned" : ""}</p></div><div className="flex flex-wrap gap-2"><button disabled={busy || editingArticleBusy} type="button" onClick={() => void editArticle(a.id)} className="border px-3 py-2 text-xs font-semibold">{editingArticleBusy ? "Loading…" : "Edit"}</button><button disabled={busy} onClick={() => void post({ action:"article_update", id:a.id, featured:!a.featured }) className="border px-3 py-2 text-xs font-semibold">{a.featured ? "Unfeature" : "Feature"}</button><button disabled={busy} onClick={() => void post({ action:"article_update", id:a.id, pinned:!a.pinned })} className="border px-3 py-2 text-xs font-semibold">{a.pinned ? "Unpin" : "Pin"}</button><select value={a.editorial_status || "published"} disabled={busy} onChange={e => void post({ action:"article_update", id:a.id, editorial_status:e.target.value })} className="border px-2 py-2 text-xs"><option>published</option><option>hidden</option><option>archived</option></select></div></div>)}</div></Panel>
      </section> : null}

      {tab === "social" ? <SocialPanel articles={data.articles} copied={copied} onCopy={async (label, text) => { try { await navigator.clipboard.writeText(text); setCopied(label); window.setTimeout(() => setCopied(""), 1800); } catch { setCopied("Copy failed"); } }} /> : null}

      {tab === "analytics" ? <section className="space-y-6">
        <PageHeading title="Analytics" subtitle="Traffic, engagement and acquisition over the recorded period." />
        <MetricGrid overview={data.overview} />
        {data.engagement ? <EngagementPanel data={data.engagement} /> : null}
        <div className="grid gap-6 lg:grid-cols-2"><Panel title="Daily traffic"><DailyChart data={data.daily} /></Panel><Panel title="Traffic sources"><Bars data={data.sources} /></Panel><Panel title="Countries"><Bars data={data.countries} /></Panel><Panel title="Top pages"><Bars data={data.top_paths} /></Panel></div>
      </section> : null}

      {tab === "audience" ? <section className="space-y-6">
        <PageHeading title="Audience" subtitle="Understand who is reading RockBrief and how they reach it." />
        <div className="grid gap-6 lg:grid-cols-2"><Panel title="Countries"><Bars data={data.countries} /></Panel><Panel title="Cities"><Bars data={data.cities} /></Panel><Panel title="Devices"><Bars data={data.devices} /></Panel><Panel title="Browsers"><Bars data={data.browsers} /></Panel></div>
      </section> : null}

      {tab === "monetization" ? <section className="space-y-6">
        <PageHeading title="Monetization" subtitle="All sponsor inventory, advertiser leads and USD payments." />
        <MetricGrid overview={data.overview} moneyMetric="paid_revenue_usd" />
        <Panel title="Add a direct sponsor" subtitle="Direct deals can be created here, then activated after the deal is confirmed."><form onSubmit={addSponsor} className="grid gap-3 md:grid-cols-2 lg:grid-cols-4"><input required placeholder="Brand / company" value={sponsorForm.sponsor_name} onChange={e=>setSponsorForm(v=>({...v,sponsor_name:e.target.value}))} className="h-10 border px-3 text-sm" /><input required placeholder="Campaign headline" value={sponsorForm.headline} onChange={e=>setSponsorForm(v=>({...v,headline:e.target.value}))} className="h-10 border px-3 text-sm" /><input required type="url" placeholder="Website URL" value={sponsorForm.cta_url} onChange={e=>setSponsorForm(v=>({...v,cta_url:e.target.value}))} className="h-10 border px-3 text-sm" /><select value={sponsorForm.currency} onChange={()=>setSponsorForm(v=>({...v,currency:"USD",amount:v.amount||"75"}))} className="h-10 border px-3 text-sm"><option value="USD">USD</option></select><input type="number" min="1" placeholder="Monthly USD rate" value={sponsorForm.amount} onChange={e=>setSponsorForm(v=>({...v,amount:e.target.value}))} className="h-10 border px-3 text-sm" /><select value={sponsorForm.duration_months} onChange={e=>setSponsorForm(v=>({...v,duration_months:e.target.value}))} className="h-10 border px-3 text-sm">{Array.from({length:12},(_,i)=>i+1).map(m=><option key={m} value={m}>{m} month{m>1?"s":""}</option>)}</select><select value={sponsorForm.placement} onChange={e=>setSponsorForm(v=>({...v,placement:e.target.value}))} className="h-10 border px-3 text-sm"><option value="sidebar">Sidebar</option><option value="in_feed">In-feed</option><option value="both">Homepage + sidebar</option></select><input placeholder="CTA text" value={sponsorForm.cta_text} onChange={e=>setSponsorForm(v=>({...v,cta_text:e.target.value}))} className="h-10 border px-3 text-sm" /><button disabled={busy} className="h-10 bg-neutral-950 px-4 text-xs font-bold text-white">Create paused sponsor</button></form></Panel>
        <Panel title="Sponsors" subtitle="Real paid campaigns only."><div className="divide-y">{data.sponsors.map(s=><div key={s.id} className="grid gap-3 py-4 lg:grid-cols-[1fr_auto_auto] lg:items-center"><div><p className="text-xs font-bold text-amber-800">{s.sponsor_name}</p><p className="font-semibold">{s.headline}</p><p className="text-xs text-neutral-500">{s.placement} · {money(Number(s.monthly_fee_usd || 0))} · {s.starts_at ? new Date(s.starts_at).toLocaleDateString() : "no start"} → {s.ends_at ? new Date(s.ends_at).toLocaleDateString() : "open"}</p></div><span className={s.active?"text-xs font-bold text-teal-800":"text-xs font-bold text-neutral-400"}>{s.active?"ACTIVE":"PAUSED"}</span><button disabled={busy} onClick={()=>void post({action:"sponsor_status",id:s.id,active:!s.active})} className="border px-3 py-2 text-xs font-semibold">{s.active?"Pause":"Activate"}</button></div>)}</div></Panel>
        <Panel title="Payments" subtitle="USD sponsorship transactions."><div className="divide-y">{data.payments.map(p=><div key={p.reference} className="grid gap-3 py-4 lg:grid-cols-[1fr_auto_auto] lg:items-center"><div><p className="font-semibold">{p.package_name} · {money(Number(p.amount || p.amount_usd || 0))}</p><p className="text-xs text-neutral-500">{p.company || p.name || "Advertiser"} · {p.email} · {p.reference}</p><p className="text-xs text-neutral-500">{p.status} · {p.paystack_status || "not verified"} · {p.design_requested ? "Design requested" : p.creative_url ? "Creative supplied" : "Creative missing"} · {new Date(p.created_at).toLocaleString()}</p>{p.creative_url ? <img src={p.creative_url} alt="" className="mt-2 max-h-24 w-40 rounded border object-contain" /> : null}</div><button disabled={busy} onClick={()=>void post({action:"payment_verify",reference:p.reference})} className="border px-3 py-2 text-xs font-semibold">Verify</button>{p.status==="paid" && !p.sponsor_id ? <button disabled={busy} onClick={()=>void post({action:"payment_activate",reference:p.reference})} className="bg-teal-800 px-3 py-2 text-xs font-bold text-white">Activate campaign</button> : <span className="text-xs text-neutral-500">{p.sponsor_id?"Campaign active/linked":"—"}</span>}</div>)}</div></Panel>
        <Panel title="Advertiser leads"><div className="divide-y">{data.leads.map(l=><div key={l.id} className="grid gap-3 py-4 lg:grid-cols-[1fr_auto] lg:items-center"><div><p className="font-semibold">{l.company || l.name || "Unnamed lead"}</p><p className="text-sm">{l.email}</p><p className="text-xs text-neutral-500">{l.message || "Sponsorship inquiry"} · {new Date(l.created_at).toLocaleString()}</p></div><select value={l.status} disabled={busy} onChange={e=>void post({action:"lead_status",id:l.id,status:e.target.value})} className="h-9 border px-2 text-xs"><option>new</option><option>contacted</option><option>won</option><option>lost</option></select></div>)}</div></Panel>
      </section> : null}

      {tab === "newsletter" ? <NewsletterPanel articles={data.articles} subscribers={data.overview.newsletter_subscribers} copied={copied} onCopy={async (label, text) => { try { await navigator.clipboard.writeText(text); setCopied(label); window.setTimeout(() => setCopied(""), 1800); } catch { setCopied("Copy failed"); } }} /> : null}

      {tab === "security" ? <section className="space-y-6"><PageHeading title="Security & audit" subtitle="Track administrative changes and keep the private area separate from public analytics." /><Panel title="Recent admin actions"><div className="divide-y">{data.audit_logs.map(log=><div key={log.id} className="py-3"><p className="text-xs font-bold">{log.action}</p><p className="text-xs text-neutral-500">{log.entity_type || "system"} · {log.entity_id || "—"} · {new Date(log.created_at).toLocaleString()}</p></div>)}</div></Panel></section> : null}

      {tab === "settings" ? <section className="space-y-6"><PageHeading title="Settings" subtitle="Production configuration and operating notes." /><div className="grid gap-6 md:grid-cols-2"><Panel title="Payment configuration"><StatusLine label="Currency" value="USD" /><StatusLine label="Payment provider" value="Kora (primary) · Paystack (fallback)" /><StatusLine label="Webhook endpoint" value="/api/kora/webhook" /><StatusLine label="Admin session" value="12-hour signed HttpOnly cookie" /></Panel><Panel title="News standards"><StatusLine label="Coverage" value="Global" /><StatusLine label="Images" value="Real/source-backed images only" /><StatusLine label="Breaking wire" value="Scheduled + live refresh" /><StatusLine label="Editorial rule" value="Sponsored content labeled" /></Panel></div></section> : null}
    </main>
  </div>;
}

function PageHeading({ title, subtitle }: { title: string; subtitle: string }) { return <div><p className="text-[10px] font-bold tracking-[0.18em] text-amber-800 uppercase">RockBrief</p><h2 className="font-display mt-1 text-3xl font-semibold">{title}</h2><p className="mt-1 text-sm text-neutral-500">{subtitle}</p></div>; }
function Panel({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) { return <section className="border border-neutral-200 bg-white p-4 shadow-sm sm:p-5"><div className="mb-4 border-b border-neutral-100 pb-3"><h3 className="font-display text-xl font-semibold">{title}</h3>{subtitle?<p className="mt-1 text-xs text-neutral-500">{subtitle}</p>:null}</div>{children}</section>; }
function MetricGrid({ overview, moneyMetric }: { overview: Record<string,number>; moneyMetric?: string }) {
  const labels: Array<[string,string]> = [["page_views","Page views"],["unique_sessions","Unique sessions"],["article_opens","Article opens"],["shares","Shares"],["sponsor_clicks","Sponsor clicks"],["advertiser_leads","Advertiser leads"],["newsletter_subscribers","Newsletter subscribers"],["paid_revenue_usd","Paid revenue (USD)"]];
  return <div className="grid gap-3 grid-cols-2 md:grid-cols-4 xl:grid-cols-8">{labels.map(([key,label])=><div key={key} className="border bg-white p-4"><p className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">{label}</p><p className="mt-2 text-2xl font-bold">{moneyMetric===key?money(overview[key]):key==="paid_revenue_usd"?money(overview[key]):number(overview[key])}</p></div>)}</div>;
}
function EngagementPanel({data}:{data:{recommendation_impressions:number;recommendation_clicks:number;recommendation_ctr:number;engaged_reads:number;return_visits:number;returning_sessions:number;search_events:number;external_source_clicks:number}}) {
  const items = [
    ["Recommendation impressions", number(data.recommendation_impressions)],
    ["Recommendation clicks", number(data.recommendation_clicks)],
    ["Recommendation CTR", data.recommendation_ctr.toFixed(1) + "%"],
    ["30s engaged reads", number(data.engaged_reads)],
    ["Return visits", number(data.return_visits)],
    ["Returning sessions", number(data.returning_sessions)],
    ["Search events", number(data.search_events)],
    ["Source clicks", number(data.external_source_clicks)],
  ];
  return <Panel title="Growth & retention signal" subtitle="Measures whether the site turns first visits into deeper reading and repeat visits."><div className="grid gap-3 grid-cols-2 md:grid-cols-4">{items.map(([label,value])=><div key={label} className="border bg-neutral-50 p-3"><p className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">{label}</p><p className="mt-1 text-xl font-bold">{value}</p></div>)}</div><p className="mt-3 text-xs text-neutral-500">Internal product signals only; they do not guarantee search rankings or traffic growth.</p></Panel>;
}
function StatusLine({label,value}:{label:string;value:string}) { return <div className="flex items-center justify-between gap-4 border-b border-neutral-100 py-3 text-sm"><span className="text-neutral-500">{label}</span><span className="text-right font-semibold">{value}</span></div>; }
function Bars({data}:{data:Array<{label:string;value:number}>}) {
  const max=Math.max(...data.map(x=>x.value),1);
  return <div className="space-y-3">{data.length?data.map(x=><div key={x.label}>
    <div className="mb-1 flex justify-between gap-3 text-sm"><span className="truncate">{x.label || "Unknown"}</span><span className="font-bold tabular-nums">{number(x.value)}</span></div>
    <div className="h-2.5 overflow-hidden rounded-full bg-neutral-100"><div className="h-full bg-neutral-900" style={{width: Math.max(3,(x.value/max)*100)+"%"}} /></div>
  </div>):<p className="text-sm text-neutral-500">No traffic recorded yet.</p>}</div>;
}
function DailyChart({data}:{data:Array<{day:string;value:number}>}) { const max=Math.max(...data.map(x=>x.value),1); return <div className="flex h-44 items-end gap-1 overflow-x-auto">{data.map(x=><div key={x.day} className="flex min-w-4 flex-1 flex-col items-center justify-end gap-1"><div title={x.day+" · "+number(x.value)} className="w-full min-w-2 bg-neutral-900" style={{height:Math.max(3,(x.value/max)*130)+"px"}} /><span className="hidden text-[8px] text-neutral-400 sm:block">{x.day.slice(5)}</span></div>)}</div>; }

function titleOf(a:any){ return a?.ai_hook_title || a?.original_title || "RockBrief story"; }
function briefOf(a:any){ return Array.isArray(a?.ai_summary) ? a.ai_summary.slice(0,2).join(" ") : String(a?.original_description || "Read the latest RockBrief briefing."); }
function SocialPanel({articles,copied,onCopy}:{articles:any[];copied:string;onCopy:(label:string,text:string)=>void}){
 const items=articles.slice(0,8);
 const storyUrl=(a:any,platform:string)=>{
   const title=titleOf(a).toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"").slice(0,90);
   const id=encodeURIComponent(a.id || "");
   return window.location.origin+"/news/"+title+"--"+id+"?utm_source="+encodeURIComponent(platform)+"&utm_medium=social&utm_campaign=rwdnews";
 };
 return <section className="space-y-6"><PageHeading title="Social publishing" subtitle="Turn the latest source-backed RockBrief stories into ready-to-post social copy." /><Panel title="Today's social desk" subtitle="Every share points back to the RockBrief briefing and is tagged for traffic analytics."><div className="space-y-5">{items.map(a=>{const title=titleOf(a); const brief=briefOf(a); const urls={x:storyUrl(a,"x"),whatsapp:storyUrl(a,"whatsapp"),telegram:storyUrl(a,"telegram"),facebook:storyUrl(a,"facebook"),linkedin:storyUrl(a,"linkedin")}; const text=`RockBrief — ${title}\n\n${brief}\n\nRead the RockBrief briefing: ${urls.x}`; return <div key={a.id} className="border border-neutral-200 p-4"><div className="flex items-start justify-between gap-3"><div><p className="text-[10px] font-bold uppercase tracking-wider text-amber-800">{a.source || "RockBrief"} · {a.category || "News"}</p><h3 className="mt-1 font-display text-lg font-semibold">{title}</h3></div><Share2 className="size-4 shrink-0 text-neutral-400" /></div><textarea readOnly value={text} className="mt-3 min-h-28 w-full resize-y border bg-neutral-50 p-3 text-xs leading-relaxed" /><div className="mt-3 flex flex-wrap gap-2"><button onClick={()=>onCopy("X:"+a.id,text)} className="border px-3 py-2 text-xs font-bold">Copy X</button><button onClick={()=>window.open("https://x.com/intent/post?text="+encodeURIComponent(text),"rwdnews-x","width=700,height=600")} className="border px-3 py-2 text-xs font-bold">Open X</button><button onClick={()=>onCopy("WhatsApp:"+a.id,text)} className="border px-3 py-2 text-xs font-bold">Copy WhatsApp</button><button onClick={()=>window.open("https://wa.me/?text="+encodeURIComponent(text),"rwdnews-whatsapp","width=700,height=700")} className="border px-3 py-2 text-xs font-bold">Open WhatsApp</button><button onClick={()=>onCopy("Telegram:"+a.id,text)} className="border px-3 py-2 text-xs font-bold">Copy Telegram</button><button onClick={()=>window.open("https://t.me/share/url?url="+encodeURIComponent(urls.telegram)+"&text="+encodeURIComponent("RockBrief — "+title),"rwdnews-telegram","width=700,height=600")} className="border px-3 py-2 text-xs font-bold">Open Telegram</button><button onClick={()=>window.open("https://www.facebook.com/sharer/sharer.php?u="+encodeURIComponent(urls.facebook),"rwdnews-facebook","width=700,height=600")} className="border px-3 py-2 text-xs font-bold">Open Facebook</button><button onClick={()=>window.open("https://www.linkedin.com/sharing/share-offsite/?url="+encodeURIComponent(urls.linkedin),"rwdnews-linkedin","width=700,height=600")} className="border px-3 py-2 text-xs font-bold">Open LinkedIn</button>{copied.includes(a.id)?<span className="px-2 py-2 text-xs font-semibold text-teal-800">Copied</span>:null}</div></div>})}</div></Panel></section>;
}
function NewsletterPanel({articles,subscribers,copied,onCopy}:{articles:any[];subscribers:number;copied:string;onCopy:(label:string,text:string)=>void}){
 const top=articles.slice(0,5); const subject=`RockBrief Brief — ${new Date().toLocaleDateString()}`; const body=[`RockBrief BRIEF`, `\\nThe latest source-backed global stories from RockBrief.`, ...top.map((a,i)=>`\\n${i+1}. ${titleOf(a)}\\n${briefOf(a)}\\n${a.original_url || ""}`), `\\nRockBrief — Source-backed first.`].join("\n");
 return <section className="space-y-6"><PageHeading title="Newsletter" subtitle="Build a newsletter draft from the latest RockBrief stories. Subscriber emails stay private." /><MetricGrid overview={{newsletter_subscribers:subscribers}} /><Panel title="RockBrief Brief draft" subtitle="This creates copy for your email provider; it does not pretend to send email."><div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-xs font-bold uppercase tracking-wider text-neutral-500">Subject</p><p className="font-semibold">{subject}</p></div><button onClick={()=>onCopy("newsletter",`Subject: ${subject}\n\n${body}`)} className="inline-flex items-center justify-center gap-2 bg-neutral-950 px-4 py-2 text-xs font-bold text-white"><Copy className="size-3.5"/>{copied==="newsletter"?"Copied":"Copy newsletter"}</button></div><textarea readOnly value={body} className="mt-4 min-h-80 w-full border bg-neutral-50 p-4 text-sm leading-relaxed" /><p className="mt-3 text-xs text-neutral-500">Next delivery step is connecting an email sending provider. Until that is connected, RockBrief should only collect subscribers and prepare drafts.</p></Panel></section>;
}
