import { useState } from "react";
import { Helmet } from "react-helmet-async";
import { SiteFooter } from "../components/SiteFooter";
import { isSupabaseConfigured, supabase } from "../lib/supabase";

export default function SubmitPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("Nigeria");
  const [body, setBody] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);
    if (!title.trim() || !body.trim() || !email.includes("@")) {
      setMsg("Please add your email, a title, and the story text.");
      return;
    }
    setSending(true);
    try {
      if (isSupabaseConfigured && supabase) {
        const { error } = await supabase.from("article_submissions").insert({
          author_name: name.trim() || "Anonymous",
          author_email: email.trim().toLowerCase(),
          title: title.trim(),
          category,
          body: body.trim(),
          source_url: sourceUrl.trim() || null,
          status: "pending",
          created_at: new Date().toISOString(),
        });
        if (error) throw error;
      } else {
        // Fallback: Netlify Forms-style endpoint if table not ready
        await fetch("/", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            "form-name": "article-submit",
            name,
            email,
            title,
            category,
            body,
            sourceUrl,
          }).toString(),
        });
      }
      setMsg("Submitted. Our editors will review before anything is published.");
      setTitle("");
      setBody("");
      setSourceUrl("");
      setName("");
    } catch {
      setMsg(
        "We received your details where possible. If this keeps failing, email the story to the team and we will review it.",
      );
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="min-h-dvh bg-[#f5f7f7] text-neutral-950">
      <Helmet>
        <title>Submit a story — RWDNEWS</title>
        <meta
          name="description"
          content="Pitch or submit a story to RWDNEWS. Editors review every submission before publishing."
        />
      </Helmet>

      <header className="border-b border-neutral-200 bg-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-4 sm:px-6">
          <a href="/">
            <img src="/rwdnews-logo.svg" alt="RWDNEWS" className="h-auto w-[160px]" />
          </a>
          <a href="/" className="text-xs font-bold text-teal-800">
            ← Back to news
          </a>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <p className="text-[10px] font-extrabold tracking-[0.16em] text-amber-800 uppercase">
          Community desk
        </p>
        <h1 className="font-display mt-2 text-3xl font-semibold sm:text-4xl">Submit a story</h1>
        <p className="mt-3 text-sm leading-relaxed text-neutral-600 sm:text-base">
          RWDNEWS summarizes the wire for readers and credits original sources. You can also send an
          original tip or story. Nothing goes live until an editor reviews it.
        </p>

        <form
          name="article-submit"
          data-netlify="true"
          netlify-honeypot="bot-field"
          onSubmit={onSubmit}
          className="mt-8 space-y-4 rounded-2xl border border-neutral-200 bg-white p-5 sm:p-7"
        >
          <input type="hidden" name="form-name" value="article-submit" />
          <p className="hidden">
            <label>
              Don’t fill this out: <input name="bot-field" />
            </label>
          </p>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm">
              <span className="font-semibold">Your name</span>
              <input
                className="mt-1 h-11 w-full border border-neutral-200 px-3"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Optional"
              />
            </label>
            <label className="block text-sm">
              <span className="font-semibold">Email *</span>
              <input
                required
                type="email"
                className="mt-1 h-11 w-full border border-neutral-200 px-3"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@email.com"
              />
            </label>
          </div>

          <label className="block text-sm">
            <span className="font-semibold">Headline *</span>
            <input
              required
              className="mt-1 h-11 w-full border border-neutral-200 px-3"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Clear, factual headline"
            />
          </label>

          <label className="block text-sm">
            <span className="font-semibold">Category</span>
            <select
              className="mt-1 h-11 w-full border border-neutral-200 px-3"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              {["Nigeria", "Africa", "World", "Sports", "Business", "Tech", "Entertainment"].map(
                (c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ),
              )}
            </select>
          </label>

          <label className="block text-sm">
            <span className="font-semibold">Story / tip *</span>
            <textarea
              required
              rows={8}
              className="mt-1 w-full border border-neutral-200 px-3 py-2 leading-relaxed"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Write the facts in your own words. Name places, people, and dates when you can."
            />
          </label>

          <label className="block text-sm">
            <span className="font-semibold">Source link (optional)</span>
            <input
              className="mt-1 h-11 w-full border border-neutral-200 px-3"
              value={sourceUrl}
              onChange={(e) => setSourceUrl(e.target.value)}
              placeholder="https://…"
            />
          </label>

          <p className="text-xs text-neutral-500">
            By submitting, you confirm the information is accurate to the best of your knowledge. We
            may edit for clarity and will not publish until verified.
          </p>

          <button
            type="submit"
            disabled={sending}
            className="h-12 w-full bg-neutral-950 text-sm font-bold text-white disabled:opacity-60"
          >
            {sending ? "Sending…" : "Submit for review"}
          </button>
          {msg ? <p className="text-sm font-medium text-teal-800">{msg}</p> : null}
        </form>

        <p className="mt-6 text-sm text-neutral-500">
          Tip: For the database table, run in Supabase:{" "}
          <code className="rounded bg-neutral-100 px-1 text-xs">
            create table article_submissions (id uuid default gen_random_uuid() primary key,
            author_name text, author_email text, title text, category text, body text, source_url
            text, status text default 'pending', created_at timestamptz default now());
          </code>
        </p>
      </main>

      <SiteFooter />
    </div>
  );
}
