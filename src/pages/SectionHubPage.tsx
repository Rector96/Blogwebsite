import { useEffect, useState } from "react";
import { Helmet } from "react-helmet-async";
import { SiteFooter } from "../components/SiteFooter";
import type { EnrichedArticle } from "../App";

type Mode = "explainers" | "profiles";

function isExplainer(a: EnrichedArticle) {
  const cat = String(a.category || "").toLowerCase();
  const tags = (a.tags || []).map((t) => String(t).toLowerCase());
  const type = String((a as any).story_type || "").toLowerCase();
  return (
    type === "explainer" ||
    type === "feature" ||
    cat === "explainers" ||
    cat === "explainer" ||
    tags.some((t) => t.includes("explainer") || t === "#explainer")
  );
}

function isProfile(a: EnrichedArticle) {
  const cat = String(a.category || "").toLowerCase();
  const tags = (a.tags || []).map((t) => String(t).toLowerCase());
  const type = String((a as any).story_type || "").toLowerCase();
  return (
    type === "bio" ||
    type === "profile" ||
    cat === "profiles" ||
    cat === "biography" ||
    cat === "bio" ||
    tags.some((t) => t.includes("biography") || t.includes("profile") || t === "#bio")
  );
}

function slug(title: string, id: string) {
  return (
    String(title || "story")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 90) +
    "--" +
    encodeURIComponent(id)
  );
}

export default function SectionHubPage({ mode }: { mode: Mode }) {
  const [items, setItems] = useState<EnrichedArticle[]>([]);
  const [loading, setLoading] = useState(true);

  const title = mode === "explainers" ? "Explainers" : "Profiles";
  const blurb =
    mode === "explainers"
      ? "Clear guides that connect global events to what they mean — markets, energy, sport and more."
      : "Who’s who: concise profiles and timelines of people shaping the news.";

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch("/api/news");
        const data = await res.json();
        const pool: EnrichedArticle[] = Array.isArray(data.articles) ? data.articles : [];
        const filtered =
          mode === "explainers" ? pool.filter(isExplainer) : pool.filter(isProfile);
        if (!cancelled) setItems(filtered);
      } catch {
        if (!cancelled) setItems([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [mode]);

  return (
    <div className="min-h-dvh bg-[#f5f7f7] text-neutral-950">
      <Helmet>
        <title>{title} — RockBrief</title>
        <meta name="description" content={blurb} />
        <meta property="og:title" content={`${title} — RockBrief`} />
        <meta property="og:description" content={blurb} />
        <meta property="og:type" content="website" />
      </Helmet>

      <div className="border-b border-neutral-900 bg-[#071a2d] text-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-2 sm:px-6">
          <a href="/" className="text-[10px] font-extrabold tracking-[0.18em] text-amber-300 uppercase">
            RockBrief
          </a>
          <nav className="flex flex-wrap gap-3 text-[10px] font-bold text-white/80">
            <a href="/" className="hover:text-white">
              News
            </a>
            <a href="/explainers" className="hover:text-white">
              Explainers
            </a>
            <a href="/profiles" className="hover:text-white">
              Profiles
            </a>
            <a href="/sport" className="hover:text-white">
              Sport
            </a>
          </nav>
        </div>
      </div>

      <header className="border-b border-neutral-200 bg-white">
        <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
          <p className="text-[10px] font-extrabold tracking-[0.2em] text-amber-800 uppercase">
            RockBrief desk
          </p>
          <h1 className="font-display mt-2 text-3xl font-semibold sm:text-4xl">{title}</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-neutral-600 sm:text-base">{blurb}</p>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        {loading ? (
          <p className="text-sm text-neutral-500">Loading…</p>
        ) : items.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-neutral-300 bg-white p-8 text-center">
            <p className="font-display text-xl font-semibold">Nothing in this section yet</p>
            <p className="mt-2 text-sm text-neutral-600">
              Publish from Admin with category <strong>{mode === "explainers" ? "Explainers" : "Profiles"}</strong>{" "}
              or tags <strong>#{mode === "explainers" ? "Explainer" : "Biography"}</strong>.
            </p>
            <a href="/admin" className="mt-4 inline-block text-sm font-bold text-teal-800">
              Open admin →
            </a>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((item) => {
              const headline = item.ai_hook_title || item.original_title;
              return (
                <a
                  key={item.id}
                  href={"/news/" + slug(headline, item.id)}
                  className="group overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                >
                  {item.image ? (
                    <img
                      src={item.image}
                      alt=""
                      className="aspect-[16/10] w-full object-cover bg-neutral-100"
                    />
                  ) : (
                    <div className="aspect-[16/10] w-full bg-gradient-to-br from-[#071a2d] to-[#0f766e]" />
                  )}
                  <div className="p-4">
                    <p className="text-[10px] font-bold uppercase tracking-wide text-amber-800">
                      {item.category || title}
                    </p>
                    <h2 className="mt-1 font-display text-lg font-semibold leading-snug group-hover:text-teal-900">
                      {headline}
                    </h2>
                    <p className="mt-2 line-clamp-3 text-sm text-neutral-600">
                      {String(item.original_description || "").slice(0, 160)}
                    </p>
                  </div>
                </a>
              );
            })}
          </div>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
