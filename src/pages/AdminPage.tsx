import { useEffect, useState, type FormEvent } from "react";
import { Helmet } from "react-helmet-async";
import { LogOut, Newspaper, BarChart3, ShieldCheck } from "lucide-react";
import RichArticleEditor from "../components/RichArticleEditor";

type Dashboard = {
  generated_at?: string;
  overview?: Record<string, number>;
  articles?: any[];
  payments?: any[];
  leads?: any[];
  sponsors?: any[];
};

const emptyForm = {
  headline: "",
  description: "",
  body: "",
  category: "World",
  region: "Global",
  story_type: "RockBrief ORIGINAL",
  subject: "",
  author_name: "RockBrief Editorial",
  image: "",
  read_time: "3 min read",
  image_credit: "RockBrief",
  image_license: "Owned or licensed by RockBrief",
  image_source_url: "",
  original_url: "",
  tags: "",
  publish_at: "",
  editorial_status: "published",
  featured: false,
  pinned: false,
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

function wordCount(html: string) {
  return String(html || "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
}

export default function AdminPage() {
  const [password, setPassword] = useState("");
  const [authed, setAuthed] = useState(false);
  const [data, setData] = useState<Dashboard | null>(null);
  const [tab, setTab] = useState<"dashboard" | "news">("news");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [storyForm, setStoryForm] = useState(emptyForm);

  const load = async (showError = false) => {
    try {
      const result = await api();
      setData(result);
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
      } else if (story_type === "FEATURE") {
        if (!/feature/i.test(tags)) tags = (tags ? tags + ", " : "") + "Feature";
      } else if (story_type === "COMMENTARY") {
        if (!/commentary|opinion/i.test(tags)) tags = (tags ? tags + ", " : "") + "Commentary";
      }
      return { ...v, story_type, category, tags };
    });
  };

  const uploadStoryImage = async (file: File) => {
    if (!["image/jpeg", "image/png", "image/webp", "image/avif"].includes(file.type)) {
      setError("Use JPG, PNG, WebP or AVIF (not SVG).");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError("Image must be 5 MB or smaller.");
      return;
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
      setStoryForm((v) => ({ ...v, image: String(result.url || "") }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Image upload failed");
    } finally {
      setBusy(false);
    }
  };

  const saveStory = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    const words = wordCount(storyForm.body);
    if (storyForm.editorial_status !== "draft" && words < 400) {
      setError(`Published stories need at least 400 words. Current: ${words}.`);
      return;
    }
    if (!storyForm.image && storyForm.editorial_status !== "draft") {
      setError("Add a JPG/PNG main image before publishing (required for professional share cards).");
      return;
    }
    const payload = {
      ...storyForm,
      tags: storyForm.tags.split(",").map((x) => x.trim()).filter(Boolean),
      read_time: `${Math.max(1, Math.ceil(words / 180))} min read`,
    };
    if (editingId) {
      await post({
        action: "article_update",
        id: editingId,
        ...payload,
        editorial_status: storyForm.editorial_status === "draft" ? "hidden" : storyForm.editorial_status,
      });
      setEditingId(null);
    } else {
      await post({ action: "article_create", ...payload });
    }
    setStoryForm(emptyForm);
  };

  const editArticle = async (id: string) => {
    setBusy(true);
    setError("");
    try {
      const result = await api({ method: "POST", body: JSON.stringify({ action: "article_get", id }) });
      const a = result.article;
      setEditingId(String(a.id));
      setStoryForm({
        headline: String(a.original_title || a.ai_hook_title || ""),
        description: String(a.original_description || ""),
        body: String(a.body || ""),
        category: String(a.category || "World"),
        region: String(a.region || "Global"),
        story_type: String(a.story_type || "WIRE"),
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
          <p className="mt-2 text-sm text-neutral-500">Newsroom control — wire, explainers, profiles, features.</p>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="mt-5 h-11 w-full border px-3" placeholder="Admin password" required />
          <button disabled={busy} className="mt-3 h-11 w-full bg-neutral-950 text-sm font-bold text-white disabled:opacity-50">Sign in</button>
          {error ? <p className="mt-3 text-xs text-red-700">{error}</p> : null}
        </form>
      </div>
    );
  }

  const articles = Array.isArray(data.articles) ? data.articles : [];

  return (
    <div className="min-h-dvh bg-neutral-100 text-neutral-950">
      <Helmet>
        <title>RockBrief Admin</title>
        <meta name="robots" content="noindex,nofollow" />
      </Helmet>
      <header className="sticky top-0 z-40 border-b bg-neutral-950 text-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-4">
          <div>
            <p className="text-[10px] font-bold tracking-[0.18em] text-amber-400 uppercase">Newsroom</p>
            <h1 className="font-display text-xl font-semibold">RockBrief Admin</h1>
          </div>
          <div className="flex items-center gap-2">
            <a href="/" className="border border-neutral-700 px-3 py-2 text-xs font-semibold text-amber-400">Open site</a>
            <button type="button" onClick={() => void logout()} className="grid size-9 place-items-center border border-neutral-700" aria-label="Log out">
              <LogOut className="size-4" />
            </button>
          </div>
        </div>
        <nav className="mx-auto flex max-w-5xl gap-2 px-4 pb-3">
          <button type="button" onClick={() => setTab("news")} className={tab === "news" ? "flex items-center gap-2 rounded-full bg-white px-3 py-2 text-xs font-bold text-neutral-950" : "flex items-center gap-2 rounded-full px-3 py-2 text-xs font-semibold text-neutral-400"}>
            <Newspaper className="size-3.5" /> Newsroom
          </button>
          <button type="button" onClick={() => setTab("dashboard")} className={tab === "dashboard" ? "flex items-center gap-2 rounded-full bg-white px-3 py-2 text-xs font-bold text-neutral-950" : "flex items-center gap-2 rounded-full px-3 py-2 text-xs font-semibold text-neutral-400"}>
            <BarChart3 className="size-3.5" /> Overview
          </button>
        </nav>
      </header>

      <main className="mx-auto max-w-5xl space-y-6 px-4 py-6">
        {error ? <div className="border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</div> : null}

        {tab === "dashboard" ? (
          <section className="space-y-4">
            <h2 className="font-display text-2xl font-semibold">Overview</h2>
            <div className="grid gap-3 sm:grid-cols-3">
              {Object.entries(data.overview || {}).slice(0, 9).map(([k, v]) => (
                <div key={k} className="rounded-xl border bg-white p-4">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-neutral-500">{k.replace(/_/g, " ")}</p>
                  <p className="mt-1 text-2xl font-semibold">{Number(v || 0).toLocaleString()}</p>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {tab === "news" ? (
          <section className="space-y-6">
            <div>
              <h2 className="font-display text-2xl font-semibold">Newsroom</h2>
              <p className="mt-1 text-sm text-neutral-600">Wire · Explainers · Profiles · Features — professional desk standards.</p>
            </div>

            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
              <p className="flex items-center gap-2 font-bold"><ShieldCheck className="size-4" /> Trust checklist</p>
              <ul className="mt-1 list-disc space-y-0.5 pl-5 text-xs sm:text-sm">
                <li>Published pieces need <strong>400+ words</strong>.</li>
                <li>Story type Explainer / Biography auto-sets section + tags.</li>
                <li>Main image <strong>JPG/PNG</strong> with credit and license (share cards).</li>
                <li>Label opinion as <strong>Commentary</strong> — never as wire.</li>
                <li>Wire needs source URL; original work uses RockBrief byline.</li>
              </ul>
            </div>

            <form onSubmit={saveStory} className="grid gap-3 rounded-2xl border bg-white p-4 sm:p-6 md:grid-cols-2">
              <p className="md:col-span-2 text-xs font-bold uppercase tracking-wide text-neutral-500">{editingId ? "Edit article" : "Create article"}</p>
              <input required placeholder="Headline" value={storyForm.headline} onChange={(e) => setStoryForm((v) => ({ ...v, headline: e.target.value }))} className="h-11 border px-3 text-sm md:col-span-2" />
              <textarea required placeholder="Short description / lead" value={storyForm.description} onChange={(e) => setStoryForm((v) => ({ ...v, description: e.target.value }))} className="min-h-24 border p-3 text-sm md:col-span-2" />
              <div className="md:col-span-2">
                <label className="mb-2 block text-xs font-bold uppercase tracking-wide text-neutral-500">Full article</label>
                <RichArticleEditor value={storyForm.body} onChange={(body) => setStoryForm((v) => ({ ...v, body }))} onImageUpload={uploadStoryImage} minWords={400} placeholder="Write the full article…" />
              </div>
              <div className="space-y-1">
                <label className="block text-[10px] font-bold uppercase tracking-wide text-neutral-500">Story type</label>
                <select value={storyForm.story_type} onChange={(e) => onStoryType(e.target.value)} className="h-11 w-full border px-3 text-sm">
                  <option value="WIRE">Wire — sourced news</option>
                  <option value="DEVELOPING">Developing — breaking</option>
                  <option value="RockBrief ORIGINAL">Original — RockBrief reporting</option>
                  <option value="FEATURE">Feature — long-form</option>
                  <option value="EXPLAINER">Explainer — what this means</option>
                  <option value="BIO">Biography — who is…</option>
                  <option value="PROFILE">Profile — person / org</option>
                  <option value="COMMENTARY">Commentary — labeled opinion</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="block text-[10px] font-bold uppercase tracking-wide text-neutral-500">Section</label>
                <select value={storyForm.category} onChange={(e) => setStoryForm((v) => ({ ...v, category: e.target.value }))} className="h-11 w-full border px-3 text-sm">
                  <option>World</option><option>Business</option><option>Explainers</option><option>Profiles</option>
                  <option>Sports</option><option>Tech</option><option>Crypto</option><option>Entertainment</option>
                  <option>Africa</option><option>Nigeria</option><option>Ghana</option>
                  <option>Europe</option><option>Middle East</option><option>Asia</option><option>North America</option>
                </select>
              </div>
              <select value={storyForm.region} onChange={(e) => setStoryForm((v) => ({ ...v, region: e.target.value }))} className="h-11 border px-3 text-sm">
                <option>Global</option><option>Africa</option><option>Nigeria</option><option>Ghana</option>
                <option>Europe</option><option>Middle East</option><option>Asia</option><option>North America</option>
              </select>
              <input placeholder="Subject (person / company / event)" value={storyForm.subject} onChange={(e) => setStoryForm((v) => ({ ...v, subject: e.target.value }))} className="h-11 border px-3 text-sm" />
              <input placeholder="Author / byline" value={storyForm.author_name} onChange={(e) => setStoryForm((v) => ({ ...v, author_name: e.target.value }))} className="h-11 border px-3 text-sm" />
              <input placeholder="Source URL (required for wire)" value={storyForm.original_url} onChange={(e) => setStoryForm((v) => ({ ...v, original_url: e.target.value }))} className="h-11 border px-3 text-sm md:col-span-2" />
              <input placeholder="Tags (comma separated)" value={storyForm.tags} onChange={(e) => setStoryForm((v) => ({ ...v, tags: e.target.value }))} className="h-11 border px-3 text-sm md:col-span-2" />
              <div className="space-y-2 md:col-span-2">
                <label className="block text-xs font-bold uppercase tracking-wide text-neutral-500">Main image · JPG/PNG for share cards</label>
                <input type="file" accept="image/jpeg,image/png,image/webp,image/avif" disabled={busy} onChange={(e) => { const f = e.target.files?.[0]; if (f) void uploadStoryImage(f); }} className="block w-full border p-3 text-sm" />
                <input type="url" placeholder="Or paste image URL" value={storyForm.image} onChange={(e) => setStoryForm((v) => ({ ...v, image: e.target.value }))} className="h-11 w-full border px-3 text-sm" />
                {storyForm.image ? <img src={storyForm.image} alt="" className="mt-2 max-h-40 rounded-lg object-cover" /> : null}
              </div>
              <input placeholder="Image credit" value={storyForm.image_credit} onChange={(e) => setStoryForm((v) => ({ ...v, image_credit: e.target.value }))} className="h-11 border px-3 text-sm" />
              <input placeholder="Image license" value={storyForm.image_license} onChange={(e) => setStoryForm((v) => ({ ...v, image_license: e.target.value }))} className="h-11 border px-3 text-sm" />
              <select value={storyForm.editorial_status} onChange={(e) => setStoryForm((v) => ({ ...v, editorial_status: e.target.value }))} className="h-11 border px-3 text-sm">
                <option value="published">Published</option>
                <option value="draft">Draft</option>
                <option value="pending">Pending review</option>
              </select>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={storyForm.featured} onChange={(e) => setStoryForm((v) => ({ ...v, featured: e.target.checked }))} /> Featured</label>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={storyForm.pinned} onChange={(e) => setStoryForm((v) => ({ ...v, pinned: e.target.checked }))} /> Pinned</label>
              <div className="flex flex-wrap gap-2 md:col-span-2">
                <button type="submit" disabled={busy} className="h-11 bg-neutral-950 px-5 text-sm font-bold text-white disabled:opacity-50">{editingId ? "Save changes" : "Publish / save"}</button>
                {editingId ? <button type="button" onClick={() => { setEditingId(null); setStoryForm(emptyForm); }} className="h-11 border px-4 text-sm font-semibold">Cancel edit</button> : null}
              </div>
            </form>

            <div className="rounded-2xl border bg-white">
              <div className="border-b px-4 py-3"><h3 className="font-semibold">Recent articles</h3></div>
              <div className="divide-y">
                {articles.slice(0, 40).map((a: any) => (
                  <div key={a.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                    <div>
                      <p className="text-[10px] font-bold uppercase text-amber-800">{a.story_type || "WIRE"} · {a.category || "News"} · {a.editorial_status || "published"}</p>
                      <p className="font-semibold">{a.ai_hook_title || a.original_title || a.id}</p>
                    </div>
                    <button type="button" disabled={busy} onClick={() => void editArticle(String(a.id))} className="border px-3 py-1.5 text-xs font-bold">Edit</button>
                  </div>
                ))}
                {!articles.length ? <p className="p-4 text-sm text-neutral-500">No articles returned from admin API yet.</p> : null}
              </div>
            </div>
          </section>
        ) : null}
      </main>
    </div>
  );
}
