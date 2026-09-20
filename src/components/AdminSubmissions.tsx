import { useEffect, useState } from "react";
import { isSupabaseConfigured, supabase } from "../lib/supabase";

type Submission = {
  id: string;
  author_name: string | null;
  author_email: string | null;
  title: string;
  category: string | null;
  body: string;
  source_url: string | null;
  status: string;
  created_at: string;
};

/** Admin panel: review user submissions — only approved items go live */
export function AdminSubmissions() {
  const [items, setItems] = useState<Submission[]>([]);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  const load = async () => {
    if (!isSupabaseConfigured || !supabase) {
      setMsg("Connect Supabase to review submissions.");
      return;
    }
    const { data, error } = await supabase
      .from("article_submissions")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) {
      setMsg(error.message);
      return;
    }
    setItems((data as Submission[]) || []);
  };

  useEffect(() => {
    void load();
  }, []);

  const setStatus = async (id: string, status: "approved" | "rejected" | "pending") => {
    if (!supabase) return;
    setBusy(true);
    setMsg("");
    try {
      const { error } = await supabase.from("article_submissions").update({ status }).eq("id", id);
      if (error) throw error;
      if (status === "approved") {
        const row = items.find((x) => x.id === id);
        if (row) {
          await supabase.from("articles").upsert(
            {
              id: "sub-" + id,
              original_url: row.source_url || "https://rwdnews.netlify.app/submit#" + id,
              original_title: row.title,
              original_description: row.body.slice(0, 280),
              ai_hook_title: row.title,
              ai_summary: [row.body.slice(0, 400)],
              body: row.body,
              tags: ["#Community"],
              source: row.author_name || "Community",
              image: "https://rwdnews.netlify.app/rwdnews-logo.svg",
              read_time: "3 min read",
              timestamp: new Date().toISOString(),
              category: row.category || "World",
              region: "Global",
              story_type: "RWDNEWS ORIGINAL",
              editorial_status: "published",
              author_name: row.author_name || "Community",
            },
            { onConflict: "original_url" },
          );
        }
      }
      setMsg(status === "approved" ? "Approved and published to the site." : `Marked ${status}.`);
      await load();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Update failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="space-y-4">
      <div>
        <h2 className="font-display text-2xl font-semibold">Community submissions</h2>
        <p className="mt-1 text-sm text-neutral-600">
          Users submit via /submit. Nothing goes live until you approve.
        </p>
      </div>
      {msg ? <p className="text-sm text-teal-800">{msg}</p> : null}
      <div className="space-y-3">
        {items.map((item) => (
          <article key={item.id} className="border border-neutral-200 bg-white p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-amber-800">
                  {item.status} · {item.category || "News"}
                </p>
                <h3 className="font-display mt-1 text-lg font-semibold">{item.title}</h3>
                <p className="mt-1 text-xs text-neutral-500">
                  {item.author_name || "Anonymous"} · {item.author_email} ·{" "}
                  {new Date(item.created_at).toLocaleString()}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={busy || item.status === "approved"}
                  onClick={() => void setStatus(item.id, "approved")}
                  className="bg-teal-800 px-3 py-1.5 text-xs font-bold text-white disabled:opacity-40"
                >
                  Approve & publish
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void setStatus(item.id, "rejected")}
                  className="border border-neutral-300 px-3 py-1.5 text-xs font-bold"
                >
                  Reject
                </button>
              </div>
            </div>
            <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-neutral-700">{item.body}</p>
            {item.source_url ? (
              <a
                href={item.source_url}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-block text-xs font-semibold text-teal-800"
              >
                Source link →
              </a>
            ) : null}
          </article>
        ))}
        {!items.length ? <p className="text-sm text-neutral-500">No submissions yet.</p> : null}
      </div>
    </section>
  );
}
