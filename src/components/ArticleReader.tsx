import React from "react";
import { Bookmark, BookmarkCheck, Share2, X } from "lucide-react";
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
  image_credit?: string;
  image_license?: string;
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

function cleanLine(value: string) {
  let x = String(value || "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  x = x.replace(/\s*Read\s*More\s*:?\s*https?:\/\/\S+/gi, "");
  x = x.replace(/https?:\/\/\S+/gi, "");
  return x.replace(/\s+/g, " ").trim();
}

function cleanPoints(article: ReaderArticle) {
  const raw = article.ai_summary?.length
    ? article.ai_summary
    : [article.original_description].filter(Boolean);
  return raw
    .map((x) => cleanLine(String(x)))
    .filter(Boolean)
    .filter((x) => x.length > 20)
    .filter(
      (x) =>
        !/limited to facts|supplied source material|source report remains|not add facts that are not supported|meant to be read on RWDNEWS|without leaving the site|tracking this story from the published source/i.test(
          x,
        ),
    );
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
  const bullets = cleanPoints(article);
  if (!bullets.length) {
    const fallback = cleanLine(article.original_description || article.original_title || "");
    if (fallback) bullets.push(fallback);
  }

  const share = async () => {
    const url = typeof window !== "undefined" ? window.location.href : "";
    try {
      if (navigator.share) {
        await navigator.share({ title, url, text: title });
      } else if (navigator.clipboard && url) {
        await navigator.clipboard.writeText(title + " — " + url);
      }
    } catch {
      /* ignore */
    }
  };

  const openShare = (platform: string) => {
    const pageUrl =
      typeof window !== "undefined" ? window.location.href : "https://rwdnews.netlify.app";
    const url = encodeURIComponent(pageUrl);
    const text = encodeURIComponent(title);
    const links: Record<string, string> = {
      whatsapp: "https://wa.me/?text=" + text + "%20" + url,
      telegram: "https://t.me/share/url?url=" + url + "&text=" + text,
      x: "https://twitter.com/intent/tweet?text=" + text + "&url=" + url,
      facebook: "https://www.facebook.com/sharer/sharer.php?u=" + url,
      linkedin: "https://www.linkedin.com/sharing/share-offsite/?url=" + url,
    };
    const target = links[platform];
    if (target) window.open(target, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <Helmet>
        <title>{title} · RWDNEWS</title>
        <meta name="description" content={bullets[0] || title} />
      </Helmet>

      <button type="button" className="absolute inset-0 bg-black/50" onClick={onClose} />

      <article className="relative z-10 flex h-full w-full max-w-2xl flex-col bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-neutral-200 px-4 py-3">
          <p className="text-[10px] font-bold tracking-[0.16em] text-neutral-500 uppercase">
            RWDNEWS
          </p>
          <div className="flex items-center gap-1">
            <button
              type="button"
              className="grid size-9 place-items-center border border-neutral-200"
              onClick={onToggleSave}
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
            >
              <X className="size-4" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {article.image ? (
            <img src={article.image} alt="" className="aspect-[16/9] w-full object-cover" />
          ) : null}

          <div className="px-5 py-6 sm:px-8">
            <p className="text-[11px] font-bold tracking-[0.14em] text-amber-800 uppercase">
              {article.source} · {formatTime(article.timestamp)}
            </p>
            <h1 className="font-display mt-2 text-2xl leading-tight font-semibold sm:text-3xl">
              {title}
            </h1>
            <p className="mt-2 text-sm text-neutral-500">{article.read_time || "3 min read"}</p>

            <div className="mt-6 space-y-5 text-[18px] leading-[1.8] text-neutral-800 sm:text-[19px]">
              <h2 className="font-display text-lg font-semibold">What you should know</h2>
              <ul className="space-y-3">
                {bullets.map((b, i) => (
                  <li key={i} className="flex gap-3">
                    <span className="mt-2 size-1.5 shrink-0 rounded-full bg-neutral-900" />
                    <span>{b}</span>
                  </li>
                ))}
              </ul>

              <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-4 sm:p-5">
                <p className="text-[10px] font-extrabold tracking-[0.16em] text-amber-800 uppercase">
                  RWDNEWS perspective
                </p>
                <p className="mt-1 text-[16px] leading-7 text-neutral-700">
                  Keep the verified facts above separate from interpretation. Watch for confirmed
                  follow-up reporting before treating developing claims as established.
                </p>
              </div>

              {article.tags?.length ? (
                <div className="flex flex-wrap gap-2 pt-2">
                  {article.tags.map((t) => (
                    <span
                      key={t}
                      className="bg-neutral-100 px-2.5 py-1 text-[11px] font-semibold text-neutral-600"
                    >
                      {String(t).replace(/^#/, "")}
                    </span>
                  ))}
                </div>
              ) : null}
            </div>

            <div className="border-t border-neutral-200 pt-6">
              <p className="mb-2 text-[10px] font-bold tracking-[0.14em] text-neutral-500 uppercase">
                Share
              </p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                {[
                  ["whatsapp", "WhatsApp"],
                  ["telegram", "Telegram"],
                  ["x", "X"],
                  ["facebook", "Facebook"],
                  ["linkedin", "LinkedIn"],
                ].map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => openShare(key)}
                    className="h-10 border border-neutral-200 text-xs font-semibold hover:bg-neutral-50"
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-8 border-t border-neutral-200 pt-6">
              <button
                type="button"
                onClick={onClose}
                className="press h-12 w-full bg-neutral-950 text-sm font-bold text-white"
              >
                Back to feed
              </button>
            </div>
          </div>
        </div>
      </article>
    </div>
  );
}
