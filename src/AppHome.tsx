import React, { useEffect, useMemo, useState } from "react";
import { isSupabaseConfigured, supabase } from "./lib/supabase";
import {
  fetchSponsors,
  submitSalesLead,
  type SponsoredOffer,
} from "./lib/sponsors";
import { logRwdNewsEvent } from "./lib/analytics";
import { filterArticlesByTab, withInferredCategory } from "./lib/filterArticles";
import { matchesCategory } from "./lib/categories";
import { HomeView } from "./HomeView";

export interface EnrichedArticle {
  id: string;
  original_url: string;
  image: string;
  timestamp: string;
  updated_at?: string;
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
const NEWS_CACHE_KEY = "rwdnews_news_cache_v2";
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

export default function RwdNewsApp() {
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
  const initialCategory =
    typeof window !== "undefined"
      ? window.location.pathname !== "/"
        ? window.location.pathname.replace(/^\//, "").split("/")[0]
        : new URLSearchParams(window.location.search).get("category")
      : null;
  const [selectedTag, setSelectedTag] = useState(
    initialCategory
      ? initialCategory.charAt(0).toUpperCase() + initialCategory.slice(1).toLowerCase()
      : "All",
  );
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
  }>({ live: [], featured: [], upcoming: [], news: [] });
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
    try {
      sessionStorage.setItem("rwdnews_pending_story", JSON.stringify(article));
      sessionStorage.setItem("rwdnews_pending_story_id", article.id);
    } catch {}
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

  const filtered = useMemo(
    () => filterArticlesByTab(articles, selectedTag, searchQuery),
    [articles, selectedTag, searchQuery],
  );

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
      setEmailMsg("You're on the RockBrief list.");
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
      message: "RockBrief sponsorship",
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
    <HomeView
      emptyForTab={emptyForTab}
      displayList={displayList}
      hero={hero}
      heroStories={heroStories}
      heroIndex={heroIndex}
      setHeroIndex={setHeroIndex}
      secondary={secondary}
      rest={rest}
      sportsCards={sportsCards}
      sportsLoading={sportsLoading}
      selectedTag={selectedTag}
      setSelectedTag={setSelectedTag}
      searchQuery={searchQuery}
      setSearchQuery={setSearchQuery}
      tags={tags}
      recommended={recommended}
      sponsors={sponsors}
      saved={saved}
      toggleSave={toggleSave}
      openArticle={openArticle}
      openAdvertiserForm={openAdvertiserForm}
      fetchNews={fetchNews}
      refreshing={refreshing}
      feedSource={feedSource}
      email={email}
      setEmail={setEmail}
      emailMsg={emailMsg}
      submitNewsletter={submitNewsletter}
      leadOpen={leadOpen}
      setLeadOpen={setLeadOpen}
      leadName={leadName}
      setLeadName={setLeadName}
      leadEmail={leadEmail}
      setLeadEmail={setLeadEmail}
      leadCompany={leadCompany}
      setLeadCompany={setLeadCompany}
      leadMsg={leadMsg}
      onLeadSubmit={onLeadSubmit}
      active={active}
      setActive={setActive}
      carouselPaused={carouselPaused}
      setCarouselPaused={setCarouselPaused}
      formatRelativeTime={formatRelativeTime}
      todayLabel={todayLabel}
      storyPath={storyPath}
      normalizeTags={normalizeTags}
    />
  );
}
