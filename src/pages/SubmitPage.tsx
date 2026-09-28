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
  const [location, setLocation] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [rightsConfirmed, setRightsConfirmed] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);
    if (!title.trim() || !body.trim() || !email.includes("@")) {
      setMsg("Please add your email, a headline, and the story details.");
      return;
    }
    if (!rightsConfirmed) {
      setMsg("Please confirm that you have permission to submit the material.");
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
          body: [
            location.trim() ? `Location: ${location.trim()}` : "",
            eventDate ? `Date of event: ${eventDate}` : "",
            body.trim(),
          ].filter(Boolean).join("\n\n"),
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
            body: [
              location.trim() ? `Location: ${location.trim()}` : "",
              eventDate ? `Date of event: ${eventDate}` : "",
              body.trim(),
            ].filter(Boolean).join("\n\n"),
            sourceUrl,
          }).toString(),
        });
      }
      setMsg("Submitted. Our editors will review before anything is published.");
      setTitle("");
      setBody("");
      setSourceUrl("");
      setLocation("");
      setEventDate("");
      setName("");
      setRightsConfirmed(false);
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
        <title>Submit a story — RockBrief</title>
        <meta
          name="description"
          content="Pitch or submit a story to RockBrief. Editors review every submission before publishing."
        />
      </Helmet>

      <header className="border-b border-neutral-200 bg-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-4 sm:px-6">
          <a href="/">
            <img src="/rwdnews-logo.svg" alt="RockBrief" className="h-auto w-[160px]" />
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
          Send a news tip, eyewitness report, original story or useful lead. Editors verify submissions
          before publication, and submitting does not guarantee publication.
        </p>
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          {[
            ["Facts first", "Tell us what happened, who was involved, where and when."],
            ["Evidence helps", "A source link is recommended when one exists."],
            ["Images are optional", "Only share photos you own or have permission to use."],
          ].map(([heading, text]) => (
            <div key={heading} className="rounded-xl border border-neutral-200 bg-white p-4">
              <p className="text-xs font-bold text-neutral-950">{heading}</p>
              <p className="mt-1 text-xs leading-relaxed text-neutral-500">{text}</p>
            </div>
          ))}
        </div>

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

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm">
              <span className="font-semibold">Where did it happen?</span>
              <input
                className="mt-1 h-11 w-full border border-neutral-200 px-3"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="City, country or venue"
              />
            </label>
            <label className="block text-sm">
              <span className="font-semibold">When did it happen?</span>
              <input
                type="date"
                className="mt-1 h-11 w-full border border-neutral-200 px-3"
                value={eventDate}
                onChange={(e) => setEventDate(e.target.value)}
              />
            </label>
          </div>

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

          <label className="flex items-start gap-3 rounded-xl border border-neutral-200 bg-neutral-50 p-3 text-xs text-neutral-600">
            <input
              type="checkbox"
              checked={rightsConfirmed}
              onChange={(e) => setRightsConfirmed(e.target.checked)}
              className="mt-0.5 size-4 shrink-0"
            />
            <span>
              I confirm that this submission is truthful to the best of my knowledge and that I have
              permission to share any text, documents or media I provide.
            </span>
          </label>

          <p className="text-xs leading-relaxed text-neutral-500">
            Images are optional. If you have a relevant photo, include its source/rights information in
            the story text. Never upload private, stolen or copyrighted material without permission.
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

        <div className="mt-6 rounded-xl border border-teal-100 bg-teal-50/60 p-4 text-xs leading-relaxed text-teal-900">
          <strong>What happens next?</strong> Your submission goes to the editorial queue. A reviewer may
          contact you for clarification, verify the information against independent sources, and edit for
          clarity. Nothing is published automatically.
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
