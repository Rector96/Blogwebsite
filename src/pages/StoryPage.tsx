import { sanitizeArticleHtml } from "../lib/rich-content";
import { useEffect, useMemo, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Check, Copy, ExternalLink, MessageCircle, Send } from "lucide-react";
import { supabase } from "../lib/supabase";
import { logRwdNewsEvent } from "../lib/analytics";
import { fetchSponsors, logSponsorClick, type SponsoredOffer } from "../lib/sponsors";
import { AdSlot } from "../components/AdSlot";
import type { EnrichedArticle } from "../App";
import { SiteFooter } from "../components/SiteFooter";

function currentStoryId() {
  const path = window.location.pathname.replace(/^\/news\//, "");
  const marker = path.lastIndexOf("--");
  return marker >= 0 ? decodeURIComponent(path.slice(marker + 2)) : "";
}

function cleanText(value: string) {
  let x = String(value || "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  x = x.replace(/\s*Read\s*More\s*:?\s*https?:\/\/\S+/gi, "");
  x = x.replace(/https?:\/\/\S+/gi, "");
  return x.replace(/\s+/g, " ").trim();
}

function isMetaLine(x: string) {
  return /limited to facts|supplied source material|source report remains|not add facts|meant to be read on RockBrief|without leaving the site|tracking this (developing )?story|source wire:|why this matters|rwdnews perspective|editorial context|full briefing on RockBrief|no need to leave/i.test(x);
}

function buildBriefing(article: EnrichedArticle) {
  const raw = (article.ai_summary?.length ? article.ai_summary : [article.original_description].filter(Boolean)).map((x) => cleanText(String(x)));
  let points = raw.filter(Boolean).filter((x) => !isMetaLine(x)).filter((x) => x.length > 15).slice(0, 4);
  const lead = points[0] || cleanText(article.original_description || article.original_title || "");
  return { points: points.length ? points : lead ? [lead] : [] };
}

function bodyWordCount(html: string) {
  return String(html || "").replace(/<[^>]*>/g, " ").replace(/&nbsp;/gi, " ").trim().split(/\s+/).filter(Boolean).length;
}

function PageLoader() {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center" style={{ background: "linear-gradient(160deg, #071a2d 0%, #0b3d4a 45%, #0f172a 100%)" }}>
      <div className="text-center px-6">
        <img src="/rwdnews-logo.svg" alt="RockBrief" className="mx-auto h-auto w-[min(78vw,240px)] brightness-0 invert" />
        <p className="mt-5 text-[11px] font-extrabold tracking-[0.2em] text-amber-300 uppercase">Loading story</p>
      </div>
    </div>
  );
}

export default function StoryPage() {
  const [article, setArticle] = useState<EnrichedArticle | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [sponsor, setSponsor] = useState<SponsoredOffer | null>(null);
  const [related, setRelated] = useState<EnrichedArticle[]>([]);

  useEffect(() => {
    void logRwdNewsEvent({ event: "page_view", placement: "story_page" });
    const id = currentStoryId();
    let cancelled = false;
    async function load() {
      try {
        let foundArticle: EnrichedArticle | null = null;
        if (supabase && id) {
          const { data } = await supabase.from("articles").select("*").eq("id", id).maybeSingle();
          if (data) foundArticle = { ...data, ai_summary: Array.isArray(data.ai_summary) ? data.ai_summary : [], tags: Array.isArray(data.tags) ? data.tags : [] } as EnrichedArticle;
        }
        if (!foundArticle && id) {
          const response = await fetch("/api/news");
          const payload = await response.json();
          const found = Array.isArray(payload.articles) ? payload.articles.find((x: EnrichedArticle) => x.id === id) : null;
          if (found) foundArticle = found;
        }
        if (foundArticle && !cancelled) {
          setArticle(foundArticle);
          try {
            const response = await fetch("/api/news");
            const payload = await response.json();
            const pool = Array.isArray(payload.articles) ? (payload.articles as EnrichedArticle[]) : [];
            if (!cancelled) setRelated(pool.filter((x) => x.id !== foundArticle!.id).slice(0, 6));
          } catch { /* ignore */ }
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    void fetchSponsors().then((items) => {
      if (!cancelled) setSponsor(items.find((item) => item.placement === "both" || item.placement === "in_feed") || items[0] || null);
    });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!article) return;
    void logRwdNewsEvent({ event: "article_open", articleId: article.id, placement: "story_page" });
  }, [article]);

  const title = article?.ai_hook_title || article?.original_title || "RockBrief story";
  const canonical = typeof window !== "undefined" ? window.location.origin + window.location.pathname : "";
  const absoluteLogo = typeof window !== "undefined" ? window.location.origin + "/rwdnews-logo.svg" : "/rwdnews-logo.svg";
  const briefing = article ? buildBriefing(article) : { points: [] as string[] };
  const description = briefing.points[0] || cleanText(article?.original_description || "");
  const seoDescription = cleanText(article?.original_description || "").slice(0, 160) || description.slice(0, 160);
  const words = article ? bodyWordCount(article.body || "") : 0;

  const jsonLd = useMemo(() => article ? {
    "@context": "https://schema.org",
    "@type": "NewsArticle",
    headline: title,
    description: seoDescription,
    datePublished: article.timestamp,
    dateModified: (article as any).updated_at || article.timestamp,
    articleSection: article.category || "News",
    mainEntityOfPage: canonical,
    url: canonical,
    image: article.image ? [article.image] : undefined,
    author: article.author_name ? { "@type": "Person", name: article.author_name } : { "@type": "Organization", name: "RockBrief Editorial Team" },
    publisher: { "@type": "Organization", name: "RockBrief", logo: { "@type": "ImageObject", url: absoluteLogo } },
  } : null, [article, title, seoDescription, canonical, absoluteLogo]);

  if (loading) return <PageLoader />;
  if (!article) {
    return (
      <div className="grid min-h-dvh place-items-center p-6 text-center">
        <div>
          <h1 className="font-display text-3xl font-semibold">Story not found</h1>
          <a href="/" className="mt-5 inline-block font-semibold text-teal-800">Return to RockBrief →</a>
        </div>
      </div>
    );
  }

  const share = (network: string) => {
    const shareMessage = `RockBrief — ${title}\n\n${description}\n\n${canonical}`;
    const text = encodeURIComponent(shareMessage);
    const encoded = encodeURIComponent(canonical);
    const urls: Record<string, string> = {
      whatsapp: "https://wa.me/?text=" + text,
      telegram: "https://t.me/share/url?url=" + encoded + "&text=" + text,
      x: "https://twitter.com/intent/tweet?text=" + text + "&url=" + encoded,
      facebook: "https://www.facebook.com/sharer/sharer.php?u=" + encoded,
      linkedin: "https://www.linkedin.com/sharing/share-offsite/?url=" + encoded,
    };
    window.open(urls[network], "_blank", "noopener,noreferrer");
  };

  const copyLink = async () => {
    try { await navigator.clipboard.writeText(canonical); setCopied(true); window.setTimeout(() => setCopied(false), 1800); } catch { /* ignore */ }
  };

  const sourceUrl = article.original_url || "";

  return (
    <div className="min-h-dvh bg-[#f5f7f7] text-neutral-950">
      <Helmet>
        <title>{title} — RockBrief</title>
        <meta name="description" content={seoDescription} />
        <link rel="canonical" href={canonical} />
        <meta property="og:title" content={`RockBrief — ${title}`} />
        <meta property="og:description" content={seoDescription} />
        <meta property="og:url" content={canonical} />
        <meta property="og:image" content={article.image || "/rwdnews-logo.svg"} />
        <meta property="og:type" content="article" />
        <meta name="robots" content="index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1" />
        <script type="application/ld+json">{JSON.stringify(jsonLd)}</script>
      </Helmet>

      <div className="border-b border-neutral-900 bg-[#071a2d] text-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-2 sm:px-6">
          <a href="/" className="text-[10px] font-extrabold tracking-[0.18em] text-amber-300 uppercase">RockBrief</a>
          <a href="/sport" className="text-[10px] font-bold text-white/80 hover:text-white">Sports desk →</a>
        </div>
      </div>

      <header className="border-b border-neutral-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
          <a href="/" aria-label="RockBrief home"><img src="/rwdnews-logo.svg" alt="RockBrief" className="h-auto w-[170px] sm:w-[210px]" /></a>
          <a href="/" className="rounded-full border border-neutral-200 bg-neutral-50 px-3 py-2 text-xs font-bold text-teal-800">← Back to news</a>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6 sm:py-12">
        <p className="text-[10px] font-bold tracking-[0.16em] text-amber-800 uppercase">{article.category || "News"} · {article.source}</p>
        <h1 className="font-display mt-3 text-3xl leading-tight font-semibold sm:text-4xl">{title}</h1>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-neutral-500">
          <span>{article.read_time || (words ? Math.max(1, Math.ceil(words / 180)) + " min read" : "3 min read")}</span>
          <span aria-hidden="true">·</span>
          <span>{new Date(article.timestamp).toLocaleString()}</span>
          {words >= 400 ? <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-800">Full report · {words} words</span> : null}
        </div>
        {Array.isArray(article.tags) && article.tags.length ? (
          <div className="mt-4 flex flex-wrap gap-2">
            {article.tags.map((tag) => (
              <span key={tag} className="rounded-full border border-neutral-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-neutral-600">{String(tag).replace(/^#/, "")}</span>
            ))}
          </div>
        ) : null}

        {article.image ? (
          <figure className="mt-8">
            <img src={article.image} alt={title} className="aspect-[16/9] w-full bg-neutral-100 object-cover" />
            {article.image_credit ? <figcaption className="mt-2 text-xs leading-5 text-neutral-500">{article.image_credit}{article.image_source_url ? <> · <a href={article.image_source_url} target="_blank" rel="noopener noreferrer" className="underline">source</a></> : null}</figcaption> : null}
          </figure>
        ) : null}

        <div className="mt-6"><AdSlot slot="in_article_top" className="min-h-[90px]" /></div>

        <section className="mt-8 rounded-2xl border border-neutral-200 bg-white p-5 sm:p-7">
          <h2 className="font-display text-xl font-semibold sm:text-2xl">Quick briefing</h2>
          <p className="mt-1 text-sm text-neutral-500">Four key points. The full RockBrief report follows when available.</p>
          <ul className="mt-5 space-y-4">
            {briefing.points.map((point, i) => (
              <li key={i} className="flex gap-3 text-[17px] leading-[1.7] text-neutral-800 sm:text-[18px]">
                <span className="mt-[0.65rem] size-1.5 shrink-0 rounded-full bg-neutral-950" />
                <span>{point}</span>
              </li>
            ))}
          </ul>

          {words >= 400 ? (
            <div className="mt-10 border-t border-neutral-200 pt-8">
              <p className="text-[10px] font-extrabold tracking-[0.16em] text-amber-800 uppercase">RockBrief report</p>
              <h2 className="font-display mt-1 text-xl font-semibold sm:text-2xl">Full analysis</h2>
              <p className="mt-1 text-sm text-neutral-500">Original synthesis ({words} words) based on attributed sources.</p>
              <div
                className="mt-6 max-w-none text-[17px] leading-[1.8] text-neutral-800 sm:text-[18px] [&_a]:text-teal-800 [&_a]:underline [&_blockquote]:my-6 [&_blockquote]:border-l-4 [&_blockquote]:border-amber-400 [&_blockquote]:pl-4 [&_blockquote]:italic [&_h2]:mb-3 [&_h2]:mt-8 [&_h2]:font-display [&_h2]:text-2xl [&_h2]:font-semibold [&_h3]:mb-2 [&_h3]:mt-6 [&_h3]:font-display [&_h3]:text-xl [&_h3]:font-semibold [&_img]:my-6 [&_img]:h-auto [&_img]:max-w-full [&_img]:rounded-lg [&_li]:my-1 [&_ol]:my-4 [&_ol]:list-decimal [&_ol]:pl-6 [&_p]:my-4 [&_ul]:my-4 [&_ul]:list-disc [&_ul]:pl-6"
                dangerouslySetInnerHTML={{ __html: sanitizeArticleHtml(article.body || "") }}
              />
            </div>
          ) : article.body ? (
            <div className="mt-8 text-[17px] leading-[1.75] text-neutral-800 sm:text-[18px] [&_p]:my-4" dangerouslySetInnerHTML={{ __html: sanitizeArticleHtml(article.body) }} />
          ) : null}

          {sourceUrl ? (
            <div className="mt-8 rounded-2xl border border-teal-200 bg-teal-50/80 p-5 sm:p-6">
              <p className="text-[10px] font-extrabold tracking-[0.16em] text-teal-900 uppercase">Full story</p>
              <p className="mt-1 text-sm text-neutral-700">Original reporting by <strong>{article.source}</strong>. RockBrief's report above is an original synthesis based on attributed source material.</p>
              <a href={sourceUrl} target="_blank" rel="noopener noreferrer" className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-teal-800 px-5 py-3.5 text-sm font-bold text-white sm:w-auto">
                Read full article on {article.source}
                <ExternalLink className="size-4" />
              </a>
            </div>
          ) : null}
        </section>

        <div className="mt-8 flex flex-wrap gap-2">
          <button type="button" onClick={() => share("whatsapp")} className="rounded-full border border-neutral-200 bg-white px-3 py-2 text-xs font-bold">WhatsApp</button>
          <button type="button" onClick={() => share("x")} className="rounded-full border border-neutral-200 bg-white px-3 py-2 text-xs font-bold">X</button>
          <button type="button" onClick={() => share("facebook")} className="rounded-full border border-neutral-200 bg-white px-3 py-2 text-xs font-bold">Facebook</button>
          <button type="button" onClick={() => void copyLink()} className="rounded-full border border-neutral-200 bg-white px-3 py-2 text-xs font-bold inline-flex items-center gap-1">{copied ? <Check className="size-3" /> : <Copy className="size-3" />}{copied ? "Copied" : "Copy link"}</button>
        </div>

        {related.length ? (
          <section className="mt-12">
            <h2 className="font-display text-xl font-semibold">More stories</h2>
            <div className="mt-4 space-y-3">
              {related.map((item) => (
                <a key={item.id} href={"/news/" + (item.ai_hook_title || item.original_title).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 90) + "--" + encodeURIComponent(item.id)} className="block rounded-xl border border-neutral-200 bg-white p-4">
                  <p className="text-[10px] font-bold uppercase text-amber-800">{item.category}</p>
                  <p className="mt-1 font-semibold">{item.ai_hook_title || item.original_title}</p>
                </a>
              ))}
            </div>
          </section>
        ) : null}
      </main>
      <SiteFooter />
    </div>
  );
}
