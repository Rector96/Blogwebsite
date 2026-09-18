import React from "react";
import { Bookmark, BookmarkCheck, ExternalLink, Share2, X } from "lucide-react";
import { Helmet } from "react-helmet-async";

export type ReaderArticle = {
  id: string;
  original_url: string;
  image: string;
  timestamp: string;
  source: string;
  original_title: string;
  original_description: string;
  ai_hook_title: string;
  ai_summary: string[];
  tags: string[];
  read_time?: string;
};

function formatTime(iso: string) {
  try {
    return new Date(iso).toLocaleString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "Recently";
  }
}

export function ArticleReader({
  article,
  saved,
  onClose,
  onToggleSave,
}: {
  article: ReaderArticle;
  saved: boolean;
  onClose: () => void;
  onToggleSave: () => void;
}) {
  const title = article.ai_hook_title || article.original_title;
  const bullets = article.ai_summary?.length
    ? article.ai_summary
    : [article.original_description].filter(Boolean);

  const share = async () => {
    const url = typeof window !== "undefined" ? window.location.href : article.original_url;
    try {
      if (navigator.share) {
        await navigator.share({ title, url });
      } else if (navigator.clipboard) {
        await navigator.clipboard.writeText(url);
      }
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <Helmet>
        <title>{title} · FinSignal</title>
        <meta name="description" content={bullets[0] || article.original_description} />
        <meta property="og:title" content={title} />
        <meta property="og:description" content={bullets[0] || ""} />
        <meta property="og:image" content={article.image} />
        <script type="application/ld+json">
          {JSON.stringify({
            "@context": "https://schema.org",
            "@type": "NewsArticle",
            headline: title,
            image: [article.image],
            datePublished: article.timestamp,
            author: { "@type": "Organization", name: article.source },
            publisher: { "@type": "Organization", name: "FinSignal" },
            description: bullets[0] || article.original_description,
            mainEntityOfPage: article.original_url,
          })}
        </script>
      </Helmet>

      <button type="button" className="absolute inset-0 bg-black/50" onClick={onClose} />

      <article className="relative z-10 flex h-full w-full max-w-2xl flex-col bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-neutral-200 px-4 py-3">
          <p className="text-[10px] font-bold tracking-[0.16em] text-neutral-500 uppercase">
            On FinSignal
          </p>
          <div className="flex items-center gap-1">
            <button
              type="button"
              className="grid size-9 place-items-center border border-neutral-200"
              onClick={onToggleSave}
              aria-label="Save"
            >
              {saved ? (
                <BookmarkCheck className="size-4 text-teal-800" />
              ) : (
                <Bookmark className="size-4" />
              )}
            </button>
            <button
              type="button"
              className="grid size-9 place-items-center border border-neutral-200"
              onClick={() => void share()}
              aria-label="Share"
            >
              <Share2 className="size-4" />
            </button>
            <button
              type="button"
              className="grid size-9 place-items-center border border-neutral-200"
              onClick={onClose}
              aria-label="Close"
            >
              <X className="size-4" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          <img
            src={article.image}
            alt=""
            className="aspect-[16/9] w-full object-cover"
          />

          <div className="px-5 py-6 sm:px-8">
            <p className="text-[11px] font-bold tracking-[0.14em] text-amber-800 uppercase">
              {article.source} · {formatTime(article.timestamp)}
            </p>

            <h1 className="font-display mt-2 text-2xl leading-tight font-semibold sm:text-3xl">
              {title}
            </h1>

            <p className="mt-2 text-sm text-neutral-500">
              {article.read_time || "3 min read"} · AI-assisted briefing
            </p>

            {/* Full on-site reading experience */}
            <div className="mt-6 space-y-4 text-[16px] leading-[1.7] text-neutral-800">
              {article.original_description ? (
                <p className="text-lg text-neutral-700">{article.original_description}</p>
              ) : null}

              <h2 className="font-display pt-2 text-lg font-semibold text-neutral-950">
                Why it matters
              </h2>
              <ul className="space-y-3">
                {bullets.map((b, i) => (
                  <li key={i} className="flex gap-3">
                    <span className="mt-2 size-1.5 shrink-0 rounded-full bg-neutral-900" />
                    <span>{b}</span>
                  </li>
                ))}
              </ul>

              <div className="border-l-2 border-amber-600 bg-amber-50/50 py-3 pr-3 pl-4 text-sm text-neutral-700">
                <p className="font-semibold text-neutral-900">FinSignal take</p>
                <p className="mt-1">
                  This briefing is generated from public market wires so you can
                  scan impact fast. For the full original report, open the publisher
                  link below — we always credit the source.
                </p>
              </div>

              {article.tags?.length ? (
                <div className="flex flex-wrap gap-2 pt-2">
                  {article.tags.map((t) => (
                    <span
                      key={t}
                      className="bg-neutral-100 px-2.5 py-1 text-[11px] font-semibold text-neutral-600"
                    >
                      {t.replace(/^#/, "")}
                    </span>
                  ))}
                </div>
              ) : null}
            </div>

            <div className="mt-8 flex flex-col gap-3 border-t border-neutral-200 pt-6 sm:flex-row">
              <a
                href={article.original_url}
                target="_blank"
                rel="noopener noreferrer"
                className="press inline-flex h-12 flex-1 items-center justify-center gap-2 bg-neutral-950 text-sm font-bold text-white"
              >
                Full report on {article.source}
                <ExternalLink className="size-3.5" />
              </a>
              <button
                type="button"
                onClick={onClose}
                className="press h-12 flex-1 border border-neutral-300 text-sm font-semibold"
              >
                Back to feed
              </button>
            </div>

            <p className="mt-6 text-[11px] leading-relaxed text-neutral-400">
              © Source material belongs to the original publisher. FinSignal provides
              analysis and summaries for information only — not investment advice.
            </p>
          </div>
        </div>
      </article>
    </div>
  );
}
