import { useEffect, useState, type FormEvent } from "react";
import { Helmet } from "react-helmet-async";
import { LogOut, Newspaper, BarChart3 } from "lucide-react";
import RichArticleEditor from "../components/RichArticleEditor";

type Dashboard = {
  overview?: Record<string, number>;
  articles?: any[];
};

const emptyForm = {
  headline: "",
  description: "",
  body: "",
  category: "World",
  region: "Global",
  story_type: "EXPLAINER",
  subject: "",
  author_name: "RockBrief Editorial",
  image: "",
  read_time: "3 min read",
  image_credit: "",
  image_license: "Editorial",
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

const field =
  "h-11 w-full rounded-lg border border-neutral-300 bg-white px-3 text-sm outline-none focus:border-neutral-900 focus:ring-1 focus:ring-neutral-900";

export default function AdminPage() {
  const [password, setPassword] = useState("");
  const [authed, setAuthed] = useState(false);
  const [data, setData] = useState<Dashboard | null>(null);
  const [tab, setTab] = useState<"news" | "dashboard">("news");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [storyForm, setStoryForm] = useState(emptyForm);
  const [showMore, setShowMore] = useState(false);

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
      }
      return { ...v, story_type, category, tags };
    });
  };

  const uploadStoryImage = async (file: File): Promise<string | null> => {
    if (!["image/jpeg", "image/png", "image/webp", "image/avif"].includes(file.type)) {
      setError("Use JPG, PNG, WebP or AVIF (not SVG).");
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
        body: JSON.stringify({
          action: "article_image_upload",
          filename: file.name,
          mime_type: file.type,
          data: dataUrl,
        }),
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

  const saveStory = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    const words = wordCount(storyForm.body);
    if (storyForm.editorial_status !== "draft" && words < 400) {
      setError(`Need ${400 - words} more words to publish (minimum 400). Or save as Draft.`);
      return;
    }
    if (!storyForm.image && storyForm.editorial_status !== "draft") {
      setError("Add a cover image (JPG/PNG) before publishing — needed for WhatsApp/Facebook cards.");
      return;
    }
    const payload = {
      ...storyForm,
      tags: storyForm.tags
        .split(",")
        .map((x) => x.trim())
        .filter(Boolean),
      read_time: `${Math.max(1, Math.ceil(words / 180))} min read`,
      image_credit: storyForm.image_credit || "RockBrief",
      image_license: storyForm.image_license || "Editorial",
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
    setShowMore(false);
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
        image_license: String(a.image_license || "Editorial"),
        image_source_url: String(a.image_source_url || ""),
        original_url: String(a.original_url || ""),
        tags: Array.isArray(a.tags)
          ? a.tags.map((x: unknown) => String(x).replace(/^#/, "")).join(", ")
          : "",
        publish_at: a.timestamp ? new Date(a.timestamp).toISOString().slice(0, 16) : "",
        editorial_status: a.editorial_status === "hidden" ? "draft" : String(a.editorial_status || "published"),
        featured: Boolean(a.featured),
        pinned: Boolean(a.pinned),
      });
      setShowMore(true);
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
        <form onSubmit={login} className="w-full max-w-sm rounded-2xl border border-neutral-800 bg-white p-6 shadow-2xl">
          <p className="text-[10px] font-bold tracking-[0.18em] text-amber-800 uppercase">Newsroom</p>
          <h1 className="font-display mt-2 text-3xl font-semibold">RockBrief Admin</h1>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-5 h-11 w-full rounded-lg border px-3"
            placeholder="Admin password"
            required
          />
          <button disabled={busy} className="mt-3 h-11 w-full rounded-lg bg-neutral-950 text-sm font-bold text-white disabled:opacity-50">
            Sign in
          </button>
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
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-3 py-3 sm:px-4">
          <div>
            <p className="text-[10px] font-bold tracking-[0.18em] text-amber-400 uppercase">Newsroom</p>
            <h1 className="font-display text-lg font-semibold sm:text-xl">Admin</h1>
          </div>
          <div className="flex items-center gap-2">
            <a href="/" className="rounded-full border border-neutral-700 px-3 py-1.5 text-xs font-semibold text-amber-400">
              Site
            </a>
            <button type="button" onClick={() => void logout()} className="grid size-9 place-items-center rounded-full border border-neutral-700" aria-label="Log out">
              <LogOut className="size-4" />
            </button>
          </div>
        </div>
        <nav className="mx-auto flex max-w-3xl gap-2 px-3 pb-3 sm:px-4">
          <button
            type="button"
            onClick={() => setTab("news")}
            className={
              "flex items-center gap-2 rounded-full px-3 py-2 text-xs font-bold " +
              (tab === "news" ? "bg-white text-neutral-950" : "text-neutral-400")
            }
          >
            <Newspaper className="size-3.5" /> Write
          </button>
          <button
            type="button"
            onClick={() => setTab("dashboard")}
            className={
              "flex items-center gap-2 rounded-full px-3 py-2 text-xs font-bold " +
              (tab === "dashboard" ? "bg-white text-neutral-950" : "text-neutral-400")
            }
          >
            <BarChart3 className="size-3.5" /> Stats
          </button>
        </nav>
      </header>

      <main className="mx-auto max-w-3xl space-y-5 px-3 py-5 sm:px-4">
        {error ? <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</div> : null}

        {tab === "dashboard" ? (
          <section className="grid gap-3 sm:grid-cols-3">
            {Object.entries(data.overview || {})
              .slice(0, 6)
              .map(([k, v]) => (
                <div key={k} className="rounded-xl border bg-white p-4">
                  <p className="text-[10px] font-bold uppercase text-neutral-500">{k.replace(/_/g, " ")}</p>
                  <p className="mt-1 text-2xl font-semibold">{Number(v || 0).toLocaleString()}</p>
                </div>
              ))}
          </section>
        ) : null}

        {tab === "news" ? (
          <section className="space-y-5">
            <form onSubmit={saveStory} className="space-y-4 rounded-2xl border bg-white p-4 sm:p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs font-bold uppercase tracking-wide text-neutral-500">
                  {editingId ? "Edit post" : "New post"}
                </p>
                <p className="text-[11px] text-neutral-500">Paste from Word below — headings stay</p>
              </div>

              {/* 1. Type */}
              <div>
                <label className="mb-1 block text-xs font-bold text-neutral-600">1. What is this?</label>
                <select value={storyForm.story_type} onChange={(e) => onStoryType(e.target.value)} className={field}>
                  <option value="EXPLAINER">Explainer — what this means</option>
                  <option value="BIO">Biography — who is…</option>
                  <option value="PROFILE">Profile</option>
                  <option value="RockBrief ORIGINAL">Original reporting</option>
                  <option value="FEATURE">Feature</option>
                  <option value="WIRE">Wire news</option>
                  <option value="DEVELOPING">Developing / breaking</option>
                  <option value="COMMENTARY">Commentary (opinion)</option>
                </select>
              </div>

              {/* 2. Headline */}
              <div>
                <label className="mb-1 block text-xs font-bold text-neutral-600">2. Headline</label>
                <input
                  required
                  value={storyForm.headline}
                  onChange={(e) => setStoryForm((v) => ({ ...v, headline: e.target.value }))}
                  className={field}
                  placeholder="Clear, searchable headline"
                />
              </div>

              {/* 3. Short lead / SEO */}
              <div>
                <label className="mb-1 block text-xs font-bold text-neutral-600">3. Short summary (1–2 lines)</label>
                <textarea
                  required
                  value={storyForm.description}
                  onChange={(e) => setStoryForm((v) => ({ ...v, description: e.target.value }))}
                  className="min-h-[72px] w-full rounded-lg border border-neutral-300 p-3 text-sm outline-none focus:border-neutral-900"
                  placeholder="Appears in search and share previews"
                />
              </div>

              {/* 4. Body — Word-like */}
              <div>
                <label className="mb-1 block text-xs font-bold text-neutral-600">4. Full article (paste from Word OK)</label>
                <RichArticleEditor
                  value={storyForm.body}
                  onChange={(body) => setStoryForm((v) => ({ ...v, body }))}
                  onImageUpload={uploadStoryImage}
                  minWords={400}
                  placeholder="Write here or paste from Microsoft Word…"
                />
              </div>

              {/* 5. Cover image */}
              <div>
                <label className="mb-1 block text-xs font-bold text-neutral-600">5. Cover image (JPG/PNG)</label>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/avif"
                  disabled={busy}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void uploadStoryImage(f);
                  }}
                  className="block w-full text-sm"
                />
                <input
                  type="url"
                  value={storyForm.image}
                  onChange={(e) => setStoryForm((v) => ({ ...v, image: e.target.value }))}
                  className={field + " mt-2"}
                  placeholder="Or paste image URL"
                />
                {storyForm.image ? (
                  <img src={storyForm.image} alt="" className="mt-2 max-h-36 w-full rounded-lg object-cover" />
                ) : null}
              </div>

              {/* 6. Publish status */}
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-bold text-neutral-600">6. Status</label>
                  <select
                    value={storyForm.editorial_status}
                    onChange={(e) => setStoryForm((v) => ({ ...v, editorial_status: e.target.value }))}
                    className={field}
                  >
                    <option value="published">Publish now</option>
                    <option value="draft">Save as draft</option>
                    <option value="pending">Pending review</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-bold text-neutral-600">Section</label>
                  <select
                    value={storyForm.category}
                    onChange={(e) => setStoryForm((v) => ({ ...v, category: e.target.value }))}
                    className={field}
                  >
                    <option>Explainers</option>
                    <option>Profiles</option>
                    <option>World</option>
                    <option>Business</option>
                    <option>Sports</option>
                    <option>Tech</option>
                    <option>Africa</option>
                    <option>Nigeria</option>
                    <option>Ghana</option>
                  </select>
                </div>
              </div>

              {/* Optional more */}
              <button
                type="button"
                onClick={() => setShowMore((v) => !v)}
                className="text-xs font-bold text-teal-800"
              >
                {showMore ? "Hide extra fields ▲" : "More options (tags, source, byline) ▼"}
              </button>

              {showMore ? (
                <div className="grid gap-3 rounded-xl border border-neutral-200 bg-neutral-50 p-3 sm:grid-cols-2">
                  <input
                    className={field}
                    placeholder="Tags (comma separated)"
                    value={storyForm.tags}
                    onChange={(e) => setStoryForm((v) => ({ ...v, tags: e.target.value }))}
                  />
                  <input
                    className={field}
                    placeholder="Author / byline"
                    value={storyForm.author_name}
                    onChange={(e) => setStoryForm((v) => ({ ...v, author_name: e.target.value }))}
                  />
                  <input
                    className={field + " sm:col-span-2"}
                    placeholder="Source URL (for wire stories)"
                    value={storyForm.original_url}
                    onChange={(e) => setStoryForm((v) => ({ ...v, original_url: e.target.value }))}
                  />
                  <input
                    className={field}
                    placeholder="Image credit"
                    value={storyForm.image_credit}
                    onChange={(e) => setStoryForm((v) => ({ ...v, image_credit: e.target.value }))}
                  />
                  <select
                    value={storyForm.region}
                    onChange={(e) => setStoryForm((v) => ({ ...v, region: e.target.value }))}
                    className={field}
                  >
                    <option>Global</option>
                    <option>Africa</option>
                    <option>Nigeria</option>
                    <option>Ghana</option>
                    <option>Europe</option>
                    <option>Middle East</option>
                    <option>Asia</option>
                    <option>North America</option>
                  </select>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={storyForm.featured}
                      onChange={(e) => setStoryForm((v) => ({ ...v, featured: e.target.checked }))}
                    />
                    Featured
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={storyForm.pinned}
                      onChange={(e) => setStoryForm((v) => ({ ...v, pinned: e.target.checked }))}
                    />
                    Pinned
                  </label>
                </div>
              ) : null}

              <div className="flex flex-wrap gap-2 pt-1">
                <button
                  type="submit"
                  disabled={busy}
                  className="h-12 min-w-[140px] flex-1 rounded-xl bg-neutral-950 text-sm font-bold text-white disabled:opacity-50 sm:flex-none"
                >
                  {busy ? "Saving…" : editingId ? "Save changes" : "Publish"}
                </button>
                {editingId ? (
                  <button
                    type="button"
                    onClick={() => {
                      setEditingId(null);
                      setStoryForm(emptyForm);
                      setShowMore(false);
                    }}
                    className="h-12 rounded-xl border px-4 text-sm font-semibold"
                  >
                    Cancel
                  </button>
                ) : null}
              </div>
            </form>

            <div className="rounded-2xl border bg-white">
              <div className="border-b px-4 py-3">
                <h3 className="font-semibold">Your posts</h3>
              </div>
              <div className="divide-y">
                {articles.slice(0, 30).map((a: any) => (
                  <div key={a.id} className="flex items-center justify-between gap-2 px-4 py-3">
                    <div className="min-w-0">
                      <p className="text-[10px] font-bold uppercase text-amber-800">
                        {a.story_type || "WIRE"} · {a.category || "News"}
                      </p>
                      <p className="truncate font-semibold">{a.ai_hook_title || a.original_title || a.id}</p>
                    </div>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void editArticle(String(a.id))}
                      className="shrink-0 rounded-lg border px-3 py-1.5 text-xs font-bold"
                    >
                      Edit
                    </button>
                  </div>
                ))}
                {!articles.length ? <p className="p-4 text-sm text-neutral-500">No posts yet — publish your first explainer above.</p> : null}
              </div>
            </div>
          </section>
        ) : null}
      </main>
    </div>
  );
}
