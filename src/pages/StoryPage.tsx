import { useEffect, useMemo, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Check, Copy, ExternalLink, MessageCircle, Send, Share2 } from "lucide-react";
import { supabase } from "../lib/supabase";
import { logRwdNewsEvent } from "../lib/analytics";
import { fetchSponsors, logSponsorClick, type SponsoredOffer } from "../lib/sponsors";
import type { EnrichedArticle } from "../App";

function currentStoryId() {
  const path = window.location.pathname.replace(/^\/news\//, "");
  const marker = path.lastIndexOf("--");
  return marker >= 0 ? decodeURIComponent(path.slice(marker + 2)) : "";
}

export default function StoryPage() {
  const [article, setArticle] = useState<EnrichedArticle | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [sponsor, setSponsor] = useState<SponsoredOffer | null>(null);

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
        if (foundArticle && !cancelled) setArticle(foundArticle);
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
    void logRwdNewsEvent({ event: "article_open", articleId: article.id, articleUrl: article.original_url, placement: "story_page" });
  }, [article]);

  const title = article?.ai_hook_title || article?.original_title || "RWDNEWS story";
  const canonical = typeof window !== "undefined" ? window.location.origin + window.location.pathname : "https://rwdnews.netlify.app/";
  const description = article?.ai_summary?.[0] || article?.original_description || "Source-backed global news briefing from RWDNEWS.";
  const jsonLd = useMemo(() => article ? { "@context": "https://schema.org", "@type": "NewsArticle", headline: title, description, datePublished: article.timestamp, dateModified: article.timestamp, mainEntityOfPage: canonical, url: canonical, image: article.image ? [article.image] : undefined, author: { "@type": "Organization", name: "RWDNEWS" }, isBasedOn: article.original_url, publisher: { "@type": "Organization", name: "RWDNEWS", logo: { "@type": "ImageObject", url: new URL("/rwdnews-logo.svg", canonical).toString() } } } : null, [article, title, description, canonical]);

  if (loading) return <div className="grid min-h-dvh place-items-center text-sm text-neutral-500">Loading briefing…</div>;
  if (!article) return <div className="grid min-h-dvh place-items-center p-6 text-center"><div><h1 className="font-display text-3xl font-semibold">Story not found</h1><p className="mt-2 text-sm text-neutral-500">This story may have expired from the live wire.</p><a href="/" className="mt-5 inline-block font-semibold text-teal-800">Return to RWDNEWS →</a></div></div>;

  const share = (network: string) => {
    const shareMessage = `RWDNEWS — ${title}\n\n${description}\n\nRead the RWDNEWS briefing: ${canonical}`;
    const text = encodeURIComponent(shareMessage);
    const shareUrl = (network: string) => canonical + (canonical.includes("?") ? "&" : "?") + "utm_source=" + network + "&utm_medium=social&utm_campaign=rwdnews_share";
    const encoded = encodeURIComponent(shareUrl(network));
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

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(canonical);
      setCopied(true);
      void logRwdNewsEvent({ event: "article_share", articleId: article.id, articleUrl: article.original_url, placement: "copy_link" });
      window.setTimeout(() => setCopied(false), 1800);
    } catch {}
  };

  return <div className="min-h-dvh bg-white text-neutral-950"><Helmet><title>{title} — RWDNEWS</title><meta name="description" content={description} /><link rel="canonical" href={canonical} /><meta property="og:title" content={`RWDNEWS — ${title}`} /><meta property="og:description" content={`RWDNEWS briefing: ${description}`} /><meta property="og:url" content={canonical} /><meta property="og:type" content="article" /><meta property="og:site_name" content="RWDNEWS" /><meta property="og:image" content={article.image} /><meta name="twitter:card" content="summary_large_image" /><meta name="twitter:title" content={`RWDNEWS — ${title}`} /><meta name="twitter:description" content={description} /><meta name="twitter:image" content={article.image} /><script type="application/ld+json">{JSON.stringify(jsonLd)}</script></Helmet>
    <header className="border-b border-neutral-200"><div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-5 sm:px-6"><a href="/" className="font-display text-2xl font-bold">RWDNEWS</a><a href="/" className="text-sm font-semibold text-teal-800">Back to news</a></div></header>
    <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6 sm:py-12"><p className="text-[10px] font-bold tracking-[0.16em] text-amber-800 uppercase">{article.source} · {article.category || "World"}</p><h1 className="font-display mt-3 text-4xl leading-tight font-semibold sm:text-5xl">{title}</h1><p className="mt-3 text-lg leading-relaxed text-neutral-600">{description}</p><p className="mt-3 text-xs text-neutral-400">{article.read_time || "3 min read"} · Published {new Date(article.timestamp).toLocaleString()}</p>
      <img src={article.image} alt="" className="mt-8 aspect-[16/9] w-full object-cover bg-neutral-100" /><p className="mt-2 text-[10px] text-neutral-400">{article.image_credit ? "Image: " + article.image_credit : ""}{article.image_license ? " · " + article.image_license : ""}</p>
      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_250px]"><article className="min-w-0">
        <section className="rounded-2xl border border-neutral-200 bg-neutral-50 p-5 sm:p-6">
          <div className="flex items-center gap-2 text-[10px] font-extrabold tracking-[0.16em] text-teal-800 uppercase">
            <span className="size-2 rounded-full bg-teal-600" />
            Quick brief
          </div>
          <h2 className="font-display mt-2 text-2xl font-semibold">What you need to know</h2>
          <p className="mt-2 text-[15px] leading-relaxed text-neutral-600">
            RWDNEWS gives you the key information first, then keeps the original report one tap away.
          </p>
          <ul className="mt-5 space-y-4">
            {(article.ai_summary?.length ? article.ai_summary : [article.original_description]).map((point, i) => (
              <li key={i} className="flex gap-3 text-[16px] leading-relaxed text-neutral-800">
                <span className="mt-2 size-1.5 shrink-0 rounded-full bg-neutral-950" />
                <span>{point}</span>
              </li>
            ))}
          </ul>
        </section>
        {sponsor ? <section className="mt-6 border border-amber-200 bg-amber-50/60 p-5 sm:p-6"><p className="text-[10px] font-extrabold tracking-[0.16em] text-amber-800 uppercase">Sponsored</p><p className="mt-1 text-xs font-semibold text-neutral-500">{sponsor.sponsorName}</p><h2 className="mt-1 font-display text-xl font-semibold">{sponsor.headline}</h2>{sponsor.whyMatters?.[0] ? <p className="mt-2 text-sm leading-relaxed text-neutral-600">{sponsor.whyMatters[0]}</p> : null}<a href={sponsor.ctaUrl} target="_blank" rel="noopener noreferrer sponsored" onClick={() => void logSponsorClick(sponsor, "story_page")} className="mt-4 inline-flex items-center border border-neutral-900 bg-neutral-950 px-4 py-2.5 text-xs font-bold text-white">{sponsor.ctaText} →</a></section> : null}
        <div className="mt-8 space-y-4 text-[17px] leading-[1.8] text-neutral-800">
          {article.original_description ? <p className="text-xl text-neutral-700">{article.original_description}</p> : null}
          <h2 className="font-display pt-4 text-2xl font-semibold">Why it matters</h2>
          <p className="text-neutral-700">This story is part of the wider news picture. Follow the original publisher for additional context, live updates and the full report.</p>
          <div className="border-l-2 border-teal-700 bg-teal-50 p-4 text-sm leading-relaxed text-neutral-700">
            {article.story_type === "RWDNEWS ORIGINAL"
              ? "This is an original RWDNEWS report. Information is published by RWDNEWS and may include direct reporting, interviews, analysis or verified announcements."
              : "RWDNEWS is a briefing layer. We use source reports for the facts and AI only to organize and explain the information; the original publisher remains the reference for the full report and updates."}
          </div>
          {article.body ? <div className="mt-8 whitespace-pre-wrap text-[17px] leading-[1.8] text-neutral-800">{article.body}</div> : null}
          {article.story_type === "RWDNEWS ORIGINAL" && article.author_name ? <p className="mt-6 text-xs font-semibold text-neutral-500">By {article.author_name}</p> : null}
          <div className="flex flex-wrap gap-2 pt-2">{article.tags.map(t => <span key={t} className="bg-neutral-100 px-2.5 py-1 text-[11px] font-semibold text-neutral-600">{String(t).replace(/^#/, "")}</span>)}</div>
        </div>
      <div className="mt-10 border-y border-neutral-200 py-6"><div className="flex items-start justify-between gap-4"><div><p className="text-[10px] font-bold tracking-[0.16em] text-neutral-500 uppercase">Share this story</p><h2 className="mt-1 font-display text-xl font-semibold">Send the briefing to someone</h2><p className="mt-1 text-sm text-neutral-500">Share the RWDNEWS story with the original source one tap away.</p></div><Share2 className="mt-1 size-5 shrink-0 text-neutral-400" /></div><div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3"><button onClick={() => share("whatsapp")} className="flex h-11 items-center justify-center gap-2 rounded-lg bg-[#25D366] px-3 text-xs font-bold text-white"><MessageCircle className="size-4" /> WhatsApp</button><button onClick={() => share("telegram")} className="flex h-11 items-center justify-center gap-2 rounded-lg bg-[#229ED9] px-3 text-xs font-bold text-white"><Send className="size-4" /> Telegram</button><button onClick={() => share("x")} className="flex h-11 items-center justify-center gap-2 rounded-lg bg-black px-3 text-xs font-bold text-white">𝕏 <span>Post on X</span></button><button onClick={() => share("facebook")} className="flex h-11 items-center justify-center gap-2 rounded-lg bg-[#1877F2] px-3 text-xs font-bold text-white">f <span>Facebook</span></button><button onClick={() => share("linkedin")} className="flex h-11 items-center justify-center gap-2 rounded-lg bg-[#0A66C2] px-3 text-xs font-bold text-white">in <span>LinkedIn</span></button><button onClick={() => void copyLink()} className="flex h-11 items-center justify-center gap-2 rounded-lg border border-neutral-300 bg-white px-3 text-xs font-bold text-neutral-800 hover:bg-neutral-50">{copied ? <Check className="size-4" /> : <Copy className="size-4" />} {copied ? "Copied" : "Copy link"}</button></div></div>
      <a href={article.original_url} target="_blank" rel="noopener noreferrer" onClick={() => void logRwdNewsEvent({ event: "external_source_click", articleId: article.id, articleUrl: article.original_url, placement: "story_source" })} className="mt-8 inline-flex items-center gap-2 border px-4 py-3 text-sm font-semibold">Read original source <ExternalLink className="size-3.5" /></a></article></div>
    </main>
  </div>;
}
