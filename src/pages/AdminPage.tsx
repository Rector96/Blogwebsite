import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { Helmet } from "react-helmet-async";
import {
  BarChart3, Copy, DollarSign, Globe2, LogOut, Megaphone, Newspaper,
  Settings, Share2, ShieldCheck, Users, Search,
} from "lucide-react";
import RichArticleEditor from "../components/RichArticleEditor";
import {
  PageHeading, Panel, MetricGrid, EngagementPanel, StatusLine, Bars, DailyChart,
} from "../components/AdminDeskHelpers";

type Dashboard = {
  generated_at?: string;
  overview?: Record<string, number>;
  daily?: Array<{ day: string; value: number }>;
  sources?: Array<{ label: string; value: number }>;
  countries?: Array<{ label: string; value: number }>;
  cities?: Array<{ label: string; value: number }>;
  devices?: Array<{ label: string; value: number }>;
  browsers?: Array<{ label: string; value: number }>;
  top_paths?: Array<{ label: string; value: number }>;
  top_articles?: Array<{ id: string; views: number; article: any }>;
  engagement?: Record<string, number>;
  sponsors?: any[];
  leads?: any[];
  payments?: any[];
  articles?: any[];
  audit_logs?: any[];
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

const emptyForm = {
  headline: "", description: "", body: "", category: "World", region: "Global",
  story_type: "RockBrief ORIGINAL", subject: "", author_name: "RockBrief Editorial",
  image: "", read_time: "3 min read", image_credit: "RockBrief",
  image_license: "Owned or licensed by RockBrief", image_source_url: "",
  original_url: "", tags: "", publish_at: "", editorial_status: "published",
  featured: false, pinned: false,
};

async function api(options?: RequestInit) {
  const token = typeof window !== "undefined" ? window.sessionStorage.getItem("rwdnews_admin_token") : null;
  const response = await fetch("/api/admin", {
    credentials: "same-origin",
    ...options,
    headers: {
      "content-type": "application/json",
      ...(token ? { Authorization: "Bearer " + token } : {}),
      ...(options?.headers || {}),
    },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Request failed");
  return data;
}

const money = (value: number) =>
  "$" + Number(value || 0).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
const number = (value: number) => Number(value || 0).toLocaleString("en-US");

export default function AdminPage() {
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [authed, setAuthed] = useState(false);
  const [data, setData] = useState<Dashboard | null>(null);
  const [tab, setTab] = useState("dashboard");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [lastUpdated, setLastUpdated] = useState("");
  const [researchTopic, setResearchTopic] = useState("");
  const [researchMode, setResearchMode] = useState<"news" | "documentary">("news");
  const [researchResult, setResearchResult] = useState<any>(null);
  const [sponsorForm, setSponsorForm] = useState({
    sponsor_name: "", headline: "", cta_url: "", cta_text: "Learn more",
    placement: "sidebar", currency: "USD", amount: "75", duration_months: "1",
    disclosure: "Sponsored · Paid placement",
  });
  const [editingArticleId, setEditingArticleId] = useState<string | null>(null);
  const [storyForm, setStoryForm] = useState(emptyForm);

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
      if (showError) setError(e instanceof Error ? e.message : "Could not load admin");
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
    try {
      await api({ method: "POST", body: JSON.stringify(body) });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Action failed");
    } finally {
      setBusy(false);
    }
  };

  const login = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const result = await api({ method: "POST", body: JSON.stringify({ action: "login", password }) });
      if (result.session_token) window.sessionStorage.setItem("rwdnews_admin_token", String(result.session_token));
      setPassword("");
      await load(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Login failed");
    } finally {
      setBusy(false);
    }
  };

  const logout = async () => {
    await post({ action: "logout" });
    window.sessionStorage.removeItem("rwdnews_admin_token");
    setAuthed(false);
    setData(null);
  };

  const uploadStoryImage = async (file: File): Promise<string | null> => {
    if (!["image/jpeg", "image/png", "image/webp", "image/avif"].includes(file.type)) {
      setError("Use JPG, PNG, WebP or AVIF.");
      return null;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError("Image must be 5 MB or smaller.");
      return null;
    }
    setBusy(true);
    setError("");
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ""));
        reader.onerror = () => reject(new Error("Could not read image"));
        reader.readAsDataURL(file);
      });
      const result = await api({
        method: "POST",
        body: JSON.stringify({ action: "article_image_upload", filename: file.name, mime_type: file.type, data: dataUrl }),
      });
      const url = String(result.url || "");
      setStoryForm((v) => ({ ...v, image: url }));
      return url || null;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Image upload failed");
      return null;
    } finally {
      setBusy(false);
    }
  };

  const onStoryType = (story_type: string) => {
    setStoryForm((v) => {
      let category = v.category;
      let tags = v.tags;
      if (story_type === "EXPLAINER") {
        category = "Explainers";
        if (!/explainer/i.test(tags)) tags = (tags ? tags + ", " : "") + "Explainer";
      } else if (story_type === "BIO" || story_type === "PROFILE") {
        category = "Profiles";
        if (!/biograph|profile/i.test(tags)) tags = (tags ? tags + ", " : "") + "Biography";
      }
      return { ...v, story_type, category, tags };
    });
  };

  const createStory = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    const plainWords = storyForm.body.replace(/<[^>]*>/g, " ").replace(/&nbsp;/gi, " ").trim().split(/\s+/).filter(Boolean);
    if (storyForm.editorial_status !== "draft" && plainWords.length < 400) {
      setError(`Published stories need at least 400 words. Current: ${plainWords.length}. Short summary is separate.`);
      return;
    }
    await post({
      action: editingArticleId ? "article_update" : "article_create",
      ...(editingArticleId ? { id: editingArticleId } : {}),
      ...storyForm,
      tags: storyForm.tags.split(",").map((x) => x.trim()).filter(Boolean),
      read_time: `${Math.max(1, Math.ceil(plainWords.length / 180))} min read`,
      editorial_status:
        storyForm.editorial_status === "draft" ? "hidden" : storyForm.editorial_status,
    });
    setEditingArticleId(null);
    setStoryForm(emptyForm);
  };

  const editArticle = async (id: string) => {
    setBusy(true);
    setError("");
    try {
      const result = await api({ method: "POST", body: JSON.stringify({ action: "article_get", id }) });
      const a = result.article;
      setEditingArticleId(String(a.id));
      setStoryForm({
        headline: String(a.original_title || a.ai_hook_title || ""),
        description: String(a.original_description || ""),
        body: String(a.body || ""),
        category: String(a.category || "World"),
        region: String(a.region || "Global"),
        story_type: String(a.story_type || "RockBrief ORIGINAL"),
        subject: String(a.subject || ""),
        author_name: String(a.author_name || "RockBrief Editorial"),
        image: String(a.image || ""),
        read_time: String(a.read_time || "3 min read"),
        image_credit: String(a.image_credit || ""),
        image_license: String(a.image_license || ""),
        image_source_url: String(a.image_source_url || ""),
        original_url: String(a.original_url || ""),
        tags: Array.isArray(a.tags) ? a.tags.map((x: unknown) => String(x).replace(/^#/, "")).join(", ") : "",
        publish_at: a.timestamp ? new Date(a.timestamp).toISOString().slice(0, 16) : "",
        editorial_status: a.editorial_status === "hidden" ? "draft" : String(a.editorial_status || "published"),
        featured: Boolean(a.featured),
        pinned: Boolean(a.pinned),
      });
      setTab("news");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load article");
    } finally {
      setBusy(false);
    }
  };

  const addSponsor = async (e: FormEvent) => {
    e.preventDefault();
    await post({
      action: "sponsor_create",
      ...sponsorForm,
      amount: Number(sponsorForm.amount || 0),
      duration_months: Number(sponsorForm.duration_months || 1),
    });
    setSponsorForm({
      sponsor_name: "", headline: "", cta_url: "", cta_text: "Learn more",
      placement: "sidebar", currency: "USD", amount: "75", duration_months: "1",
      disclosure: "Sponsored · Paid placement",
    });
  };

  const runResearch = async () => {
    if (!researchTopic.trim()) {
      setError("Enter a topic to research.");
      return;
    }
    setBusy(true);
    setError("");
    setResearchResult(null);
    try {
      const response = await fetch(
        "/api/research?topic=" + encodeURIComponent(researchTopic.trim()) + "&mode=" + researchMode,
        { credentials: "same-origin" },
      );
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "Research failed");
      setResearchResult(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Research failed");
    } finally {
      setBusy(false);
    }
  };

  const topCountries = useMemo(() => data?.countries?.slice(0, 8) || [], [data]);
  const topSources = useMemo(() => data?.sources?.slice(0, 8) || [], [data]);
  const articles = data?.articles || [];
  const sponsors = data?.sponsors || [];
  const leads = data?.leads || [];
  const payments = data?.payments || [];

  if (!authed || !data) {
    return (
      <div className="grid min-h-dvh place-items-center bg-neutral-950 p-4">
        <Helmet>
          <title>RockBrief Admin</title>
          <meta name="robots" content="noindex,nofollow" />
        </Helmet>
        <form onSubmit={login} className="w-full max-w-sm border border-neutral-800 bg-white p-6 shadow-2xl">
          <p className="text-[10px] font-bold tracking-[0.18em] text-amber-800 uppercase">Private operations</p>
          <h1 className="font-display mt-2 text-3xl font-semibold">RockBrief Admin</h1>
          <p className="mt-2 text-sm text-neutral-500">Full newsroom desk — news, audience, sponsors, payments.</p>
          <div className="relative mt-5">
            <input
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-11 w-full border px-3 pr-20"
              placeholder="Admin password"
              required
            />
            <button type="button" onClick={() => setShowPassword((v) => !v)} className="absolute top-1/2 right-2 -translate-y-1/2 text-xs font-semibold text-neutral-500">
              {showPassword ? "Hide" : "Show"}
            </button>
          </div>
          <button disabled={busy} className="mt-3 h-11 w-full bg-neutral-950 text-sm font-bold text-white disabled:opacity-50">
            Sign in
          </button>
          {error ? <p className="mt-3 text-xs text-red-700">{error}</p> : null}
        </form>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-neutral-100 text-neutral-950">
      <Helmet>
        <title>RockBrief Admin</title>
        <meta name="robots" content="noindex,nofollow" />
      </Helmet>
      <header className="sticky top-0 z-40 border-b bg-neutral-950 text-white">
        <div className="mx-auto flex max-w-[1500px] items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <div>
            <p className="text-[10px] font-bold tracking-[0.18em] text-amber-400 uppercase">Private operations</p>
            <h1 className="font-display text-xl font-semibold sm:text-2xl">RockBrief Admin</h1>
          </div>
          <div className="flex items-center gap-2">
            <a href="/" className="border border-neutral-700 px-3 py-2 text-xs font-semibold text-amber-400">Open site</a>
            <button type="button" onClick={() => void logout()} disabled={busy} className="grid size-9 place-items-center border border-neutral-700">
              <LogOut className="size-4" />
            </button>
          </div>
        </div>
        <nav className="mx-auto flex max-w-[1500px] gap-1 overflow-x-auto px-3 pb-3 sm:px-5" aria-label="Admin sections">
          {tabs.map(([id, label, Icon]) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={
                tab === id
                  ? "flex shrink-0 items-center gap-2 rounded-full bg-white px-3 py-2 text-xs font-bold text-neutral-950"
                  : "flex shrink-0 items-center gap-2 rounded-full px-3 py-2 text-xs font-semibold text-neutral-400 hover:bg-neutral-800 hover:text-white"
              }
            >
              <Icon className="size-3.5" />
              {label}
            </button>
          ))}
        </nav>
      </header>

      <main className="mx-auto max-w-[1500px] space-y-6 px-4 py-5 sm:px-6 sm:py-7">
        {error ? <div className="border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</div> : null}

        {tab === "dashboard" ? (
          <section className="space-y-6">
            <PageHeading title="Dashboard" subtitle={lastUpdated ? `Live · ${new Date(lastUpdated).toLocaleString()}` : "Loading…"} />
            <MetricGrid overview={data.overview || {}} />
            {data.engagement ? <EngagementPanel data={data.engagement} /> : null}
            <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
              <Panel title="Daily page views" subtitle="Last 30 days">
                <DailyChart data={data.daily || []} />
              </Panel>
              <Panel title="Traffic sources">
                <Bars data={topSources} />
              </Panel>
            </div>
            <div className="grid gap-6 lg:grid-cols-3">
              <Panel title="Top countries"><Bars data={topCountries} /></Panel>
              <Panel title="Top stories">
                <div className="divide-y">
                  {(data.top_articles || []).slice(0, 8).map((x) => (
                    <div key={x.id} className="py-3">
                      <p className="text-xs text-neutral-500">{number(x.views)} views</p>
                      <p className="font-semibold">{x.article?.ai_hook_title || x.article?.original_title || x.id}</p>
                    </div>
                  ))}
                  {!(data.top_articles || []).length ? <p className="py-3 text-sm text-neutral-500">No article stats yet.</p> : null}
                </div>
              </Panel>
              <Panel title="Operations">
                <StatusLine label="Articles loaded" value={articles.length} />
                <StatusLine label="Sponsors" value={sponsors.length} />
                <StatusLine label="Leads" value={leads.length} />
                <StatusLine label="Payments" value={payments.length} />
              </Panel>
            </div>
          </section>
        ) : null}

        {tab === "news" ? (
          <section className="space-y-6">
            <PageHeading
              title="Newsroom"
              subtitle="Short summary = SEO. Full article body must be 400+ words to publish. Paste from Word is supported."
            />
            <Panel title={editingArticleId ? "Edit article" : "Create article"}>
              <form onSubmit={createStory} className="grid gap-3 md:grid-cols-2">
                <input required placeholder="Headline" value={storyForm.headline} onChange={(e) => setStoryForm((v) => ({ ...v, headline: e.target.value }))} className="h-11 border px-3 text-sm md:col-span-2" />
                <textarea required placeholder="Short summary / SEO description (not the full article)" value={storyForm.description} onChange={(e) => setStoryForm((v) => ({ ...v, description: e.target.value }))} className="min-h-20 border p-3 text-sm md:col-span-2" />
                <div className="md:col-span-2">
                  <label className="mb-2 block text-xs font-bold uppercase tracking-wide text-neutral-500">Full article · 400+ words · Word paste OK</label>
                  <RichArticleEditor value={storyForm.body} onChange={(body) => setStoryForm((v) => ({ ...v, body }))} onImageUpload={uploadStoryImage} minWords={400} />
                </div>
                <select value={storyForm.story_type} onChange={(e) => onStoryType(e.target.value)} className="h-11 border px-3 text-sm">
                  <option value="RockBrief ORIGINAL">Original</option>
                  <option value="WIRE">Wire</option>
                  <option value="DEVELOPING">Developing</option>
                  <option value="EXPLAINER">Explainer</option>
                  <option value="BIO">Biography</option>
                  <option value="PROFILE">Profile</option>
                  <option value="FEATURE">Feature</option>
                  <option value="COMMENTARY">Commentary</option>
                </select>
                <select value={storyForm.category} onChange={(e) => setStoryForm((v) => ({ ...v, category: e.target.value }))} className="h-11 border px-3 text-sm">
                  <option>World</option><option>Business</option><option>Explainers</option><option>Profiles</option>
                  <option>Sports</option><option>Tech</option><option>Crypto</option><option>Entertainment</option>
                  <option>Africa</option><option>Nigeria</option><option>Ghana</option>
                  <option>Europe</option><option>Middle East</option><option>Asia</option>
                </select>
                <select value={storyForm.region} onChange={(e) => setStoryForm((v) => ({ ...v, region: e.target.value }))} className="h-11 border px-3 text-sm">
                  <option>Global</option><option>Africa</option><option>Nigeria</option><option>Ghana</option>
                  <option>Europe</option><option>Middle East</option><option>Asia</option><option>North America</option>
                </select>
                <input placeholder="Author" value={storyForm.author_name} onChange={(e) => setStoryForm((v) => ({ ...v, author_name: e.target.value }))} className="h-11 border px-3 text-sm" />
                <input placeholder="Tags (comma separated)" value={storyForm.tags} onChange={(e) => setStoryForm((v) => ({ ...v, tags: e.target.value }))} className="h-11 border px-3 text-sm md:col-span-2" />
                <input placeholder="Source URL (wire)" value={storyForm.original_url} onChange={(e) => setStoryForm((v) => ({ ...v, original_url: e.target.value }))} className="h-11 border px-3 text-sm md:col-span-2" />
                <div className="space-y-2 md:col-span-2">
                  <label className="block text-xs font-bold uppercase text-neutral-500">Cover image JPG/PNG</label>
                  <input type="file" accept="image/jpeg,image/png,image/webp,image/avif" disabled={busy} onChange={(e) => { const f = e.target.files?.[0]; if (f) void uploadStoryImage(f); }} className="block w-full border p-3 text-sm" />
                  <input type="url" placeholder="Or image URL" value={storyForm.image} onChange={(e) => setStoryForm((v) => ({ ...v, image: e.target.value }))} className="h-11 w-full border px-3 text-sm" />
                  {storyForm.image ? <img src={storyForm.image} alt="" className="max-h-40 rounded-lg object-cover" /> : null}
                </div>
                <input placeholder="Image credit" value={storyForm.image_credit} onChange={(e) => setStoryForm((v) => ({ ...v, image_credit: e.target.value }))} className="h-11 border px-3 text-sm" />
                <select value={storyForm.editorial_status} onChange={(e) => setStoryForm((v) => ({ ...v, editorial_status: e.target.value }))} className="h-11 border px-3 text-sm">
                  <option value="published">Published</option>
                  <option value="draft">Draft</option>
                  <option value="pending">Pending</option>
                </select>
                <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={storyForm.featured} onChange={(e) => setStoryForm((v) => ({ ...v, featured: e.target.checked }))} /> Featured</label>
                <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={storyForm.pinned} onChange={(e) => setStoryForm((v) => ({ ...v, pinned: e.target.checked }))} /> Pinned</label>
                <div className="flex flex-wrap gap-2 md:col-span-2">
                  <button type="submit" disabled={busy} className="h-11 bg-neutral-950 px-5 text-sm font-bold text-white disabled:opacity-50">
                    {editingArticleId ? "Save changes" : "Publish"}
                  </button>
                  {editingArticleId ? (
                    <button type="button" onClick={() => { setEditingArticleId(null); setStoryForm(emptyForm); }} className="h-11 border px-4 text-sm font-semibold">Cancel</button>
                  ) : null}
                </div>
              </form>
            </Panel>
            <Panel title="Recent articles">
              <div className="divide-y">
                {articles.slice(0, 40).map((a: any) => (
                  <div key={a.id} className="flex items-center justify-between gap-2 py-3">
                    <div className="min-w-0">
                      <p className="text-[10px] font-bold uppercase text-amber-800">{a.story_type || "WIRE"} · {a.category}</p>
                      <p className="truncate font-semibold">{a.ai_hook_title || a.original_title}</p>
                    </div>
                    <button type="button" disabled={busy} onClick={() => void editArticle(String(a.id))} className="border px-3 py-1.5 text-xs font-bold">Edit</button>
                  </div>
                ))}
                {!articles.length ? <p className="py-3 text-sm text-neutral-500">No articles yet.</p> : null}
              </div>
            </Panel>
          </section>
        ) : null}

        {tab === "research" ? (
          <section className="space-y-6">
            <PageHeading title="Research desk" subtitle="Explore a topic, then send findings into the news form as a draft." />
            <Panel title="Topic research">
              <div className="flex flex-col gap-3 sm:flex-row">
                <input value={researchTopic} onChange={(e) => setResearchTopic(e.target.value)} placeholder="Topic e.g. Strait of Hormuz fuel Africa" className="h-11 flex-1 border px-3 text-sm" />
                <select value={researchMode} onChange={(e) => setResearchMode(e.target.value as any)} className="h-11 border px-3 text-sm">
                  <option value="news">News brief</option>
                  <option value="documentary">Deep dive</option>
                </select>
                <button type="button" disabled={busy} onClick={() => void runResearch()} className="h-11 bg-neutral-950 px-4 text-sm font-bold text-white">Run</button>
              </div>
              {researchResult?.report ? (
                <div className="mt-4 space-y-2 text-sm">
                  <p className="font-semibold">{researchResult.report.headline}</p>
                  <p className="text-neutral-600">{researchResult.report.summary}</p>
                  <button
                    type="button"
                    className="text-xs font-bold text-teal-800"
                    onClick={() => {
                      const report = researchResult.report;
                      const body = [report.summary, ...(report.sections || []).map((s: any) => "## " + s.title + "\n\n" + s.body)].join("\n\n");
                      setStoryForm((v) => ({
                        ...v,
                        headline: report.headline || "",
                        description: report.summary || "",
                        body,
                        story_type: "RockBrief ORIGINAL",
                        editorial_status: "draft",
                      }));
                      setTab("news");
                    }}
                  >
                    Use as draft in News →
                  </button>
                </div>
              ) : null}
            </Panel>
          </section>
        ) : null}

        {tab === "social" ? (
          <section className="space-y-6">
            <PageHeading title="Social" subtitle="Share published stories with headline + link. Image cards use the article cover." />
            <Panel title="Share latest">
              <div className="space-y-3">
                {articles.slice(0, 10).map((a: any) => {
                  const title = a.ai_hook_title || a.original_title;
                  const path = "/news/" + String(title || "story").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 90) + "--" + encodeURIComponent(a.id);
                  const url = (typeof window !== "undefined" ? window.location.origin : "") + path;
                  return (
                    <div key={a.id} className="flex flex-wrap items-center justify-between gap-2 border-b py-2">
                      <p className="text-sm font-semibold">{title}</p>
                      <div className="flex gap-2">
                        <a className="text-xs font-bold text-teal-800" href={"https://wa.me/?text=" + encodeURIComponent(title + "\n" + url)} target="_blank" rel="noreferrer">WhatsApp</a>
                        <button type="button" className="text-xs font-bold" onClick={() => void navigator.clipboard.writeText(url)}>Copy link</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Panel>
          </section>
        ) : null}

        {tab === "analytics" ? (
          <section className="space-y-6">
            <PageHeading title="Analytics" subtitle="Audience geography, devices and paths." />
            <div className="grid gap-6 lg:grid-cols-2">
              <Panel title="Countries"><Bars data={data.countries || []} /></Panel>
              <Panel title="Devices"><Bars data={data.devices || []} /></Panel>
              <Panel title="Browsers"><Bars data={data.browsers || []} /></Panel>
              <Panel title="Top paths"><Bars data={data.top_paths || []} /></Panel>
            </div>
          </section>
        ) : null}

        {tab === "monetization" ? (
          <section className="space-y-6">
            <PageHeading title="Monetization" subtitle="Sponsors, leads and payments." />
            <Panel title="Create sponsor">
              <form onSubmit={addSponsor} className="grid gap-2 md:grid-cols-2">
                <input required placeholder="Sponsor name" value={sponsorForm.sponsor_name} onChange={(e) => setSponsorForm((v) => ({ ...v, sponsor_name: e.target.value }))} className="h-11 border px-3 text-sm" />
                <input required placeholder="Headline" value={sponsorForm.headline} onChange={(e) => setSponsorForm((v) => ({ ...v, headline: e.target.value }))} className="h-11 border px-3 text-sm" />
                <input required type="url" placeholder="https://…" value={sponsorForm.cta_url} onChange={(e) => setSponsorForm((v) => ({ ...v, cta_url: e.target.value }))} className="h-11 border px-3 text-sm md:col-span-2" />
                <input placeholder="Monthly USD" value={sponsorForm.amount} onChange={(e) => setSponsorForm((v) => ({ ...v, amount: e.target.value }))} className="h-11 border px-3 text-sm" />
                <select value={sponsorForm.placement} onChange={(e) => setSponsorForm((v) => ({ ...v, placement: e.target.value }))} className="h-11 border px-3 text-sm">
                  <option value="sidebar">Sidebar</option>
                  <option value="in_feed">In feed</option>
                  <option value="both">Both</option>
                </select>
                <button type="submit" disabled={busy} className="h-11 bg-neutral-950 text-sm font-bold text-white md:col-span-2">Add sponsor</button>
              </form>
            </Panel>
            <div className="grid gap-6 lg:grid-cols-2">
              <Panel title="Sponsors">
                {sponsors.map((s: any) => (
                  <div key={s.id} className="flex items-center justify-between border-b py-2 text-sm">
                    <span>{s.sponsor_name}</span>
                    <button type="button" className="text-xs font-bold" onClick={() => void post({ action: "sponsor_status", id: s.id, active: !s.active })}>
                      {s.active ? "Pause" : "Activate"}
                    </button>
                  </div>
                ))}
                {!sponsors.length ? <p className="text-sm text-neutral-500">No sponsors.</p> : null}
              </Panel>
              <Panel title="Leads">
                {leads.map((l: any) => (
                  <div key={l.id} className="border-b py-2 text-sm">
                    <p className="font-semibold">{l.email}</p>
                    <p className="text-xs text-neutral-500">{l.status} · {l.company || "—"}</p>
                  </div>
                ))}
                {!leads.length ? <p className="text-sm text-neutral-500">No leads.</p> : null}
              </Panel>
            </div>
            <Panel title="Payments">
              {payments.map((p: any) => (
                <div key={p.id || p.reference} className="flex justify-between border-b py-2 text-sm">
                  <span>{p.reference || p.id}</span>
                  <span>{p.status} · {money(Number(p.amount || 0))}</span>
                </div>
              ))}
              {!payments.length ? <p className="text-sm text-neutral-500">No payments.</p> : null}
            </Panel>
          </section>
        ) : null}

        {tab === "audience" ? (
          <section className="space-y-6">
            <PageHeading title="Audience" subtitle="Where readers come from." />
            <div className="grid gap-6 lg:grid-cols-2">
              <Panel title="Countries"><Bars data={data.countries || []} /></Panel>
              <Panel title="Cities"><Bars data={data.cities || []} /></Panel>
            </div>
          </section>
        ) : null}

        {tab === "newsletter" ? (
          <section className="space-y-6">
            <PageHeading title="Newsletter" subtitle="Subscribers are collected from the public site forms." />
            <Panel title="Status">
              <p className="text-sm text-neutral-600">Public newsletter signup writes to Supabase when configured. Use News drafts for issue content.</p>
            </Panel>
          </section>
        ) : null}

        {tab === "security" ? (
          <section className="space-y-6">
            <PageHeading title="Security" subtitle="Session and audit trail." />
            <Panel title="Audit log">
              {(data.audit_logs || []).slice(0, 30).map((log: any) => (
                <div key={log.id} className="border-b py-2 text-xs">
                  <span className="font-semibold">{log.action}</span> · {log.entity_type} · {log.created_at}
                </div>
              ))}
              {!(data.audit_logs || []).length ? <p className="text-sm text-neutral-500">No audit rows yet.</p> : null}
            </Panel>
          </section>
        ) : null}

        {tab === "settings" ? (
          <section className="space-y-6">
            <PageHeading title="Settings" subtitle="Environment is managed in Netlify." />
            <Panel title="Publishing rules">
              <StatusLine label="Min words to publish" value="400" />
              <StatusLine label="Story types" value="Wire, Original, Explainer, Bio, Feature, Commentary" />
              <StatusLine label="Image" value="JPG/PNG required for publish" />
              <p className="mt-3 text-sm text-neutral-600">Short summary is SEO only. Full article body is the long-form piece.</p>
            </Panel>
          </section>
        ) : null}
      </main>
    </div>
  );
}
