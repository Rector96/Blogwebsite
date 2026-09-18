import React, { useEffect, useMemo, useState } from "react";
import { Helmet, HelmetProvider } from "react-helmet-async";
import {
  Bookmark,
  BookmarkCheck,
  ExternalLink,
  Menu,
  RefreshCw,
  Search,
  X,
} from "lucide-react";
import { isSupabaseConfigured, supabase } from "./lib/supabase";
import {
  FALLBACK_SPONSORS,
  fetchSponsors,
  logSponsorClick,
  submitSalesLead,
  type SponsoredOffer,
} from "./lib/sponsors";

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
}

/** Always on screen even if Supabase / API is empty */
const SEED_ARTICLES: EnrichedArticle[] = [
  {
    id: "seed-1",
    original_url:
      "https://www.marketwatch.com/personal-finance/banking/high-yield-cash-sweeps",
    image:
      "https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?auto=format&fit=crop&w=1400&q=80",
    timestamp: new Date(Date.now() - 12 * 60 * 1000).toISOString(),
    source: "MarketWatch",
    original_title: "Neobanks push cash-sweep yields higher",
    original_description:
      "Digital banks compete for deposits with elevated savings yields.",
    ai_hook_title:
      "Cash-sweep yields climb as digital banks fight for uninvested deposits",
    ai_summary: [
      "Households can earn far more than legacy 0.01% savings — if they shop rates.",
      "Liquidity and insurance structure still matter more than the headline APY alone.",
    ],
    tags: ["Banking", "Personal Finance", "Fintech"],
    read_time: "3 min",
  },
  {
    id: "seed-2",
    original_url:
      "https://www.consumerfinance.gov/about-us/newsroom/cfpb-finalizes-personal-financial-data-rights/",
    image:
      "https://images.unsplash.com/photo-1559526324-4b87b5e36e44?auto=format&fit=crop&w=1400&q=80",
    timestamp: new Date(Date.now() - 40 * 60 * 1000).toISOString(),
    source: "CFPB",
    original_title: "Open banking data rights finalized",
    original_description: "Rule 1033 aims to replace password scraping with secure APIs.",
    ai_hook_title:
      "Open banking rules aim to end password scraping for financial apps",
    ai_summary: [
      "Regulators want signed, revocable bank tokens instead of shared logins.",
      "Budget and lending apps become easier to connect — when banks comply.",
    ],
    tags: ["Regulation", "Fintech", "Banking"],
    read_time: "4 min",
  },
  {
    id: "seed-3",
    original_url:
      "https://www.finextra.com/newsarticle/realtime-payroll-earned-wage-access",
    image:
      "https://images.unsplash.com/photo-1590283603385-17ffb3a7f29f?auto=format&fit=crop&w=1400&q=80",
    timestamp: new Date(Date.now() - 75 * 60 * 1000).toISOString(),
    source: "Finextra",
    original_title: "Earned wage access expands via payroll rails",
    original_description: "Workers access accrued pay between cycles through employer integrations.",
    ai_hook_title:
      "Earned wage access grows as payroll rails reach more employers",
    ai_summary: [
      "Early access to earned pay can reduce overdrafts when products are transparent.",
      "Distribution through HR systems is the real competitive edge.",
    ],
    tags: ["Payments", "Fintech", "Personal Finance"],
    read_time: "3 min",
  },
  {
    id: "seed-4",
    original_url:
      "https://finance.yahoo.com/news/direct-indexing-tax-loss-harvesting-retail",
    image:
      "https://images.unsplash.com/photo-1563986768609-322da13575f3?auto=format&fit=crop&w=1400&q=80",
    timestamp: new Date(Date.now() - 2.5 * 60 * 60 * 1000).toISOString(),
    source: "Yahoo Finance",
    original_title: "Direct indexing reaches smaller portfolios",
    original_description: "Tax-loss harvesting tools expand beyond high-net-worth desks.",
    ai_hook_title:
      "Direct indexing brings tax-aware investing to smaller taxable accounts",
    ai_summary: [
      "After-tax outcomes are becoming a product feature, not a private-bank luxury.",
      "Results still depend on market moves, fees, and local tax rules.",
    ],
    tags: ["Investing", "Wealth", "Personal Finance"],
    read_time: "4 min",
  },
  {
    id: "seed-5",
    original_url: "https://www.federalreserve.gov/paymentsystems/fednow_about.htm",
    image:
      "https://images.unsplash.com/photo-1526304640581-d334cdbbf45e?auto=format&fit=crop&w=1400&q=80",
    timestamp: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
    source: "Federal Reserve",
    original_title: "Instant payments change merchant economics",
    original_description: "Account-to-account rails compete with card interchange models.",
    ai_hook_title:
      "Instant A2A payments pressure card fees — and rewrite checkout math",
    ai_summary: [
      "Faster settlement changes float, refunds, and cash flow for merchants.",
      "Whether shoppers see savings depends on competition, not the rail alone.",
    ],
    tags: ["Payments", "Banking", "Fintech"],
    read_time: "3 min",
  },
  {
    id: "seed-6",
    original_url:
      "https://techcrunch.com/fintech/cash-flow-underwriting-credit-revolution",
    image:
      "https://images.unsplash.com/photo-1551836022-d5d88e9218df?auto=format&fit=crop&w=1400&q=80",
    timestamp: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
    source: "TechCrunch",
    original_title: "Cash-flow underwriting challenges FICO",
    original_description: "Issuers use live bank data for thin-file borrowers.",
    ai_hook_title:
      "Cash-flow underwriting challenges pure FICO scores for new credit cards",
    ai_summary: [
      "Payroll and deposit patterns can open credit for gig and young workers.",
      "Fairness, consent, and data use remain under regulatory watch.",
    ],
    tags: ["Credit", "Fintech", "Personal Finance"],
    read_time: "4 min",
  },
];

const SAVED_KEY = "finsignal_saved_v1";

function formatRelativeTime(iso: string) {
  try {
    const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
    if (mins < 1) return "Just now";
    if (mins < 60) return `${mins}m ago`;
    const h = Math.floor(mins / 60);
    if (h < 24) return `${h}h ago`;
    return new Date(iso).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    });
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

function normalizeTags(tags?: string[]) {
  return (tags || []).map((t) => t.replace(/^#/, ""));
}

function FinSignalApp() {
  const [articles, setArticles] = useState<EnrichedArticle[]>(SEED_ARTICLES);
  const [sponsors, setSponsors] = useState<SponsoredOffer[]>(FALLBACK_SPONSORS);
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
  const [mobileNav, setMobileNav] = useState(false);
  const [email, setEmail] = useState("");
  const [emailMsg, setEmailMsg] = useState<string | null>(null);
  const [feedSource, setFeedSource] = useState<"live" | "seed">("seed");
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
      if (isSupabaseConfigured && supabase) {
        const { data, error } = await supabase
          .from("articles")
          .select("*")
          .order("timestamp", { ascending: false })
          .limit(40);
        if (!error && data && data.length > 0) {
          const mapped = data.map((row) => ({
            ...(row as EnrichedArticle),
            tags: normalizeTags((row as EnrichedArticle).tags),
          }));
          setArticles(mapped);
          setFeedSource("live");
          return;
        }
      }
      // Keep seed visible — never blank homepage
      setArticles(SEED_ARTICLES);
      setFeedSource("seed");
    } catch {
      setArticles(SEED_ARTICLES);
      setFeedSource("seed");
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    void fetchNews();
  }, []);

  const tags = useMemo(() => {
    const s = new Set<string>();
    articles.forEach((a) => normalizeTags(a.tags).forEach((t) => s.add(t)));
    return ["All", ...Array.from(s)];
  }, [articles]);

  const filtered = useMemo(() => {
    return articles.filter((a) => {
      const tags = normalizeTags(a.tags);
      const tagOk = selectedTag === "All" || tags.includes(selectedTag);
      const q = searchQuery.trim().toLowerCase();
      if (!q) return tagOk;
      const blob = [
        a.ai_hook_title,
        a.original_title,
        a.source,
        ...(a.ai_summary || []),
        ...tags,
      ]
        .join(" ")
        .toLowerCase();
      return tagOk && blob.includes(q);
    });
  }, [articles, selectedTag, searchQuery]);

  const hero = filtered[0];
  const secondary = filtered.slice(1, 4);
  const rest = filtered.slice(4);
  const sideSponsors = sponsors.slice(0, 2);

  const toggleSave = (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setSaved((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
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
        await supabase.from("newsletter_subscribers").upsert(
          { email: v, source: "finsignal_web" },
          { onConflict: "email" },
        );
      }
      setEmailMsg("You're on the list.");
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
      message: "Sponsorship / media kit",
    });
    setLeadMsg(res.ok ? "Received. We'll send rates shortly." : "Thanks — we'll follow up.");
  };

  const pageTitle = active
    ? `${active.ai_hook_title} · FinSignal`
    : "FinSignal — Markets, Fintech & Money";

  return (
    <div className="min-h-dvh bg-white text-neutral-950">
      <Helmet>
        <title>{pageTitle}</title>
        <meta
          name="description"
          content="Modern finance and fintech news. Markets, banking, payments — for readers and quality advertisers."
        />
      </Helmet>

      {/* Top utility bar */}
      <div className="border-b border-neutral-200 bg-neutral-950 text-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-1.5 text-[11px] sm:px-6">
          <span className="font-medium tracking-wide text-neutral-300">
            {todayLabel()}
          </span>
          <span className="hidden text-neutral-400 sm:inline">
            {feedSource === "live" ? "Live wire · Supabase" : "Editorial wire · Demo feed"}
            {isSupabaseConfigured ? " · DB connected" : " · Add Supabase keys for live news"}
          </span>
          <button
            type="button"
            onClick={() => setLeadOpen(true)}
            className="font-semibold text-amber-400 hover:text-amber-300"
          >
            Advertise
          </button>
        </div>
      </div>

      {/* Masthead */}
      <header className="border-b border-neutral-200">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-4 sm:px-6 sm:py-5">
          <button
            type="button"
            className="grid size-10 place-items-center rounded border border-neutral-200 sm:hidden"
            onClick={() => setMobileNav((v) => !v)}
          >
            {mobileNav ? <X className="size-4" /> : <Menu className="size-4" />}
          </button>

          <a href="/" className="text-center sm:text-left">
            <p className="font-display text-3xl font-bold tracking-tight sm:text-4xl">
              FinSignal
            </p>
            <p className="mt-0.5 text-[10px] font-semibold tracking-[0.2em] text-neutral-500 uppercase">
              Markets · Fintech · Money
            </p>
          </a>

          <div className="flex items-center gap-2">
            <div className="relative hidden md:block">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-neutral-400" />
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search"
                className="h-9 w-44 rounded-full border border-neutral-200 bg-neutral-50 pr-3 pl-9 text-sm outline-none focus:border-neutral-400 lg:w-56"
              />
            </div>
            <button
              type="button"
              onClick={() => void fetchNews()}
              className="press grid size-9 place-items-center rounded-full border border-neutral-200"
              title="Refresh"
            >
              <RefreshCw className={`size-3.5 ${refreshing ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>

        {/* Section nav */}
        <nav className="mx-auto flex max-w-6xl gap-1 overflow-x-auto border-t border-neutral-100 px-4 py-2 sm:px-6">
          {tags.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setSelectedTag(t)}
              className={`shrink-0 rounded-full px-3 py-1 text-[12px] font-semibold ${
                selectedTag === t
                  ? "bg-neutral-950 text-white"
                  : "text-neutral-600 hover:bg-neutral-100"
              }`}
            >
              {t}
            </button>
          ))}
        </nav>
      </header>

      {/* Leaderboard ad slot — Google Ads ready */}
      <div className="mx-auto max-w-6xl px-4 py-3 sm:px-6">
        <div className="ad-slot ad-slot-leader" id="ad-leaderboard">
          Advertisement
        </div>
      </div>

      <main className="mx-auto grid max-w-6xl gap-10 px-4 pb-16 sm:px-6 lg:grid-cols-[1fr_300px]">
        <div className="min-w-0">
          {/* Hero + secondary */}
          {hero ? (
            <section className="border-b border-neutral-200 pb-8">
              <div className="grid gap-6 lg:grid-cols-12">
                <article
                  className="group cursor-pointer lg:col-span-7"
                  onClick={() => setActive(hero)}
                >
                  <div className="overflow-hidden bg-neutral-100">
                    <img
                      src={hero.image}
                      alt=""
                      className="aspect-[16/10] w-full object-cover transition duration-500 group-hover:scale-[1.02]"
                    />
                  </div>
                  <p className="mt-3 text-[11px] font-bold tracking-[0.14em] text-amber-800 uppercase">
                    {hero.source} · {formatRelativeTime(hero.timestamp)}
                  </p>
                  <h1 className="font-display mt-1 text-2xl leading-[1.15] font-semibold sm:text-3xl lg:text-[2.15rem]">
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
                      className="story-row cursor-pointer py-4 first:pt-0"
                      onClick={() => setActive(a)}
                    >
                      <p className="text-[10px] font-bold tracking-wider text-neutral-500 uppercase">
                        {a.source} · {formatRelativeTime(a.timestamp)}
                      </p>
                      <h2 className="story-title font-display mt-1 text-lg leading-snug font-semibold transition">
                        {a.ai_hook_title || a.original_title}
                      </h2>
                      <p className="mt-1 line-clamp-2 text-sm text-neutral-600">
                        {a.ai_summary?.[0]}
                      </p>
                    </article>
                  ))}
                </div>
              </div>
            </section>
          ) : null}

          {/* In-feed ad */}
          <div className="py-5">
            <div className="ad-slot ad-slot-infeed" id="ad-infeed">
              Advertisement
            </div>
          </div>

          {/* Latest list */}
          <section>
            <div className="mb-3 flex items-baseline justify-between border-b border-neutral-900 pb-2">
              <h2 className="text-sm font-extrabold tracking-wide uppercase">
                Latest
              </h2>
              <span className="text-[11px] text-neutral-400">
                {filtered.length} stories
              </span>
            </div>

            <div className="divide-y divide-neutral-100">
              {rest.map((a, idx) => (
                <React.Fragment key={a.id}>
                  <article
                    className="story-row flex cursor-pointer gap-4 py-5"
                    onClick={() => setActive(a)}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] font-bold tracking-wider text-neutral-500 uppercase">
                        {a.source} · {formatRelativeTime(a.timestamp)}
                      </p>
                      <h3 className="story-title font-display mt-1 text-xl leading-snug font-semibold transition">
                        {a.ai_hook_title || a.original_title}
                      </h3>
                      <p className="mt-1 line-clamp-2 text-sm text-neutral-600">
                        {a.ai_summary?.[0] || a.original_description}
                      </p>
                      <div className="mt-2 flex items-center gap-3">
                        <span className="text-[11px] text-neutral-400">
                          {a.read_time || "3 min"}
                        </span>
                        <button
                          type="button"
                          onClick={(e) => toggleSave(a.id, e)}
                          className="text-neutral-400 hover:text-teal-800"
                        >
                          {saved.includes(a.id) ? (
                            <BookmarkCheck className="size-3.5 text-teal-800" />
                          ) : (
                            <Bookmark className="size-3.5" />
                          )}
                        </button>
                      </div>
                    </div>
                    <div className="hidden w-28 shrink-0 overflow-hidden bg-neutral-100 sm:block sm:w-36">
                      <img
                        src={a.image}
                        alt=""
                        className="aspect-[4/3] h-full w-full object-cover"
                      />
                    </div>
                  </article>
                  {idx === 2 && sponsors[0] ? (
                    <PartnerCard offer={sponsors[0]} placement="in_feed" />
                  ) : null}
                </React.Fragment>
              ))}

              {filtered.length === 0 ? (
                <p className="py-12 text-center text-sm text-neutral-500">
                  No stories match this filter.
                </p>
              ) : null}
            </div>
          </section>
        </div>

        {/* Sidebar */}
        <aside className="space-y-6 lg:sticky lg:top-6 lg:self-start">
          <div className="ad-slot ad-slot-sidebar" id="ad-sidebar-top">
            Advertisement
          </div>

          <div className="border border-neutral-200 bg-neutral-950 p-5 text-white">
            <p className="text-[10px] font-bold tracking-[0.18em] text-amber-400 uppercase">
              Newsletter
            </p>
            <h3 className="font-display mt-2 text-xl font-semibold">
              The FinSignal Brief
            </h3>
            <p className="mt-1 text-sm text-neutral-400">
              Markets and fintech worth knowing — once a week.
            </p>
            <form onSubmit={submitNewsletter} className="mt-4 space-y-2">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email address"
                className="h-11 w-full border border-neutral-700 bg-neutral-900 px-3 text-sm text-white outline-none focus:border-amber-500"
              />
              <button
                type="submit"
                className="press h-11 w-full bg-amber-500 text-sm font-bold text-neutral-950 hover:bg-amber-400"
              >
                Subscribe free
              </button>
            </form>
            {emailMsg ? (
              <p className="mt-2 text-xs text-amber-200">{emailMsg}</p>
            ) : null}
          </div>

          {sideSponsors.map((o) => (
            <PartnerCard key={o.id} offer={o} placement="sidebar" compact />
          ))}

          <div className="border border-neutral-200 p-4">
            <p className="text-[10px] font-bold tracking-wider text-neutral-500 uppercase">
              For brands
            </p>
            <p className="mt-1 text-sm font-semibold">
              Reach readers who care about money products
            </p>
            <p className="mt-1 text-xs leading-relaxed text-neutral-500">
              Labeled sponsorships · Newsletter · Display-ready slots for Google
              Ads when traffic qualifies.
            </p>
            <button
              type="button"
              onClick={() => setLeadOpen(true)}
              className="mt-3 text-xs font-bold text-teal-800 underline-offset-2 hover:underline"
            >
              Request media kit →
            </button>
          </div>

          <div className="ad-slot ad-slot-sidebar" id="ad-sidebar-mid">
            Advertisement
          </div>

          <p className="text-[10px] leading-relaxed text-neutral-400">
            Stories may include AI-assisted headlines. Always verify on the
            original publisher. FinSignal is independent coverage — not
            investment advice.
          </p>
        </aside>
      </main>

      <footer className="border-t border-neutral-200 bg-neutral-50 py-10">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 sm:flex-row sm:items-start sm:justify-between sm:px-6">
          <div>
            <p className="font-display text-xl font-bold">FinSignal</p>
            <p className="mt-1 max-w-sm text-sm text-neutral-500">
              A modern finance wire built for clarity, trust, and quality
              advertisers.
            </p>
          </div>
          <div className="text-xs text-neutral-500">
            <p>© {new Date().getFullYear()} FinSignal</p>
            <p className="mt-1">Ads labeled · Sources linked · Privacy-minded</p>
          </div>
        </div>
      </footer>

      {/* Story drawer */}
      {active ? (
        <div className="fixed inset-0 z-50 flex justify-end">
          <button
            type="button"
            className="absolute inset-0 bg-black/45"
            onClick={() => setActive(null)}
          />
          <div className="relative z-10 flex h-full w-full max-w-lg flex-col bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b px-4 py-3">
              <p className="text-[10px] font-bold tracking-wider text-neutral-500 uppercase">
                Story
              </p>
              <button
                type="button"
                className="grid size-9 place-items-center border border-neutral-200"
                onClick={() => setActive(null)}
              >
                <X className="size-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-5">
              <img
                src={active.image}
                alt=""
                className="mb-4 aspect-[16/9] w-full object-cover"
              />
              <p className="text-[11px] font-bold tracking-wider text-amber-800 uppercase">
                {active.source} · {formatRelativeTime(active.timestamp)}
              </p>
              <h2 className="font-display mt-2 text-2xl font-semibold leading-snug">
                {active.ai_hook_title || active.original_title}
              </h2>
              <ul className="mt-4 space-y-2 text-[15px] leading-relaxed text-neutral-700">
                {(active.ai_summary || []).map((b, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="mt-2 size-1.5 shrink-0 rounded-full bg-neutral-900" />
                    {b}
                  </li>
                ))}
              </ul>
              <a
                href={active.original_url}
                target="_blank"
                rel="noopener noreferrer"
                className="press mt-6 inline-flex h-12 items-center gap-2 bg-neutral-950 px-5 text-sm font-bold text-white"
              >
                Read on {active.source} <ExternalLink className="size-3.5" />
              </a>
            </div>
          </div>
        </div>
      ) : null}

      {leadOpen ? (
        <div className="fixed inset-0 z-50 grid place-items-center p-4">
          <button
            type="button"
            className="absolute inset-0 bg-black/45"
            onClick={() => setLeadOpen(false)}
          />
          <form
            onSubmit={onLeadSubmit}
            className="relative z-10 w-full max-w-md space-y-3 border border-neutral-200 bg-white p-6 shadow-xl"
          >
            <h3 className="font-display text-xl font-semibold">Advertise on FinSignal</h3>
            <p className="text-sm text-neutral-600">
              Sponsorships from ~$200/mo · Newsletter · Display inventory for Google
              Ads when eligible.
            </p>
            <input
              className="h-11 w-full border border-neutral-200 px-3 text-sm"
              placeholder="Name"
              value={leadName}
              onChange={(e) => setLeadName(e.target.value)}
            />
            <input
              className="h-11 w-full border border-neutral-200 px-3 text-sm"
              placeholder="Work email"
              value={leadEmail}
              onChange={(e) => setLeadEmail(e.target.value)}
              required
            />
            <input
              className="h-11 w-full border border-neutral-200 px-3 text-sm"
              placeholder="Company"
              value={leadCompany}
              onChange={(e) => setLeadCompany(e.target.value)}
            />
            <button
              type="submit"
              className="press h-11 w-full bg-neutral-950 text-sm font-bold text-white"
            >
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
    <div
      className={`border border-amber-200 bg-amber-50/40 ${compact ? "p-4" : "my-1 p-5"}`}
    >
      <p className="text-[10px] font-bold tracking-[0.14em] text-amber-800 uppercase">
        {offer.disclosure || "Sponsored"}
      </p>
      <p className="mt-1 text-xs font-semibold text-neutral-500">{offer.sponsorName}</p>
      <h4 className="mt-1 text-base font-bold leading-snug">{offer.headline}</h4>
      <div className="mt-3 flex items-center justify-between gap-2">
        <span className="bg-white px-2 py-0.5 text-[11px] font-bold text-neutral-800 ring-1 ring-neutral-200">
          {offer.rateHighlight}
        </span>
        <a
          href={offer.ctaUrl}
          target="_blank"
          rel="noopener noreferrer sponsored"
          className="text-xs font-bold underline-offset-2 hover:underline"
          onClick={() => void logSponsorClick(offer, placement)}
        >
          {offer.ctaText} →
        </a>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <HelmetProvider>
      <FinSignalApp />
    </HelmetProvider>
  );
}
