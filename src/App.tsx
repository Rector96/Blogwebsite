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
import PredictionsPage from "./pages/PredictionsPage";
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
  const initialCategory = typeof window !== "undefined"
    ? (window.location.pathname !== "/" ? window.location.pathname.replace(/^\//, "").split("/")[0] : new URLSearchParams(window.location.search).get("category"))
    : null;
  const [selectedTag, setSelectedTag] = useState(initialCategory ? (initialCategory.charAt(0).toUpperCase() + initialCategory.slice(1).toLowerCase()) : "All");
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
  const [sportsFeed, setSportsFeed] = useState<{
    live: any[];
    featured: any[];
    upcoming: any[];
    news: any[];
  }>({
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

  const tags = useMemo(
    () => ["All", "Sports", "Business", "Tech", "Crypto", "Nigeria", "Africa", "World", "Entertainment"],
    [],
  );

  // STRICT: All = everything; Sports = sports only; etc.
  const filtered = useMemo(
    () => filterArticlesByTab(articles, selectedTag, searchQuery),
    [articles, selectedTag, searchQuery],
  );

  // When Sports tab: merge API sports news so the tab is never empty
  const sportsMerged = useMemo(() => {
    const fromArticles = articles.filter((a) => matchesCategory(a, "Sports"));
    const fromFeed = (sportsFeed.news || []).map((s: any) => ({
      id: String(s.id),
      original_url: String(s.original_url || ""),
      image: String(s.image || ""),
      timestamp: String(s.timestamp || new Date().toISOString()),
      source: String(s.source || "Sports"),
      original_title: String(s.original_title || ""),
      original_description: String(s.original_description || ""),
      ai_hook_title: String(s.ai_hook_title || s.original_title || ""),
      ai_summary: Array.isArray(s.ai_summary) ? s.ai_summary : [],
      tags: ["#Sports"],
      category: "Sports",
    }));
    const map = new Map<string, EnrichedArticle>();
    [...fromArticles, ...fromFeed].forEach((a) => {
      if (a.id && !map.has(a.id)) map.set(a.id, a as EnrichedArticle);
    });
    return Array.from(map.values()).sort(
      (a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp),
    );
  }, [articles, sportsFeed.news]);

  const displayList = selectedTag === "Sports" && sportsMerged.length ? sportsMerged : filtered;

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

  const heroStories = displayList.slice(0, 5);
  const hero = heroStories[heroIndex % Math.max(heroStories.length, 1)] || displayList[0];
  const secondary = displayList.slice(1, 4);
  const rest = displayList.slice(4);
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
    selectedTag !== "All" &&
    displayList.length === 0 &&
    !(selectedTag === "Sports" && sportsMerged.length > 0) &&
    !refreshing
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
          <div className="flex items-center gap-3">
            <a href="/sport" className="font-semibold text-teal-300 hover:text-white">
              Sports desk
            </a>
            <button type="button" onClick={openAdvertiserForm} className="font-semibold text-amber-400">
              Advertise
            </button>
          </div>
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
                  onClick={() => {
                    setSelectedTag(t);
                    const target = t === "All" ? "/" : t === "Sports" ? "/sport" : `/${t.toLowerCase()}`;
                    window.history.pushState({ category: t }, "", target);
                  }}
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
                ? `${displayList.length} stories · all topics`
                : `${displayList.length} ${selectedTag} stories only`}
              {selectedTag === "Sports" ? (
                <>
                  {" · "}
                  <a href="/sport" className="font-semibold text-teal-700 underline-offset-2 hover:underline">
                    Open Sports desk
                  </a>
                  {" · "}
                  <a
                    href="/sport/predictions"
                    className="font-semibold text-amber-700 underline-offset-2 hover:underline"
                  >
                    AI Predictions
                  </a>
                </>
              ) : null}
            </p>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-4 py-3 sm:px-6">
        <AdSlot slot="leaderboard" />
      </div>

      {/* Sports quick rail — always visible so users find scores + predictions fast */}
      <div className="border-b border-neutral-200 bg-neutral-950 text-white">
        <div className="mx-auto max-w-6xl px-4 py-4 sm:px-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-[10px] font-extrabold tracking-[0.16em] text-amber-400 uppercase">
                Sports desk
              </p>
              <p className="mt-0.5 text-sm font-semibold">Scores · sports news · live updates</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <a
                href="/sport"
                className="rounded-full bg-white px-4 py-2 text-xs font-extrabold text-neutral-950"
              >
                Full Sports centre
              </a>
              <a
                href="/sport/predictions"
                className="rounded-full bg-amber-500 px-4 py-2 text-xs font-extrabold text-neutral-950"
              >
                AI Predictions →
              </a>
            </div>
          </div>
          {sportsLoading ? (
            <p className="mt-3 text-xs text-neutral-400">Loading scores…</p>
          ) : sportsCards.length ? (
            <div className="mt-3 grid gap-px overflow-hidden rounded-xl bg-neutral-800 sm:grid-cols-2 lg:grid-cols-4">
              {sportsCards.slice(0, 4).map((m: any) => (
                <a
                  key={m.id}
                  href={`/sports/predictions?id=${encodeURIComponent(m.id)}`}
                  className="bg-neutral-950 p-3 transition hover:bg-neutral-900"
                >
                  <div className="flex items-center justify-between gap-2 text-[9px] font-bold uppercase">
                    <span className="truncate text-teal-400">{m.league}</span>
                    <span className={m.live ? "text-red-400" : "text-neutral-500"}>
                      {m.live ? "● LIVE" : m.status}
                    </span>
                  </div>
                  <p className="mt-2 text-xs font-semibold leading-snug">
                    {m.home} vs {m.away}
                  </p>
                  <p className="mt-1 text-[10px] text-amber-400">Open Sports desk →</p>
                </a>
              ))}
            </div>
          ) : (
            <p className="mt-3 text-xs text-neutral-400">
              Fixtures update throughout the day. Open the Sports desk for latest headlines and
              transfers.
            </p>
          )}
        </div>
      </div>

      <main className="mx-auto grid max-w-6xl gap-10 px-4 pb-16 pt-6 sm:px-6 lg:grid-cols-[1fr_300px]">
        <div className="min-w-0">
          {emptyForTab ? (
            <div className="mb-8 border border-dashed border-neutral-300 bg-neutral-50 p-8 text-center">
              <p className="font-display text-lg font-semibold">{emptyForTab}</p>
              <div className="mt-4 flex flex-wrap justify-center gap-3">
                <button
                  type="button"
                  onClick={() => void fetchNews(true)}
                  className="rounded-full bg-neutral-950 px-4 py-2 text-xs font-bold text-white"
                >
                  Refresh live wire
                </button>
                {selectedTag === "Sports" ? (
                  <a
                    href="/sport"
                    className="rounded-full border border-neutral-300 bg-white px-4 py-2 text-xs font-bold"
                  >
                    Go to Sports desk
                  </a>
                ) : null}
              </div>
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
                    {hero.image ? (
                      <img
                        src={hero.image}
                        alt=""
                        className="aspect-[16/10] w-full object-cover transition duration-500 group-hover:scale-[1.02]"
                      />
                    ) : (
                      <div className="flex aspect-[16/10] items-center justify-center bg-neutral-200 text-sm text-neutral-500">
                        {hero.category || "News"}
                      </div>
                    )}
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
              {heroStories.length > 1 ? (
                <div className="mt-4 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setHeroIndex((i) => (i - 1 + heroStories.length) % heroStories.length)}
                    className="grid size-8 place-items-center rounded-full border"
                    aria-label="Previous"
                  >
                    <ChevronLeft className="size-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setHeroIndex((i) => (i + 1) % heroStories.length)}
                    className="grid size-8 place-items-center rounded-full border"
                    aria-label="Next"
                  >
                    <ChevronRight className="size-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setCarouselPaused((p) => !p)}
                    className="text-[11px] font-semibold text-neutral-500"
                  >
                    {carouselPaused ? "Play" : "Pause"}
                  </button>
                </div>
              ) : null}
            </section>
          ) : null}

          {rest.length ? (
            <section className="mt-8">
              <h2 className="font-display text-xl font-semibold">More stories</h2>
              <div className="mt-4 grid gap-5 sm:grid-cols-2">
                {rest.map((a) => (
                  <article
                    key={a.id}
                    className="group cursor-pointer overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-sm"
                    onClick={() => openArticle(a)}
                  >
                    {a.image ? (
                      <img
                        src={a.image}
                        alt=""
                        className="aspect-[16/10] w-full object-cover transition group-hover:scale-[1.02]"
                      />
                    ) : null}
                    <div className="p-4">
                      <p className="text-[10px] font-bold tracking-wider text-neutral-500 uppercase">
                        {a.category || a.source} · {formatRelativeTime(a.timestamp)}
                      </p>
                      <h3 className="font-display mt-1 text-base font-semibold leading-snug">
                        {a.ai_hook_title || a.original_title}
                      </h3>
                      <p className="mt-2 line-clamp-2 text-sm text-neutral-600">
                        {a.ai_summary?.[0] || a.original_description}
                      </p>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          ) : null}

          {recommended.length ? (
            <section className="mt-10">
              <h2 className="font-display text-xl font-semibold">Recommended for you</h2>
              <div className="mt-3 space-y-3">
                {recommended.map((a) => (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => openArticle(a)}
                    className="flex w-full gap-3 border-b border-neutral-100 py-3 text-left"
                  >
                    {a.image ? (
                      <img src={a.image} alt="" className="size-16 shrink-0 rounded object-cover" />
                    ) : null}
                    <div className="min-w-0">
                      <p className="text-[10px] font-bold text-neutral-500 uppercase">
                        {a.category} · {formatRelativeTime(a.timestamp)}
                      </p>
                      <p className="font-display text-sm font-semibold leading-snug">
                        {a.ai_hook_title || a.original_title}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            </section>
          ) : null}
        </div>

        <aside className="space-y-6">
          {sponsors.slice(0, 2).map((offer) => (
            <div key={offer.id} className="border border-amber-200 bg-amber-50/40 p-4">
              <p className="text-[10px] font-bold tracking-[0.14em] text-amber-800 uppercase">
                {offer.disclosure || "Sponsored"}
              </p>
              <p className="mt-1 text-xs font-semibold text-neutral-500">{offer.sponsorName}</p>
              <h4 className="mt-1 text-base font-bold">{offer.headline}</h4>
              <a
                href={offer.ctaUrl}
                target="_blank"
                rel="noopener noreferrer sponsored"
                className="mt-3 inline-block text-xs font-bold underline-offset-2 hover:underline"
                onClick={() => void logSponsorClick(offer, "sidebar")}
              >
                {offer.ctaText} →
              </a>
            </div>
          ))}

          <form onSubmit={submitNewsletter} className="rounded-xl border border-neutral-200 p-4">
            <p className="text-sm font-bold">Daily briefing</p>
            <p className="mt-1 text-xs text-neutral-500">Top stories in your inbox.</p>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email"
              className="mt-3 h-10 w-full border px-3 text-sm"
            />
            <button type="submit" className="mt-2 h-10 w-full bg-neutral-950 text-xs font-bold text-white">
              Subscribe
            </button>
            {emailMsg ? <p className="mt-2 text-xs text-teal-800">{emailMsg}</p> : null}
          </form>

          <AdSlot slot="sidebar" />
        </aside>
      </main>

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
            <input
              className="h-11 w-full border px-3 text-sm"
              placeholder="Name"
              value={leadName}
              onChange={(e) => setLeadName(e.target.value)}
            />
            <input
              className="h-11 w-full border px-3 text-sm"
              placeholder="Work email"
              value={leadEmail}
              onChange={(e) => setLeadEmail(e.target.value)}
              required
            />
            <input
              className="h-11 w-full border px-3 text-sm"
              placeholder="Company"
              value={leadCompany}
              onChange={(e) => setLeadCompany(e.target.value)}
            />
            <button type="submit" className="press h-11 w-full bg-neutral-950 text-sm font-bold text-white">
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
  else if (path === "/sport/predictions" || path.startsWith("/sport/predictions/"))
    page = <PredictionsPage />;
  else if (path === "/sport" || path.startsWith("/sport/")) page = <SportsPage />;
  else if (["/about", "/editorial", "/privacy", "/terms", "/advertise"].includes(path))
    page = <InfoPage path={path} />;
  return <HelmetProvider>{page}</HelmetProvider>;
}