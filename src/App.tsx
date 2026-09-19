import React, { useEffect, useMemo, useState } from "react";
import { Helmet, HelmetProvider } from "react-helmet-async";
import { Bookmark, BookmarkCheck, ChevronLeft, ChevronRight, RefreshCw, Search } from "lucide-react";
import { isSupabaseConfigured, supabase } from "./lib/supabase";
import {
  fetchSponsors,
  logSponsorClick,
  submitSalesLead,
  type SponsoredOffer,
} from "./lib/sponsors";
import { ArticleReader } from "./components/ArticleReader";
import { AdSlot } from "./components/AdSlot";
import AdminPage from "./pages/AdminPage";
import { InfoPage } from "./pages/InfoPage";
import StoryPage from "./pages/StoryPage";
import SportsPage from "./pages/SportsPage";
import { logRwdNewsEvent } from "./lib/analytics";
import { filterArticlesByTab, withInferredCategory } from "./lib/filterArticles";
import { matchesCategory } from "./lib/categories";

export interface EnrichedArticle {
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
  category?: string;
  trend_score?: number;
  trend_label?: "Breaking" | "Trending" | "Developing" | "Fresh";
  image_credit?: string;
  image_license?: string;
  image_source_url?: string;
  discovered_via?: string[];
  body?: string;
  story_type?: string;
  author_name?: string;
  subject?: string;
  editorial_status?: string;
  featured?: boolean;
  pinned?: boolean;
  region?: string;
}

const SAVED_KEY = "rwdnews_saved_v1";
const NEWS_CACHE_KEY = "rwdnews_news_cache_v1";
const VISIT_KEY = "rwdnews_last_visit_v1";

function formatRelativeTime(iso: string) {
  try {
    const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
    if (mins < 1) return "Just now";
    if (mins < 60) return `${mins}m ago`;
    const h = Math.floor(mins / 60);
    if (h < 24) return `${h}h ago`;
    return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
  } catch {
    return "Recently";
  }
}

function todayLabel() {
  return new Date().toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function storyPath(article: EnrichedArticle) {
  const title = (article.ai_hook_title || article.original_title)
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 90);
  return "/news/" + title + "--" + encodeURIComponent(article.id);
}

function normalizeTags(tags?: string[]) {
  return (tags || []).map((t) => String(t).replace(/^#/, ""));
}

function RwdNewsApp() {
  const [articles, setArticles] = useState<EnrichedArticle[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const raw = localStorage.getItem(NEWS_CACHE_KEY);
      const cached = raw ? JSON.parse(raw) : [];
      return Array.isArray(cached) ? withInferredCategory(cached) : [];
    } catch {
      return [];
    }
  });
  const [sponsors, setSponsors] = useState<SponsoredOffer[]>([]);
  const [recentlyViewed, setRecentlyViewed] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem("rwdnews_recent_v1");
      return raw ? (JSON.parse(raw) as string[]) : [];
    } catch {
      return [];
    }
  });
  const [refreshing, setRefreshing] = useState(false);
  const [selectedTag, setSelectedTag] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [saved, setSaved] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem(SAVED_KEY);
      return raw ? (JSON.parse(raw) as string[]) : [];
    } catch {
      return [];
    }
  });
  const [active, setActive] = useState<EnrichedArticle | null>(null);
  const [email, setEmail] = useState("");
  const [emailMsg, setEmailMsg] = useState<string | null>(null);
  const [feedSource, setFeedSource] = useState<"live" | "unavailable">("live");
  const [leadOpen, setLeadOpen] = useState(false);
  const [leadEmail, setLeadEmail] = useState("");
  const [leadName, setLeadName] = useState("");
  const [leadCompany, setLeadCompany] = useState("");
  const [leadMsg, setLeadMsg] = useState<string | null>(null);
  const [heroIndex, setHeroIndex] = useState(0);
  const [carouselPaused, setCarouselPaused] = useState(false);
  const [sportsFeed, setSportsFeed] = useState<{ live: any[]; featured: any[]; upcoming: any[]; news: any[] }>({
    live: [],
    featured: [],
    upcoming: [],
    news: [],
  });
  const [sportsLoading, setSportsLoading] = useState(true);

  useEffect(() => {
    try {
      const now = Date.now();
      const last = Number(localStorage.getItem(VISIT_KEY) || 0);
      if (last && now - last > 30 * 60 * 1000) {
        void logRwdNewsEvent({ event: "return_visit", placement: "homepage" });
      }
      localStorage.setItem(VISIT_KEY, String(now));
    } catch {}
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(SAVED_KEY, JSON.stringify(saved));
    } catch {}
  }, [saved]);

  useEffect(() => {
    void fetchSponsors().then((items) =>
      setSponsors(items.filter((item) => item.placement === "in_feed" || item.placement === "both")),
    );
    void logRwdNewsEvent({ event: "page_view" });
  }, []);

  const fetchNews = async (refresh = false) => {
    const hadCachedNews = articles.length > 0;
    setRefreshing(true);
    setFeedSource(hadCachedNews ? "live" : "unavailable");
    try {
      const response = await fetch(refresh ? "/api/news?refresh=true" : "/api/news", {
        headers: { Accept: "application/json" },
      });
      if (!response.ok) throw new Error("Live news API unavailable");
      const payload = (await response.json()) as { articles?: EnrichedArticle[] };
      const liveArticles = Array.isArray(payload.articles) ? payload.articles : [];
      if (liveArticles.length) {
        const normalized = withInferredCategory(liveArticles);
        setArticles(normalized);
        try {
          localStorage.setItem(NEWS_CACHE_KEY, JSON.stringify(normalized));
        } catch {}
        setFeedSource("live");
      } else if (!hadCachedNews && !refresh) {
        void fetchNews(true);
        return;
      } else {
        setFeedSource(hadCachedNews ? "live" : "unavailable");
      }
    } catch {
      if (!hadCachedNews) setArticles([]);
      setFeedSource(hadCachedNews ? "live" : "unavailable");
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    const loadSports = async () => {
      try {
        const response = await fetch("/api/sports", { headers: { Accept: "application/json" } });
        if (!response.ok) throw new Error("Sports feed unavailable");
        const data = await response.json();
        setSportsFeed({
          live: Array.isArray(data.live) ? data.live : [],
          featured: Array.isArray(data.featured) ? data.featured : [],
          upcoming: Array.isArray(data.upcoming) ? data.upcoming : [],
          news: Array.isArray(data.news) ? data.news : [],
        });
      } catch {
        setSportsFeed({ live: [], featured: [], upcoming: [], news: [] });
      } finally {
        setSportsLoading(false);
      }
    };
    void loadSports();
    const sportsTimer = window.setInterval(() => void loadSports(), 30_000);
    return () => window.clearInterval(sportsTimer);
  }, []);

  useEffect(() => {
    void fetchNews(false);
    const firstRefresh = window.setTimeout(() => void fetchNews(true), 1200);
    const timer = window.setInterval(() => void fetchNews(true), 60_000);
    return () => {
      window.clearTimeout(firstRefresh);
      window.clearInterval(timer);
    };
  }, []);

  const openArticle = (article: EnrichedArticle) => {
    setRecentlyViewed((prev) => {
      const next = [article.id, ...prev.filter((id) => id !== article.id)].slice(0, 8);
      try {
        localStorage.setItem("rwdnews_recent_v1", JSON.stringify(next));
      } catch {}
      return next;
    });
    void logRwdNewsEvent({
      event: "article_open",
      articleId: article.id,
      articleUrl: article.original_url,
    });
    window.location.assign(storyPath(article));
  };

  const openAdvertiserForm = () => {
    void logRwdNewsEvent({ event: "advertise_open", placement: "media_kit" });
    window.location.assign("/advertise");
  };

  // Fixed tabs — always available
  const tags = useMemo(
    () => ["All", "Sports", "Business", "Tech", "Crypto", "Nigeria", "Africa", "World", "Entertainment"],
    [],
  );

  // STRICT: All = everything; Sports = sports only; Business = business only; etc.
  const filtered = useMemo(
    () => filterArticlesByTab(articles, selectedTag, searchQuery),
    [articles, selectedTag, searchQuery],
  );

  const recommended = useMemo(() => {
    const categoryWeight = new Map<string, number>();
    recentlyViewed.forEach((id, index) => {
      const article = articles.find((a) => a.id === id);
      if (!article?.category) return;
      const weight = Math.max(1, 8 - index);
      categoryWeight.set(article.category, (categoryWeight.get(article.category) || 0) + weight);
    });
    return articles
      .filter((a) => !recentlyViewed.includes(a.id))
      .map((a) => {
        const ageHours = Math.max(0, (Date.now() - new Date(a.timestamp).getTime()) / 3600000);
        const freshness = Math.max(0, 30 - ageHours * 1.5);
        const interest = (categoryWeight.get(a.category || "") || 0) * 3;
        const globalImportance =
          a.trend_label === "Breaking" ? 18 : a.trend_label === "Trending" ? 10 : 0;
        return { article: a, score: freshness + interest + globalImportance };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 6)
      .map((item) => item.article);
  }, [articles, recentlyViewed]);

  const heroStories = filtered.slice(0, 5);
  const hero = heroStories[heroIndex % Math.max(heroStories.length, 1)] || filtered[0];
  const secondary = filtered.slice(1, 4);
  const rest = filtered.slice(4);
  const sports = [...articles.filter((a) => matchesCategory(a, "Sports")), ...sportsFeed.news]
    .filter((a, index, arr) => arr.findIndex((x) => x.id === a.id) === index)
    .slice(0, 12);
  const sportsCards = sportsFeed.live.length
    ? sportsFeed.live.slice(0, 12)
    : sportsFeed.featured.length
      ? sportsFeed.featured.slice(0, 12)
      : sportsFeed.upcoming.slice(0, 12);

  useEffect(() => {
    setHeroIndex(0);
  }, [selectedTag, searchQuery]);

  useEffect(() => {
    if (heroStories.length < 2 || carouselPaused) return;
    const timer = window.setInterval(() => {
      setHeroIndex((index) => (index + 1) % heroStories.length);
    }, 6500);
    return () => window.clearInterval(timer);
  }, [heroStories.length, carouselPaused]);

  const toggleSave = (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setSaved((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
      return next;
    });
  };

  const submitNewsletter = async (e: React.FormEvent) => {
    e.preventDefault();
    const v = email.trim().toLowerCase();
    if (!v.includes("@")) {
      setEmailMsg("Enter a valid email.");
      return;
    }
    try {
      if (isSupabaseConfigured && supabase) {
        await supabase
          .from("newsletter_subscribers")
          .upsert({ email: v, source: "rwdnews_web" }, { onConflict: "email" });
      }
      setEmailMsg("You're on the RWDNEWS list.");
      setEmail("");
    } catch {
      setEmailMsg("Thanks — we'll confirm shortly.");
    }
  };

  const onLeadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!leadEmail.includes("@")) {
      setLeadMsg("Work email required.");
      return;
    }
    const res = await submitSalesLead({
      email: leadEmail,
      name: leadName,
      company: leadCompany,
      message: "RWDNEWS sponsorship",
    });
    setLeadMsg(res.ok ? "Received. We'll send rates shortly." : "Thanks — we'll follow up.");
  };

  const emptyForTab =
    selectedTag !== "All" && filtered.length === 0 && !(selectedTag === "Sports" && sports.length > 0) && !refreshing
      ? `No ${selectedTag} stories in the live wire right now. Try All, or pull to refresh.`
      : null;

  return (
    <div className="min-h-dvh bg-white text-neutral-950">
      <Helmet>
        <title>RWDNEWS — Global News, Trends & Briefings</title>
        <meta
          name="description"
          content="RWDNEWS delivers source-backed global news, sports, business and tech briefings."
        />
      </Helmet>

      <div className="border-b border-neutral-200 bg-neutral-950 text-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-1.5 text-[11px] sm:px-6">
          <span className="font-medium tracking-wide text-neutral-300">{todayLabel()}</span>
          <span className="hidden text-neutral-400 sm:inline">
            {feedSource === "live" ? "Live global wire" : "Live wire reconnecting"}
          </span>
          <button type="button" onClick={openAdvertiserForm} className="font-semibold text-amber-400">
            Advertise
          </button>
        </div>
      </div>

      <header className="border-b border-neutral-200">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-4 sm:px-6 sm:py-5">
          <div className="w-10 sm:hidden" />
          <a href="/" className="block shrink-0" aria-label="RWDNEWS home">
            <img
              src="/rwdnews-logo.svg"
              alt="RWDNEWS"
              className="h-auto w-[205px] sm:w-[275px]"
            />
          </a>
          <div className="flex items-center gap-2">
            <div className="relative hidden md:block">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-neutral-400" />
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search"
                className="h-9 w-44 rounded-full border border-neutral-200 bg-neutral-50 pr-3 pl-9 text-sm outline-none lg:w-56"
              />
            </div>
            <button
              type="button"
              onClick={() => void fetchNews(true)}
              className="press grid size-9 place-items-center rounded-full border border-neutral-200"
              aria-label="Refresh news"
            >
              <RefreshCw className={`size-3.5 ${refreshing ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>

        <div className="border-t border-neutral-100 bg-neutral-50/70">
          <div className="mx-auto max-w-6xl px-4 py-2.5 sm:px-6">
            <div className="flex min-w-0 gap-1.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {tags.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setSelectedTag(t)}
                  className={`shrink-0 rounded-full border px-3 py-1.5 text-[11px] font-bold transition ${
                    selectedTag === t
                      ? "border-neutral-950 bg-neutral-950 text-white shadow-sm"
                      : "border-neutral-200 bg-white text-neutral-600 hover:border-neutral-400"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
            <p className="mt-2 text-[10px] text-neutral-400">
              {selectedTag === "All"
                ? `${filtered.length} stories · all topics`
                : `${filtered.length} ${selectedTag} stories only`}
            </p>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-4 py-3 sm:px-6">
        <AdSlot slot="leaderboard" />
      </div>

      <main className="mx-auto grid max-w-6xl gap-10 px-4 pb-16 sm:px-6 lg:grid-cols-[1fr_300px]">
        <div className="min-w-0">
          {emptyForTab ? (
            <div className="mb-8 border border-dashed border-neutral-300 bg-neutral-50 p-8 text-center">
              <p className="font-display text-lg font-semibold">{emptyForTab}</p>
              <button
                type="button"
                onClick={() => void fetchNews(true)}
                className="mt-4 rounded-full bg-neutral-950 px-4 py-2 text-xs font-bold text-white"
              >
                Refresh live wire
              </button>
            </div>
          ) : null}

          {hero && !emptyForTab ? (
            <section className="border-b border-neutral-200 pb-8">
              <div className="grid gap-6 lg:grid-cols-12">
                <article
                  className="group cursor-pointer lg:col-span-7"
                  onClick={() => openArticle(hero)}
                >
                  <div className="overflow-hidden bg-neutral-100">
                    <img
                      src={hero.image}
                      alt=""
                      className="aspect-[16/10] w-full object-cover transition duration-500 group-hover:scale-[1.02]"
                    />
                  </div>
                  <p className="mt-3 text-[11px] font-bold tracking-[0.14em] text-amber-800 uppercase">
                    {hero.category || hero.source} · {formatRelativeTime(hero.timestamp)}
                  </p>
                  <h1 className="font-display mt-1 text-2xl leading-[1.15] font-semibold sm:text-3xl">
                    {hero.ai_hook_title || hero.original_title}
                  </h1>
                  <p className="mt-2 text-[15px] leading-relaxed text-neutral-600">
                    {hero.ai_summary?.[0] || hero.original_description}
                  </p>
                </article>
                <div className="flex flex-col divide-y divide-neutral-200 lg:col-span-5">
                  {secondary.map((a) => (
                    <article
                      key={a.id}
                      className="cursor-pointer py-4 first:pt-0"
                      onClick={() => openArticle(a)}
                    >
                      <p className="text-[10px] font-bold tracking-wider text-neutral-500 uppercase">
                        {a.category || a.source} · {formatRelativeTime(a.timestamp)}
                      </p>
                      <h2 className="font-display mt-1 text-lg font-semibold leading-snug">
                        {a.ai_hook_title || a.original_title}
                      </h2>
                    </article>
                  ))}
                </div>
              </div>
            </section>
          ) : null}

          {(selectedTag === "All" || selectedTag === "Sports") && (
            <section className="mb-8 border border-neutral-200 bg-neutral-950 text-white">
              <div className="flex items-center justify-between border-b border-neutral-800 px-4 py-3">
                <div>
                  <p className="text-[10px] font-extrabold tracking-[0.18em] text-amber-400 uppercase">
                    Live sports
                  </p>
                  <h2 className="font-display text-xl font-semibold">Scores & major leagues</h2>
                </div>
                <a href="/sports" className="text-[11px] font-semibold text-neutral-300">
                  Full centre →
                </a>
              </div>
              {sportsLoading ? (
                <div className="p-5 text-sm text-neutral-400">Loading scores…</div>
              ) : sportsCards.length ? (
                <div className="grid gap-px bg-neutral-800 sm:grid-cols-2 lg:grid-cols-4">
                  {sportsCards.map((m: any) => (
                    <div key={m.id} className="bg-neutral-950 p-4">
                      <div className="flex items-center justify-between text-[9px] font-bold uppercase">
                        <span className="truncate text-amber-400">{m.league}</span>
                        <span className={m.live ? "text-red-400" : "text-neutral-500"}>
                          {m.live ? "LIVE" : m.status}
                        </span>
                      </div>
                      <div className="mt-3 space-y-2 text-sm">
                        <div className="flex justify-between gap-3">
                          <span className="truncate">{m.home}</span>
                          <strong>{m.homeScore ?? "–"}</strong>
                        </div>
                        <div className="flex justify-between gap-3">
                          <span className="truncate">{m.away}</span>
                          <strong>{m.awayScore ?? "–"}</strong>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-5 text-sm text-neutral-400">
                  No live boards right now. Sports headlines still appear below when available.
                </div>
              )}
            </section>
          )}

          {(selectedTag === "All" || selectedTag === "Sports") && sports.length > 0 ? (
            <section className="mb-8">
              <div className="mb-3 flex items-baseline justify-between border-b border-neutral-900 pb-2">
                <h2 className="text-sm font-extrabold tracking-wide uppercase">Sports pulse</h2>
                <button
                  type="button"
                  onClick={() => setSelectedTag("Sports")}
                  className="text-[11px] font-semibold text-neutral-500"
                >
                  See all sports →
                </button>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {sports.slice(0, 8).map((a) => (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => openArticle(a)}
                    className="overflow-hidden border border-neutral-200 bg-white text-left shadow-sm"
                  >
                    <img src={a.image} alt="" className="aspect-[4/3] w-full object-cover" />
                    <div className="p-3">
                      <p className="text-[10px] font-bold text-teal-800 uppercase">{a.source}</p>
                      <p className="font-display mt-1 line-clamp-3 text-sm font-semibold">
                        {a.ai_hook_title || a.original_title}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            </section>
          ) : null}

          <section>
            <div className="mb-3 flex items-baseline justify-between border-b border-neutral-900 pb-2">
              <h2 className="text-sm font-extrabold tracking-wide uppercase">
                {selectedTag === "All" ? "Latest" : selectedTag}
              </h2>
              <span className="text-[11px] text-neutral-400">{filtered.length} stories</span>
            </div>
            <div className="divide-y divide-neutral-100">
              {rest.map((a) => (
                <article
                  key={a.id}
                  className="flex cursor-pointer gap-4 py-5"
                  onClick={() => openArticle(a)}
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] font-bold tracking-wider text-neutral-500 uppercase">
                      {a.category || a.source} · {formatRelativeTime(a.timestamp)}
                    </p>
                    <h3 className="font-display mt-1 text-xl font-semibold leading-snug">
                      {a.ai_hook_title || a.original_title}
                    </h3>
                    <p className="mt-1 line-clamp-2 text-sm text-neutral-600">
                      {a.ai_summary?.[0] || a.original_description}
                    </p>
                  </div>
                  <div className="hidden w-28 shrink-0 sm:block sm:w-36">
                    <img src={a.image} alt="" className="aspect-[4/3] w-full object-cover" />
                  </div>
                </article>
              ))}
            </div>
          </section>
        </div>

        <aside className="space-y-6 lg:sticky lg:top-6 lg:self-start">
          <AdSlot slot="sidebar" />
          <div className="border border-neutral-200 bg-neutral-950 p-5 text-white">
            <p className="text-[10px] font-bold tracking-[0.18em] text-amber-400 uppercase">Newsletter</p>
            <h3 className="font-display mt-2 text-xl font-semibold">RWDNEWS Brief</h3>
            <form onSubmit={submitNewsletter} className="mt-4 space-y-2">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email address"
                className="h-11 w-full border border-neutral-700 bg-neutral-900 px-3 text-sm text-white outline-none"
              />
              <button
                type="submit"
                className="h-11 w-full bg-amber-500 text-sm font-bold text-neutral-950"
              >
                Subscribe free
              </button>
            </form>
            {emailMsg ? <p className="mt-2 text-xs text-amber-200">{emailMsg}</p> : null}
          </div>
          {sponsors.slice(0, 2).map((o) => (
            <div key={o.id} className="border border-amber-200 bg-amber-50/40 p-4">
              <p className="text-[10px] font-bold text-amber-800 uppercase">Sponsored</p>
              <h4 className="mt-1 text-base font-bold">{o.headline}</h4>
              <a
                href={o.ctaUrl}
                target="_blank"
                rel="noopener noreferrer sponsored"
                className="mt-2 inline-block text-xs font-bold"
                onClick={() => void logSponsorClick(o, "sidebar")}
              >
                {o.ctaText} →
              </a>
            </div>
          ))}
        </aside>
      </main>

      <footer className="border-t border-neutral-200 bg-neutral-50 py-10">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <p className="font-display text-xl font-bold">RWDNEWS</p>
          <p className="mt-1 text-sm text-neutral-500">Sports · Business · Tech · Africa</p>
        </div>
      </footer>

      {active ? (
        <ArticleReader
          article={active}
          saved={saved.includes(active.id)}
          onClose={() => setActive(null)}
          onToggleSave={() => toggleSave(active.id)}
        />
      ) : null}

      {leadOpen ? (
        <div className="fixed inset-0 z-50 grid place-items-center p-4">
          <button type="button" className="absolute inset-0 bg-black/45" onClick={() => setLeadOpen(false)} />
          <form
            onSubmit={onLeadSubmit}
            className="relative z-10 w-full max-w-md space-y-3 border bg-white p-6 shadow-xl"
          >
            <h3 className="font-display text-xl font-semibold">Advertise on RWDNEWS</h3>
            <input className="h-11 w-full border px-3 text-sm" placeholder="Name" value={leadName} onChange={(e) => setLeadName(e.target.value)} />
            <input className="h-11 w-full border px-3 text-sm" placeholder="Work email" value={leadEmail} onChange={(e) => setLeadEmail(e.target.value)} required />
            <input className="h-11 w-full border px-3 text-sm" placeholder="Company" value={leadCompany} onChange={(e) => setLeadCompany(e.target.value)} />
            <button type="submit" className="h-11 w-full bg-neutral-950 text-sm font-bold text-white">
              Request media kit
            </button>
            {leadMsg ? <p className="text-xs text-teal-800">{leadMsg}</p> : null}
          </form>
        </div>
      ) : null}
    </div>
  );
}

export default function App() {
  const path = typeof window !== "undefined" ? window.location.pathname : "/";
  let page: React.ReactNode = <RwdNewsApp />;
  if (path.startsWith("/admin")) page = <AdminPage />;
  else if (path.startsWith("/news/")) page = <StoryPage />;
  else if (path === "/sports" || path.startsWith("/sports/")) page = <SportsPage />;
  else if (["/about", "/editorial", "/privacy", "/terms", "/advertise"].includes(path))
    page = <InfoPage path={path} />;
  return <HelmetProvider>{page}</HelmetProvider>;
}
