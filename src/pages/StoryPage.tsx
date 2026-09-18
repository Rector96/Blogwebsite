import { useEffect, useMemo, useState } from "react";
import { Helmet } from "react-helmet-async";
import { ExternalLink } from "lucide-react";
import { supabase } from "../lib/supabase";
import { logRwdNewsEvent } from "../lib/analytics";
import type { EnrichedArticle } from "../App";

function slugify(value: string) {
  return value.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 90);
}

function currentStoryId() {
  const path = window.location.pathname.replace(/^\/news\//, "");
  const marker = path.lastIndexOf("--");
  return marker >= 0 ? decodeURIComponent(path.slice(marker + 2)) : "";
}

export default function StoryPage() {
  const [article, setArticle] = useState<EnrichedArticle | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const id = currentStoryId();
    let cancelled = false;
    async function load() {
      try {
        if (supabase && id) {
          const { data } = await supabase.from("articles").select("*").eq("id", id).maybeSingle();
          if (data && !cancelled) {
            setArticle({
              ...data,
              ai_summary: Array.isArray(data.ai_summary) ? data.ai_summary : [],
              tags: Array.isArray(data.tags) ? data.tags : [],
            } as EnrichedArticle);
          }
        }
        if (!article && id) {
          const response = await fetch("/api/news");
          const payload = await response.json();
          const found = Array.isArray(payload.articles) ? payload.articles.find((x: EnrichedArticle) => x.id === id) : null;
          if (found && !cancelled) setArticle(found);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!article) return;
    void logRwdNewsEvent({ event: "article_open", articleId: article.id, articleUrl: article.original_url, placement: "story_page" });
  }, [article]);

  const title = article?.ai_hook_title || article?.original_title || "RWDNEWS story";
  const canonical = typeof window !== "undefined" ? window.location.href : "https://rwdnews.netlify.app/";
  const description = article?.ai_summary?.[0] || article?.original_description || "Source-backed global news briefing from RWDNEWS.";
  const jsonLd = useMemo(() => article ? {
    "@context": "https://schema.org",
    "@type": "NewsArticle",
    headline: title,
    description,
    datePublished: article.timestamp,
    dateModified: article.timestamp,
    mainEntityOfPage: canonical,
    url: canonical,
    image: article.image ? [article.image] : undefined,
    author: { "@type": "Organization", name: "RWDNEWS" },
    publisher: { "@type": "Organization", name: "RWDNEWS" },
    isBasedOn: article.original_url,
  } : null, [article, title, description, canonical]);

  if (loading) return <div className="grid min-h-dvh place-items-center text-sm text-neutral-500">Loading briefing…</div>;

  if (!article) {
    return <div className="grid min-h-dvh place-items-center p-6 text-center"><div><h1 className="font-display text-3xl font-semibold">Story not found</h1><p className="mt-2 text-sm text-neutral-500">This story may have expired from the live wire.</p><a href="/" className="mt-5 inline-block font-semibold text-teal-800">Return to RWDNEWS →</a></div></div>;
  }

  const share = (network: string) => {
    const encoded = encodeURIComponent(canonical);
    const text = encodeURIComponent(title);
    const urls: Record<string, string> = {
      whatsapp: "https://wa.me/?text=" + text + "%20" + encoded,
      telegram: "https://t.me/share/url?url=" + encoded + "&text=" + text,
      x: "https://twitter.com/intent/tweet?text=" + text + "&url=" + encoded,
      facebook: "https://www.facebook.com/sharer/sharer.php?u=" + encoded,
      linkedin: "https://www.linkedin.com/sharing/share-offsite/?url=" + encoded,
    };
    void logRwdNewsEvent({ event: "article_share", articleId: article.id, articleUrl: article.original_url, placement: network });
    window.open(urls[network], "_blank", "noopener,noreferrer");
  };

  return (
    <div className="min-h-dvh bg-white text-neutral-950">
      <Helmet>
        <title>{title} — RWDNEWS</title>
        <meta name="description" content={description} />
        <link rel="canonical" href={canonical} />
        <meta property="og:title" content={title} />
        <meta property="og:description" content={description} />
        <meta property="og:url" content={canonical} />
        <meta property="og:type" content="article" />
        <meta property="og:image" content={article.image} />
        <meta name="twitter:card" content="summary_large_image" />
        <script type="application/ld+json">{JSON.stringify(jsonLd)}</script>
      </Helmet>

      <header className="border-b border-neutral-200">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-5 sm:px-6">
          <a href="/" className="font-display text-2xl font-bold">RWDNEWS</a>
          <a href="/" className="text-sm font-semibold text-teal-800">Back to news</a>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6 sm:py-12">
        <p className="text-[10px] font-bold tracking-[0.16em] text-amber-800 uppercase">{article.source} · {article.category || "World"}</p>
        <h1 className="font-display mt-3 text-4xl leading-tight font-semibold sm:text-5xl">{title}</h1>
        <p className="mt-3 text-lg leading-relaxed text-neutral-600">{description}</p>
        <p className="mt-3 text-xs text-neutral-400">{article.read_time || "3 min read"} · Published {new Date(article.timestamp).toLocaleString()}</p>

        <img src={article.image} alt="" className="mt-8 aspect-[16/9] w-full object-cover bg-neutral-100" />
        <p className="mt-2 text-[10px] text-neutral-400">{article.image_credit ? "Image: " + article.image_credit : ""}{article.image_license ? " · " + article.image_license : ""}</p>

        <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_250px]">
          <article className="min-w-0">
            <div className="space-y-4 text-[17px] leading-[1.8] text-neutral-800">
              {article.original_description ? <p className="text-xl text-neutral-700">{article.original_description}</p> : null}
              <h2 className="font-display pt-4 text-2xl font-semibold">Key points</h2>
              <ul className="space-y-4">
                {(article.ai_summary?.length ? article.ai_summary : [article.original_description]).map((point, i) => <li key={i} className="flex gap-3"><span className="mt-3 size-1.5 shrink-0 rounded-full bg-neutral-900" /><span>{point}</span></li>)}
              </ul>
              <div className="border-l-2 border-teal-700 bg-teal-50 p-4 text-sm leading-relaxed text-neutral-700">
                RWDNEWS is a briefing layer. The original publisher remains the reference for the full report, additional context and updates.
              </div>
              <div className="flex flex-wrap gap-2 pt-2">{article.tags.map(t => <span key={t} className="bg-neutral-100 px-2.5 py-1 text-[11px] font-semibold text-neutral-600">{String(t).replace(/^#/, "")}</span>)}</div>
            </div>
            <div className="mt-8 border-t border-neutral-200 pt-6">
              <p className="mb-2 text-[10px] font-bold tracking-[0.14em] text-neutral-500 uppercase">Share</p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">{["whatsapp","telegram","x","facebook","linkedin"].map(n => <button key={n} onClick={() => share(n)} className="h-10 border text-xs font-semibold hover:bg-neutral-50">{n === "x" ? "X" : n[0].toUpperCase() + n.slice(1)}</button>)}</div>
            </div>
            <a href={article.original_url} target="_blank" rel="noopener noreferrer" className="mt-8 inline-flex items-center gap-2 border px-4 py-3 text-sm font-semibold">Read original source <ExternalLink className="size-3.5" /></a>
          </article>
        </div>
      </main>
    </div>
  );
}
