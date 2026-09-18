import React, { useEffect, useMemo, useState } from "react";
import { Helmet, HelmetProvider } from "react-helmet-async";
import { Bookmark, BookmarkCheck, RefreshCw, Search } from "lucide-react";
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
import { logRwdNewsEvent } from "./lib/analytics";

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
}

const SEED_ARTICLES: EnrichedArticle[] = [
  {
    id: "seed-1",
    original_url: "https://finance.yahoo.com/",
    image:
      "https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?auto=format&fit=crop&w=1400&q=80",
    timestamp: new Date(Date.now() - 12 * 60 * 1000).toISOString(),
    source: "Yahoo Finance",
    original_title: "Markets watch cash yields and bank competition",
    original_description:
      "Digital banks and brokers continue to compete for deposits with elevated savings yields.",
    ai_hook_title: "Cash yields stay elevated as banks compete for deposits",
    ai_summary: [
      "Savers can still find higher yields than legacy accounts — rate-shop carefully.",
      "Liquidity and deposit protection matter as much as the headline rate.",
    ],
    tags: ["Banking", "Markets", "Finance"],
    read_time: "3 min",
  },
  {
    id: "seed-2",
    original_url: "https://www.finextra.com/",
    image:
      "https://images.unsplash.com/photo-1559526324-4b87b5e36e44?auto=format&fit=crop&w=1400&q=80",
    timestamp: new Date(Date.now() - 40 * 60 * 1000).toISOString(),
    source: "Finextra",
    original_title: "Fintech rails reshape everyday payments",
    original_description:
      "Instant payments and open banking continue to change how consumers move money.",
    ai_hook_title: "Fintech payment rails keep rewriting how money moves",
    ai_summary: [
      "Faster settlement changes cash flow for businesses and households.",
      "Winners will combine speed with clear fees and strong security.",
    ],
    tags: ["Fintech", "Payments", "Business"],
    read_time: "3 min",
  },
  {
    id: "seed-3",
    original_url: "https://www.coindesk.com/",
    image:
      "https://images.unsplash.com/photo-1590283603385-17ffb3a7f29f?auto=format&fit=crop&w=1400&q=80",
    timestamp: new Date(Date.now() - 75 * 60 * 1000).toISOString(),
    source: "CoinDesk",
    original_title: "Crypto markets track macro signals",
    original_description:
      "Digital assets continue to react to rates, regulation, and institutional flows.",
    ai_hook_title: "Crypto tracks rates and regulation as institutions stay active",
    ai_summary: [
      "Macro news often moves crypto as much as coin-specific headlines.",
      "Treat volatility as the default — not the exception.",
    ],
    tags: ["Crypto", "Markets", "Finance"],
    read_time: "3 min",
  },
  {
    id: "seed-4",
    original_url: "https://www.cnbc.com/",
    image:
      "https://images.unsplash.com/photo-1563986768609-322da13575f3?auto=format&fit=crop&w=1400&q=80",
    timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    source: "CNBC",
    original_title: "Investors weigh earnings and rate paths",
    original_description:
      "Equity markets balance corporate results against central-bank expectations.",
    ai_hook_title: "Stocks balance earnings season against the path of rates",
    ai_summary: [
      "Guidance and rates often matter more than a single quarter’s beat or miss.",
      "Diversification remains the practical defense against surprise moves.",
    ],
    tags: ["Markets", "Investing", "Business"],
    read_time: "4 min",
  },
  {
    id: "seed-5",
    original_url: "https://www.marketwatch.com/",
    image:
      "https://images.unsplash.com/photo-1526304640581-d334cdbbf45e?auto=format&fit=crop&w=1400&q=80",
    timestamp: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
    source: "MarketWatch",
    original_title: "Household finance stays in focus",
    original_description:
      "Credit costs, savings rates, and job data shape everyday money decisions.",
    ai_hook_title: "Household budgets feel rates, jobs, and credit costs together",
    ai_summary: [
      "Personal finance is driven by the same macro forces as markets.",
      "Small rate differences compound — compare products before you commit.",
    ],
    tags: ["Personal Finance", "Banking", "Markets"],
    read_time: "3 min",
  },
  {
    id: "seed-6",
    original_url: "https://techcrunch.com/",
    image:
      "https://images.unsplash.com/photo-1551836022-d5d88e9218df?auto=format&fit=crop&w=1400&q=80",
    timestamp: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
    source: "TechCrunch",
    original_title: "Startups push new credit and banking models",
    original_description:
      "Challenger products use data and mobile UX to compete with traditional banks.",
    ai_hook_title: "Startups keep pressure on traditional credit and banking models",
    ai_summary: [
      "Better data can expand access — regulation still sets the boundaries.",
      "Watch fees and fine print as closely as the app design.",
    ],
    tags: ["Fintech", "Credit", "Business"],
    read_time: "4 min",
  },
];

const SAVED_KEY = "rwdnews_saved_v1";

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
  const title = (article.ai_hook_title || article.original_title).toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 90);
  return "/news/" + title + "--" + encodeURIComponent(article.id);
}

function normalizeTags(tags?: string[]) {
  return (tags || []).map((t) => String(t).replace(/^#/, ""));
}

function RwdNewsApp() {
  const [articles, setArticles] = useState<EnrichedArticle[]>([]);
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

  useEffect(() => {
    try {
      localStorage.setItem(SAVED_KEY, JSON.stringify(saved));
    } catch {
      /* ignore */
    }
  }, [saved]);

  useEffect(() => {
    void fetchSponsors().then(setSponsors);
  }, []);

  const fetchNews = async () => {
    setRefreshing(true);
    try {
      const response = await fetch("/api/news?refresh=true", {
        headers: { Accept: "application/json" },
      });
      if (!response.ok) throw new Error("Live news API unavailable");
      const payload = (await response.json()) as {
        articles?: EnrichedArticle[];
      };
      const liveArticles = Array.isArray(payload.articles) ? payload.articles : [];
      setArticles(liveArticles);
      setFeedSource(liveArticles.length ? "live" : "unavailable");
    } catch {
      // The site must not silently turn old/fabricated seed content into "real news".
      setArticles([]);
      setFeedSource("unavailable");
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    void fetchNews();
    const timer = window.setInterval(() => {
      void fetchNews();
    }, 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const openArticle = (article: EnrichedArticle) => {
    setRecentlyViewed((prev) => {
      const next = [article.id, ...prev.filter((id) => id !== article.id)].slice(0, 8);
      try { localStorage.setItem("rwdnews_recent_v1", JSON.stringify(next)); } catch {}
      return next;
    });
    void logRwdNewsEvent({ event: "article_open", articleId: article.id, articleUrl: article.original_url });
    window.location.assign(storyPath(article));
  };

  const openAdvertiserForm = () => {
    setLeadOpen(true);
    void logRwdNewsEvent({ event: "advertise_open", placement: "media_kit" });
  };

  const tags = useMemo(() => {
    const categories = new Set<string>();
    articles.forEach((a) => {
      if (a.category) categories.add(a.category);
    });
    const preferred = ["Breaking", "World", "Europe", "Middle East", "Asia", "Africa", "Sports", "Business", "Tech", "Crypto", "Entertainment"];
    return ["All", ...preferred.filter((name) => categories.has(name)), ...Array.from(categories).filter((name) => !preferred.includes(name)).sort()];
  }, [articles]);

  const filtered = useMemo(() => {
    return articles.filter((a) => {
      const t = normalizeTags(a.tags);
      const tagOk =
        selectedTag === "All" ||
        a.category === selectedTag ||
        t.includes(selectedTag);
      const q = searchQuery.trim().toLowerCase();
      if (!q) return tagOk;
      const blob = [a.ai_hook_title, a.original_title, a.source, ...(a.ai_summary || []), ...t]
        .join(" ")
        .toLowerCase();
      return tagOk && blob.includes(q);
    });
  }, [articles, selectedTag, searchQuery]);

  const hero = filtered[0];
  const secondary = filtered.slice(1, 4);
  const rest = filtered.slice(4);
  const sports = selectedTag === "All" ? articles.filter((a) => a.category === "Sports").slice(0, 4) : [];

  const toggleSave = (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setSaved((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
      if (!prev.includes(id)) {
        const article = articles.find((item) => item.id === id);
        void logRwdNewsEvent({
          event: "article_save",
          articleId: id,
          articleUrl: article?.original_url,
        });
      }
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
      void logRwdNewsEvent({ event: "newsletter_signup", placement: "sidebar" });
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

  return (
    <div className="min-h-dvh bg-white text-neutral-950">
      <Helmet>
        <title>RWDNEWS — Global News, Trends & Briefings</title>
        <meta
          name="description"
          content="RWDNEWS delivers source-backed global news, developing stories, trends, and concise briefings you can read on-site."
        />
      </Helmet>

      <div className="border-b border-neutral-200 bg-neutral-950 text-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-1.5 text-[11px] sm:px-6">
          <span className="font-medium tracking-wide text-neutral-300">{todayLabel()}</span>
          <span className="hidden text-neutral-400 sm:inline">
            {feedSource === "live" ? "Live global wire" : "Live wire reconnecting"}
            {isSupabaseConfigured ? " · Connected" : ""}
          </span>
          <button
            type="button"
            onClick={openAdvertiserForm}
            className="font-semibold text-amber-400"
          >
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
              alt="RWDNEWS — Global News, Trends & Briefings"
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
              onClick={() => void fetchNews()}
              className="press grid size-9 place-items-center rounded-full border border-neutral-200"
            >
              <RefreshCw className={`size-3.5 ${refreshing ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>
        <nav className="mx-auto flex max-w-6xl gap-1 overflow-x-auto border-t border-neutral-100 px-4 py-2 sm:px-6" aria-label="News categories">
          {tags.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setSelectedTag(t)}
              className={`shrink-0 rounded-full px-3 py-1 text-[12px] font-semibold ${
                selectedTag === t ? "bg-neutral-950 text-white" : "text-neutral-600 hover:bg-neutral-100"
              }`}
            >
              {t}
            </button>
          ))}
        </nav>
      </header>

      <div className="mx-auto max-w-6xl px-4 py-3 sm:px-6">
        <AdSlot slot={import.meta.env.VITE_ADSENSE_LEADER_SLOT} className="ad-slot-leader" />
      </div>

      <main className="mx-auto grid max-w-6xl gap-10 px-4 pb-16 sm:px-6 lg:grid-cols-[1fr_300px]">
        <div className="min-w-0">
          {hero ? (
            <section className="border-b border-neutral-200 pb-8">
              <div className="grid gap-6 lg:grid-cols-12">
                <article className="group cursor-pointer lg:col-span-7" onClick={() => openArticle(hero)}>
                  <div className="overflow-hidden bg-neutral-100">
                    <img
                      src={hero.image}
                      alt=""
                      className="aspect-[16/10] w-full object-cover transition duration-500 group-hover:scale-[1.02]"
                    />
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-2 text-[10px] font-bold tracking-[0.14em] uppercase">
                    <span className="text-amber-800">{hero.source}</span>
                    {hero.category ? <span className="text-neutral-400">· {hero.category}</span> : null}
                    <span className="text-neutral-400">· {formatRelativeTime(hero.timestamp)}</span>
                    {hero.trend_label && hero.trend_label !== "Fresh" ? (
                      <span className="rounded-full bg-amber-100 px-2 py-1 text-amber-900">{hero.trend_label}</span>
                    ) : null}
                  </div>
                  <h1 className="font-display mt-1 text-2xl leading-[1.15] font-semibold sm:text-3xl lg:text-[2.15rem]">
                    {hero.ai_hook_title || hero.original_title}
                  </h1>
                  <p className="mt-2 text-[15px] leading-relaxed text-neutral-600">
                    {hero.ai_summary?.[0] || hero.original_description}
                  </p>
                  <p className="mt-2 text-xs font-bold text-teal-800">Read full briefing on RWDNEWS →</p>
                </article>
                <div className="flex flex-col divide-y divide-neutral-200 lg:col-span-5">
                  {secondary.map((a) => (
                    <article
                      key={a.id}
                      className="story-row cursor-pointer py-4 first:pt-0"
                      onClick={() => openArticle(a)}
                    >
                      <div className="mb-3 overflow-hidden bg-neutral-100">
                        <img src={a.image} alt="" className="aspect-[16/9] w-full object-cover transition duration-500 group-hover:scale-[1.02]" />
                      </div>
                      <p className="text-[10px] font-bold tracking-wider text-neutral-500 uppercase">
                        {a.source} · {formatRelativeTime(a.timestamp)}
                      </p>
                      <h2 className="story-title font-display mt-1 text-lg font-semibold leading-snug">
                        {a.ai_hook_title || a.original_title}
                      </h2>
                      <p className="mt-1 line-clamp-2 text-sm text-neutral-600">{a.ai_summary?.[0]}</p>
                    </article>
                  ))}
                </div>
              </div>
            </section>
          ) : null}

          <div className="py-5">
            <AdSlot slot={import.meta.env.VITE_ADSENSE_INFEED_SLOT} className="ad-slot-infeed" />
          </div>

          <section className="mb-8">
            <div className="mb-3 flex items-center justify-between border-b border-neutral-900 pb-2">
              <div>
                <p className="text-[10px] font-extrabold tracking-[0.18em] text-amber-800 uppercase">Live signal</p>
                <h2 className="font-display text-xl font-semibold">Trending now</h2>
              </div>
              <span className="text-[11px] text-neutral-400">Source-backed</span>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              {filtered
                .filter((a) => a.trend_label === "Trending" || (a.trend_score || 0) >= 55)
                .slice(0, 3)
                .map((a) => (
                  <button
                    key={"trend-" + a.id}
                    type="button"
                    onClick={() => openArticle(a)}
                    className="group overflow-hidden border border-neutral-200 bg-white text-left"
                  >
                    <img src={a.image} alt="" className="aspect-[16/9] w-full object-cover transition duration-500 group-hover:scale-[1.02]" />
                    <div className="p-3">
                      <p className="text-[10px] font-bold tracking-wider text-amber-800 uppercase">
                        {a.category || "World"} · {a.trend_label || "Fresh"}
                      </p>
                      <p className="font-display mt-1 line-clamp-2 text-base font-semibold leading-snug">
                        {a.ai_hook_title || a.original_title}
                      </p>
                    </div>
                  </button>
                ))}
            </div>
          </section>

          {sports.length ? (
            <section className="mb-8">
              <div className="mb-3 flex items-center justify-between border-b border-neutral-900 pb-2">
                <div>
                  <p className="text-[10px] font-extrabold tracking-[0.18em] text-teal-800 uppercase">Global sports</p>
                  <h2 className="font-display text-xl font-semibold">Sports pulse</h2>
                </div>
                <button type="button" onClick={() => setSelectedTag("Sports")} className="text-[11px] font-semibold text-neutral-500">See all →</button>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {sports.map((a) => (
                  <button key={"sports-" + a.id} type="button" onClick={() => openArticle(a)} className="group overflow-hidden border border-neutral-200 bg-white text-left">
                    <img src={a.image} alt="" className="aspect-[4/3] w-full object-cover transition duration-500 group-hover:scale-[1.02]" />
                    <div className="p-3">
                      <p className="text-[10px] font-bold tracking-wider text-teal-800 uppercase">{a.source} · {formatRelativeTime(a.timestamp)}</p>
                      <p className="font-display mt-1 line-clamp-3 text-base font-semibold leading-snug">{a.ai_hook_title || a.original_title}</p>
                    </div>
                  </button>
                ))}
              </div>
            </section>
          ) : null}

          <section>
            {recentlyViewed.length > 0 && !searchQuery && selectedTag === "All" ? (
              <div className="mb-8">
                <div className="mb-3 flex items-baseline justify-between border-b border-neutral-900 pb-2">
                  <h2 className="text-sm font-extrabold tracking-wide uppercase">Continue reading</h2>
                  <button type="button" onClick={() => setRecentlyViewed([])} className="text-[11px] text-neutral-400 hover:text-neutral-700">Clear</button>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  {recentlyViewed.map((id) => articles.find((a) => a.id === id)).filter(Boolean).slice(0, 4).map((a) => (
                    <button key={a!.id} type="button" onClick={() => openArticle(a!)} className="border border-neutral-200 p-3 text-left hover:bg-neutral-50">
                      <p className="text-[10px] font-bold tracking-wider text-neutral-500 uppercase">{a!.source}</p>
                      <p className="font-display mt-1 line-clamp-2 text-base font-semibold">{a!.ai_hook_title || a!.original_title}</p>
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
            <div className="mb-3 flex items-baseline justify-between border-b border-neutral-900 pb-2">
              <h2 className="text-sm font-extrabold tracking-wide uppercase">Latest</h2>
              <span className="text-[11px] text-neutral-400">{filtered.length} stories</span>
            </div>
            <div className="divide-y divide-neutral-100">
              {rest.map((a, idx) => (
                <React.Fragment key={a.id}>
                  <article
                    className="story-row flex cursor-pointer gap-4 py-5"
                    onClick={() => openArticle(a)}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] font-bold tracking-wider text-neutral-500 uppercase">
                        {a.source} · {formatRelativeTime(a.timestamp)}
                      </p>
                      <h3 className="story-title font-display mt-1 text-xl font-semibold leading-snug">
                        {a.ai_hook_title || a.original_title}
                      </h3>
                      <p className="mt-1 line-clamp-2 text-sm text-neutral-600">
                        {a.ai_summary?.[0] || a.original_description}
                      </p>
                      <button type="button" className="mt-2 text-neutral-400" onClick={(e) => toggleSave(a.id, e)}>
                        {saved.includes(a.id) ? (
                          <BookmarkCheck className="size-3.5 text-teal-800" />
                        ) : (
                          <Bookmark className="size-3.5" />
                        )}
                      </button>
                    </div>
                    <div className="hidden w-28 shrink-0 bg-neutral-100 sm:block sm:w-36">
                      <img src={a.image} alt="" className="aspect-[4/3] h-full w-full object-cover" />
                    </div>
                  </article>
                  {idx === 2 && sponsors[0] ? (
                    <PartnerCard offer={sponsors[0]} placement="in_feed" />
                  ) : null}
                </React.Fragment>
              ))}
            </div>
            {filtered.length === 0 ? (
              <div className="border border-neutral-200 bg-neutral-50 p-8 text-center">
                <p className="font-display text-xl font-semibold">Live stories are loading.</p>
                <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-neutral-500">
                  RWDNEWS only displays source-backed stories. If the live wire is temporarily unavailable, we will not fill the feed with fabricated headlines.
                </p>
                <button
                  type="button"
                  onClick={() => void fetchNews()}
                  className="press mt-4 h-10 rounded-full bg-neutral-950 px-5 text-xs font-bold text-white"
                >
                  Retry live wire
                </button>
              </div>
            ) : null}
          </section>
        </div>

        <aside className="space-y-6 lg:sticky lg:top-6 lg:self-start">
          <AdSlot slot={import.meta.env.VITE_ADSENSE_SIDEBAR_SLOT} className="ad-slot-sidebar" />
          <div className="border border-neutral-200 bg-neutral-50 p-4">
            <p className="text-[10px] font-bold tracking-[0.16em] text-teal-800 uppercase">RWDNEWS standard</p>
            <p className="mt-1 text-sm font-semibold">Source-backed first. AI-assisted second.</p>
            <p className="mt-1 text-xs leading-relaxed text-neutral-500">
              Headlines and briefings are generated from discovered publisher reports; the original source stays one tap away.
            </p>
          </div>
          <div className="border border-neutral-200 bg-neutral-950 p-5 text-white">
            <p className="text-[10px] font-bold tracking-[0.18em] text-amber-400 uppercase">Newsletter</p>
            <h3 className="font-display mt-2 text-xl font-semibold">RWDNEWS Brief</h3>
            <p className="mt-1 text-sm text-neutral-400">Global news & trends — weekly.</p>
            <form onSubmit={submitNewsletter} className="mt-4 space-y-2">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email address"
                className="h-11 w-full border border-neutral-700 bg-neutral-900 px-3 text-sm text-white outline-none"
              />
              <button type="submit" className="press h-11 w-full bg-amber-500 text-sm font-bold text-neutral-950">
                Subscribe free
              </button>
            </form>
            {emailMsg ? <p className="mt-2 text-xs text-amber-200">{emailMsg}</p> : null}
          </div>
          {sponsors.slice(0, 2).map((o) => (
            <PartnerCard key={o.id} offer={o} placement="sidebar" compact />
          ))}
          <div className="border border-neutral-200 p-4">
            <p className="text-[10px] font-bold tracking-wider text-neutral-500 uppercase">For brands</p>
            <p className="mt-1 text-sm font-semibold">Advertise on RWDNEWS</p>
            <button
              type="button"
              onClick={() => setLeadOpen(true)}
              className="mt-3 text-xs font-bold text-teal-800 underline-offset-2 hover:underline"
            >
              Request media kit →
            </button>
          </div>
          <AdSlot slot={import.meta.env.VITE_ADSENSE_SIDEBAR_SLOT} className="ad-slot-sidebar" />
        </aside>
      </main>

      <footer className="border-t border-neutral-200 bg-neutral-50 py-10">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <img src="/rwdnews-logo.svg" alt="RWDNEWS" className="h-auto w-[190px]" />
          <p className="mt-2 text-sm text-neutral-500">
            Read on-site briefings · Sources credited · Built for readers & advertisers
          </p>
          <nav className="mt-4 flex flex-wrap gap-4 text-xs font-semibold text-neutral-600" aria-label="RWDNEWS information">
            <a href="/about">About</a><a href="/editorial">Editorial</a><a href="/advertise">Advertise</a><a href="/privacy">Privacy</a><a href="/terms">Terms</a>
          </nav>
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
            <p className="text-sm leading-relaxed text-neutral-600">
              Put your brand in front of readers through sponsored stories, newsletter
              placements, or premium homepage inventory. We will send the current media kit
              and availability after your inquiry.
            </p>
            <div className="grid grid-cols-1 gap-2 text-xs sm:grid-cols-3">
              {["Sponsored stories", "Newsletter", "Homepage"].map((item) => (
                <div key={item} className="border border-neutral-200 px-3 py-2 font-semibold text-neutral-700">
                  {item}
                </div>
              ))}
            </div>
            <input className="h-11 w-full border px-3 text-sm" placeholder="Name" value={leadName} onChange={(e) => setLeadName(e.target.value)} />
            <input className="h-11 w-full border px-3 text-sm" placeholder="Work email" value={leadEmail} onChange={(e) => setLeadEmail(e.target.value)} required />
            <input className="h-11 w-full border px-3 text-sm" placeholder="Company" value={leadCompany} onChange={(e) => setLeadCompany(e.target.value)} />
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

function PartnerCard({
  offer,
  placement,
  compact,
}: {
  offer: SponsoredOffer;
  placement: string;
  compact?: boolean;
}) {
  return (
    <div className={`border border-amber-200 bg-amber-50/40 ${compact ? "p-4" : "my-1 p-5"}`}>
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
        onClick={() => void logSponsorClick(offer, placement)}
      >
        {offer.ctaText} →
      </a>
    </div>
  );
}

export default function App() {
  const path = typeof window !== "undefined" ? window.location.pathname : "/";
  let page: React.ReactNode = <RwdNewsApp />;
  if (path === "/admin" || path.startsWith("/admin/")) page = <AdminPage />;
  else if (path.startsWith("/news/")) page = <StoryPage />;
  else if (["/about", "/editorial", "/privacy", "/terms", "/advertise"].includes(path)) page = <InfoPage path={path} />;
  return <HelmetProvider>{page}</HelmetProvider>;
}
