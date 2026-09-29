import React, { useEffect, useState } from "react";
import { Helmet } from "react-helmet-async";
import { SiteFooter } from "../components/SiteFooter";

type Story = {
  id: string;
  original_url: string;
  image: string;
  timestamp: string;
  source: string;
  original_title: string;
  ai_hook_title: string;
  ai_summary: string[];
  category?: string;
  body?: string;
  original_description?: string;
  tags?: string[];
};

function storyHref(item: Story) {
  const title = (item.ai_hook_title || item.original_title || "story")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 90);
  return "/news/" + title + "--" + encodeURIComponent(item.id);
}

function openStory(item: Story) {
  try {
    sessionStorage.setItem("rwdnews_pending_story", JSON.stringify(item));
    sessionStorage.setItem("rwdnews_pending_story_id", String(item.id));
  } catch {
    /* ignore */
  }
  window.location.href = storyHref(item);
}

function isSportsStory(a: Story) {
  const blob = `${a.category || ""} ${a.original_title || ""} ${a.ai_hook_title || ""} ${(a.tags || []).join(" ")}`;
  return /sport|football|soccer|premier|champions|nba|nfl|tennis|transfer|fifa|uefa|liga|serie|bundesliga|cricket|athlete|match|goal/i.test(
    blob,
  );
}

export default function SportsPage() {
  const [news, setNews] = useState<Story[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const [sportsResponse, newsResponse] = await Promise.all([
          fetch("/api/sports", { headers: { Accept: "application/json" } }),
          fetch("/api/news", { headers: { Accept: "application/json" } }),
        ]);
        let list: Story[] = [];
        if (sportsResponse.ok) {
          const sportsData = await sportsResponse.json();
          if (Array.isArray(sportsData.news)) list = list.concat(sportsData.news);
        }
        if (newsResponse.ok) {
          const newsData = await newsResponse.json();
          if (Array.isArray(newsData?.articles)) {
            list = list.concat(newsData.articles.filter(isSportsStory));
          }
        }
        const seen = new Set<string>();
        const deduped = list.filter((a) => {
          const key = a.original_url || a.id;
          if (!key || seen.has(key)) return false;
          seen.add(key);
          return true;
        });
        if (!cancelled) setNews(deduped.slice(0, 40));
      } catch {
        /* keep empty */
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main className="min-h-dvh bg-gradient-to-b from-slate-50 via-indigo-50/40 to-slate-100 pb-28 text-slate-950">
      <Helmet>
        <title>Sports news | RockBrief</title>
        <meta
          name="description"
          content="Sports news and briefings — football, leagues and transfers. Clear reporting, sources credited."
        />
      </Helmet>

      <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-3 py-3">
          <a href="/sport" className="text-base font-black tracking-tight text-slate-900">
            Sports news
          </a>
          <a href="/" className="text-xs font-semibold text-indigo-600">
            Home
          </a>
        </div>
        <p className="mx-auto max-w-3xl px-3 pb-3 text-xs text-slate-500">
          Match scores removed — this desk is news only.
        </p>
      </header>

      <div className="mx-auto max-w-3xl px-3 py-4">
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-20 animate-pulse rounded-2xl bg-white/80" />
            ))}
          </div>
        ) : news.length ? (
          <section className="space-y-2.5">
            {news.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => openStory(s)}
                className="flex w-full gap-3 rounded-2xl border border-white/60 bg-white/90 p-3 text-left shadow-sm active:scale-[0.99]"
              >
                {s.image && !String(s.image).includes("logo") ? (
                  <img
                    src={s.image}
                    alt=""
                    className="size-16 shrink-0 rounded-xl object-cover"
                    loading="lazy"
                  />
                ) : (
                  <div className="size-16 shrink-0 rounded-xl bg-gradient-to-br from-indigo-200 to-slate-200" />
                )}
                <div className="min-w-0">
                  <p className="text-[10px] font-bold tracking-wide text-indigo-600 uppercase">{s.source}</p>
                  <p className="mt-0.5 line-clamp-2 text-sm font-bold text-slate-900">
                    {s.ai_hook_title || s.original_title}
                  </p>
                  {Array.isArray(s.ai_summary) && s.ai_summary[0] ? (
                    <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500">{s.ai_summary[0]}</p>
                  ) : null}
                </div>
              </button>
            ))}
          </section>
        ) : (
          <p className="rounded-2xl bg-white/80 p-6 text-center text-sm text-slate-500">
            Sports stories will appear here as the news desk publishes.
          </p>
        )}
      </div>

      <SiteFooter />
    </main>
  );
}
