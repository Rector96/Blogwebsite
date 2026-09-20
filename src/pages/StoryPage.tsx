import { useEffect, useMemo, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Check, Copy, MessageCircle, Send, Share2 } from "lucide-react";
import { supabase } from "../lib/supabase";
import { logRwdNewsEvent } from "../lib/analytics";
import { fetchSponsors, logSponsorClick, type SponsoredOffer } from "../lib/sponsors";
import { AdSlot } from "../components/AdSlot";
import type { EnrichedArticle } from "../App";

function currentStoryId() {
  const path = window.location.pathname.replace(/^\/news\//, "");
  const marker = path.lastIndexOf("--");
  return marker >= 0 ? decodeURIComponent(path.slice(marker + 2)) : "";
}

function storyHref(item: EnrichedArticle) {
  const title = (item.ai_hook_title || item.original_title)
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 90);
  return "/news/" + title + "--" + encodeURIComponent(item.id);
}

function cleanText(value: string) {
  let x = String(value || "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  x = x.replace(/\s*Read\s*More\s*:?\s*https?:\/\/\S+/gi, "");
  x = x.replace(/https?:\/\/\S+/gi, "");
  return x.replace(/\s+/g, " ").trim();
}

function isMetaLine(x: string) {
  return /limited to facts|supplied source material|source report remains|not add facts that are not supported|meant to be read on RWDNEWS|without leaving the site|tracking this (developing )?story|source wire:/i.test(
    x,
  );
}

function buildBriefing(article: EnrichedArticle) {
  const raw = (article.ai_summary?.length
    ? article.ai_summary
    : [article.original_description].filter(Boolean)
  ).map((x) => cleanText(String(x)));

  const points = raw.filter(Boolean).filter((x) => !isMetaLine(x)).filter((x) => x.length > 20);
  const lead = points[0] || cleanText(article.original_description || article.original_title || "");
  return { points: points.length ? points : lead ? [lead] : [] };
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
          if (data) {
            foundArticle = {
              ...data,
              ai_summary: Array.isArray(data.ai_summary) ? data.ai_summary : [],
              tags: Array.isArray(data.tags) ? data.tags : [],
            } as EnrichedArticle;
          }
        }
        if (!foundArticle && id) {
          const response = await fetch("/api/news");
          const payload = await response.json();
          const found = Array.isArray(payload.articles)
            ? payload.articles.find((x: EnrichedArticle) => x.id === id)
            : null;
          if (found) foundArticle = found;
        }
        if (foundArticle && !cancelled) {
          setArticle(foundArticle);
          try {
            const response = await fetch("/api/news");
            const payload = await response.json();
            const pool = Array.isArray(payload.articles) ? (payload.articles as EnrichedArticle[]) : [];
            const candidates = pool
              .filter((x) => x.id !== foundArticle!.id)
              .filter((x) => !foundArticle!.category || x.category === foundArticle!.category)
              .slice(0, 6);
            if (!cancelled) setRelated(candidates);
          } catch {
            /* ignore */
          }
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    void fetchSponsors().then((items) => {
      if (!cancelled) {
        setSponsor(
          items.find((item) => item.placement === "both" || item.placement === "in_feed") ||
            items[0] ||
            null,
        );
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!article) return;
    void logRwdNewsEvent({
      event: "article_open",
      articleId: article.id,
      placement: "story_page",
    });
  }, [article]);

  const title = article?.ai_hook_title || article?.original_title || "RWDNEWS story";
  const canonical =
    typeof window !== "undefined"
      ? window.location.origin + window.location.pathname
      : "https://rwdnews.netlify.app/";
  const briefing = article ? buildBriefing(article) : { points: [] as string[] };
  const description = briefing.points[0] || cleanText(article?.original_description || "");

  const jsonLd = useMemo(
    () =>
      article
        ? {
            "@context": "https://schema.org",
            "@type": "NewsArticle",
            headline: title,
            description,
            datePublished: article.timestamp,
            mainEntityOfPage: canonical,
            url: canonical,
            image: article.image ? [article.image] : undefined,
            author: { "@type": "Organization", name: "RWDNEWS" },
            publisher: { "@type": "Organization", name: "RWDNEWS" },
          }
        : null,
    [article, title, description, canonical],
  );

  if (loading) {
    return (
      <div className="grid min-h-dvh place-items-center text-sm text-neutral-500">Loading…</div>
    );
  }

  if (!article) {
    return (
      <div className="grid min-h-dvh place-items-center p-6 text-center">
        <div>
          <h1 className="font-display text-3xl font-semibold">Story not found</h1>
          <a href="/" className="mt-5 inline-block font-semibold text-teal-800">
            Return to RWDNEWS →
          </a>
        </div>
      </div>
    );
  }

  const share = (network: string) => {
    const shareMessage = `RWDNEWS — ${title}\n\n${description}\n\n${canonical}`;
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
    try {
      await navigator.clipboard.writeText(canonical);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="min-h-dvh bg-[#f5f7f7] text-neutral-950">
      <Helmet>
        <title>{title} — RWDNEWS</title>
        <meta name="description" content={description} />
        <link rel="canonical" href={canonical} />
        <meta property="og:title" content={`RWDNEWS — ${title}`} />
        <meta property="og:description" content={description} />
        <meta property="og:url" content={canonical} />
        <meta property="og:image" content={article.image} />
        <script type="application/ld+json">{JSON.stringify(jsonLd)}</script>
      </Helmet>

      <div className="border-b border-neutral-900 bg-[#071a2d] text-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-2 sm:px-6">
          <a href="/" className="text-[10px] font-extrabold tracking-[0.18em] text-amber-300 uppercase">
            RWDNEWS
          </a>
          <a href="/sport" className="text-[10px] font-bold text-white/80 hover:text-white">
            Sports desk →
          </a>
        </div>
      </div>

      <header className="border-b border-neutral-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
          <a href="/" aria-label="RWDNEWS home">
            <img src="/rwdnews-logo.svg" alt="RWDNEWS" className="h-auto w-[170px] sm:w-[210px]" />
          </a>
          <a
            href="/"
            className="rounded-full border border-neutral-200 bg-neutral-50 px-3 py-2 text-xs font-bold text-teal-800"
          >
            ← Back to news
          </a>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6 sm:py-12">
        <p className="text-[10px] font-bold tracking-[0.16em] text-amber-800 uppercase">
          {article.category || "News"} · {article.source}
        </p>
        <h1 className="font-display mt-3 text-3xl leading-tight font-semibold sm:text-5xl">{title}</h1>
        <p className="mt-3 text-xs text-neutral-400">
          {article.read_time || "3 min read"} · {new Date(article.timestamp).toLocaleString()}
        </p>

        {article.image ? (
          <img src={article.image} alt="" className="mt-8 aspect-[16/9] w-full bg-neutral-100 object-cover" />
        ) : null}

        <div className="mt-6">
          <AdSlot slot="in_article_top" className="min-h-[90px]" />
        </div>

        <section className="mt-8 rounded-2xl border border-neutral-200 bg-white p-5 sm:p-7">
          <h2 className="font-display text-2xl font-semibold">What you should know</h2>
          <ul className="mt-5 space-y-4">
            {briefing.points.map((point, i) => (
              <li key={i} className="flex gap-3 text-[16px] leading-[1.75] text-neutral-800">
                <span className="mt-[0.7rem] size-1.5 shrink-0 rounded-full bg-neutral-950" />
                <span>{point}</span>
              </li>
            ))}
          </ul>

          {article.story_type === "RWDNEWS ORIGINAL" && article.body ? (
            <div className="mt-8 whitespace-pre-wrap text-[16px] leading-[1.8] text-neutral-800">
              {article.body}
            </div>
          ) : null}

          {/* Optional full report — secondary, not the main read */}
          {article.original_url ? (
            <p className="mt-8 border-t border-neutral-100 pt-4 text-sm text-neutral-500">
              Want the long-form report?{" "}
              <a
                href={article.original_url}
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold text-teal-800 underline-offset-2 hover:underline"
              >
                Open original at {article.source}
              </a>
            </p>
          ) : null}
        </section>

        {sponsor ? (
          <section className="mt-6 border border-amber-200 bg-amber-50/60 p-5 sm:p-6">
            <p className="text-[10px] font-extrabold tracking-[0.16em] text-amber-800 uppercase">Sponsored</p>
            <h2 className="mt-1 font-display text-xl font-semibold">{sponsor.headline}</h2>
            <a
              href={sponsor.ctaUrl}
              target="_blank"
              rel="noopener noreferrer sponsored"
              onClick={() => void logSponsorClick(sponsor, "story_page")}
              className="mt-4 inline-flex items-center bg-neutral-950 px-4 py-2.5 text-xs font-bold text-white"
            >
              {sponsor.ctaText} →
            </a>
          </section>
        ) : null}

        <div className="mt-10 border-y border-neutral-200 py-6">
          <p className="text-[10px] font-bold tracking-[0.16em] text-neutral-500 uppercase">Share</p>
          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
            <button type="button" onClick={() => share("whatsapp")} className="flex h-11 items-center justify-center gap-2 rounded-lg bg-[#25D366] text-xs font-bold text-white">
              <MessageCircle className="size-4" /> WhatsApp
            </button>
            <button type="button" onClick={() => share("telegram")} className="flex h-11 items-center justify-center gap-2 rounded-lg bg-[#229ED9] text-xs font-bold text-white">
              <Send className="size-4" /> Telegram
            </button>
            <button type="button" onClick={() => share("x")} className="flex h-11 items-center justify-center gap-2 rounded-lg bg-black text-xs font-bold text-white">
              Post on X
            </button>
            <button type="button" onClick={() => share("facebook")} className="flex h-11 items-center justify-center gap-2 rounded-lg bg-[#1877F2] text-xs font-bold text-white">
              Facebook
            </button>
            <button type="button" onClick={() => share("linkedin")} className="flex h-11 items-center justify-center gap-2 rounded-lg bg-[#0A66C2] text-xs font-bold text-white">
              LinkedIn
            </button>
            <button type="button" onClick={() => void copyLink()} className="flex h-11 items-center justify-center gap-2 rounded-lg border bg-white text-xs font-bold">
              {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
              {copied ? "Copied" : "Copy link"}
            </button>
          </div>
        </div>

        <section className="mt-10">
          <h2 className="font-display text-2xl font-semibold">More on RWDNEWS</h2>
          {related.length ? (
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {related.slice(0, 4).map((item) => (
                <a
                  key={item.id}
                  href={storyHref(item)}
                  className="group overflow-hidden rounded-xl border border-neutral-200 bg-white transition hover:border-teal-300"
                >
                  <div className="grid grid-cols-[108px_1fr]">
                    <img src={item.image} alt="" className="h-full min-h-[108px] w-full object-cover" />
                    <div className="p-3">
                      <p className="text-[9px] font-extrabold tracking-wider text-amber-800 uppercase">
                        {item.category || "News"}
                      </p>
                      <h3 className="font-display mt-1 line-clamp-3 text-base font-semibold leading-snug group-hover:text-teal-800">
                        {item.ai_hook_title || item.original_title}
                      </h3>
                    </div>
                  </div>
                </a>
              ))}
            </div>
          ) : null}
        </section>
      </main>
    </div>
  );
}
