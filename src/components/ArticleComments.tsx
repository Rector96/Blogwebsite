import { useEffect, useState, type FormEvent } from "react";
import { supabase } from "../lib/supabase";

type Comment = {
  id: string;
  article_id: string;
  author_name: string;
  body: string;
  created_at: string;
};

/** Stable storage key — must include article id or threads mix */
function storageKey(articleId: string) {
  return "rwdnews_comments_v2_" + encodeURIComponent(String(articleId || ""));
}

function loadLocal(articleId: string): Comment[] {
  if (!articleId) return [];
  try {
    const raw = localStorage.getItem(storageKey(articleId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    // Hard filter: only rows for THIS article
    return parsed.filter(
      (c: Comment) => c && String(c.article_id) === String(articleId) && String(c.body || "").trim(),
    );
  } catch {
    return [];
  }
}

function saveLocal(articleId: string, list: Comment[]) {
  if (!articleId) return;
  try {
    const only = list.filter((c) => String(c.article_id) === String(articleId));
    localStorage.setItem(storageKey(articleId), JSON.stringify(only.slice(0, 100)));
  } catch {
    /* ignore quota */
  }
}

function timeAgo(iso: string) {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return "";
  const mins = Math.max(0, Math.round((Date.now() - t) / 60000));
  if (mins < 1) return "just now";
  if (mins < 60) return mins + "m ago";
  const h = Math.round(mins / 60);
  if (h < 48) return h + "h ago";
  return Math.round(h / 24) + "d ago";
}

export function ArticleComments({ articleId }: { articleId: string }) {
  const id = String(articleId || "").trim();
  const [comments, setComments] = useState<Comment[]>([]);
  const [name, setName] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    // Reset immediately so previous article's comments never flash
    setComments([]);
    setBody("");
    setError("");

    if (!id) return;

    async function load() {
      const local = loadLocal(id);
      if (!cancelled) setComments(local);

      if (!supabase) return;
      try {
        const { data, error: err } = await supabase
          .from("article_comments")
          .select("id,article_id,author_name,body,created_at")
          .eq("article_id", id)
          .eq("status", "visible")
          .order("created_at", { ascending: false })
          .limit(50);
        if (!err && Array.isArray(data) && !cancelled) {
          const rows = data
            .map((r: any) => ({
              id: String(r.id),
              article_id: String(r.article_id),
              author_name: String(r.author_name || "Guest"),
              body: String(r.body || ""),
              created_at: String(r.created_at || new Date().toISOString()),
            }))
            .filter((c) => c.article_id === id);
          setComments(rows);
          saveLocal(id, rows);
        }
      } catch {
        /* table may not exist — local only */
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (!id) {
    return null;
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    if (!id) {
      setError("Missing article id — cannot post comment.");
      return;
    }
    const author = name.trim().slice(0, 40) || "Guest";
    const text = body.trim().slice(0, 1200);
    if (text.length < 3) {
      setError("Write a short comment first.");
      return;
    }
    setBusy(true);
    const row: Comment = {
      id: "c-" + id.slice(0, 12) + "-" + Date.now().toString(36),
      article_id: id,
      author_name: author,
      body: text,
      created_at: new Date().toISOString(),
    };

    try {
      if (supabase) {
        const { error: err } = await supabase.from("article_comments").insert({
          id: row.id,
          article_id: id,
          author_name: author,
          body: text,
          status: "visible",
          created_at: row.created_at,
        });
        if (err) console.warn("[comments]", err.message);
      }
      const next = [row, ...comments.filter((c) => c.article_id === id)];
      setComments(next);
      saveLocal(id, next);
      setBody("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not post");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section
      className="mt-12 rounded-2xl border border-neutral-200 bg-white p-5 sm:p-7"
      data-article-id={id}
      key={"comments-" + id}
    >
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="text-[10px] font-extrabold tracking-[0.16em] text-amber-800 uppercase">Conversation</p>
          <h2 className="font-display mt-1 text-xl font-semibold sm:text-2xl">
            Comments ({comments.length})
          </h2>
        </div>
      </div>

      <form onSubmit={submit} className="mt-5 space-y-3">
        <p className="text-xs text-neutral-500">Commenting as Guest — no account required</p>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Name (optional)"
          className="h-11 w-full rounded-xl border border-neutral-200 px-3 text-sm"
          maxLength={40}
        />
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="What do you think?"
          className="min-h-24 w-full rounded-xl border border-neutral-200 p-3 text-sm"
          maxLength={1200}
          required
        />
        {error ? <p className="text-xs text-red-700">{error}</p> : null}
        <button
          type="submit"
          disabled={busy}
          className="rounded-xl bg-teal-800 px-5 py-2.5 text-sm font-bold text-white disabled:opacity-50"
        >
          {busy ? "Sending…" : "Send"}
        </button>
      </form>

      <div className="mt-8 divide-y divide-neutral-100">
        {comments.length === 0 ? (
          <p className="py-6 text-center text-sm text-neutral-500">Be the first to comment on this story.</p>
        ) : (
          comments.map((c) => (
            <article key={c.id} className="py-4">
              <div className="flex items-center gap-2">
                <span className="grid size-8 place-items-center rounded-full bg-amber-100 text-xs font-bold text-amber-900">
                  {(c.author_name || "G").slice(0, 1).toUpperCase()}
                </span>
                <div>
                  <p className="text-sm font-bold text-neutral-900">{c.author_name}</p>
                  <p className="text-[11px] text-neutral-400">{timeAgo(c.created_at)}</p>
                </div>
              </div>
              <p className="mt-2 text-[15px] leading-6 text-neutral-800 whitespace-pre-wrap">{c.body}</p>
            </article>
          ))
        )}
      </div>
    </section>
  );
}
