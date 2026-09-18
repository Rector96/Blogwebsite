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
  Zap,
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

const INITIAL_ARTICLES: EnrichedArticle[] = [
  {
    id: "news-init-1",
    original_url:
      "https://www.marketwatch.com/personal-finance/banking/high-yield-cash-sweeps",
    image:
      "https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?auto=format&fit=crop&w=1200&q=80",
    timestamp: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
    source: "MarketWatch",
    original_title: "Neobanks Shift Savings Sweep Yields to 5.15%",
    original_description: "Multi-bank custodial networks deliver elevated cash yields.",
    ai_hook_title:
      "High-yield cash sweeps hit 5.15% as fintechs compete for uninvested deposits",
    ai_summary: [
      "Cash yields have detached from near-zero legacy savings rates.",
      "Multi-bank sweeps can extend deposit insurance while keeping liquidity.",
    ],
    tags: ["#Banking", "#PersonalFinance", "#Fintech"],
    read_time: "3 min read",
  },
  {
    id: "news-init-2",
    original_url:
      "https://www.consumerfinance.gov/about-us/newsroom/cfpb-finalizes-personal-financial-data-rights/",
    image:
      "https://images.unsplash.com/photo-1559526324-4b87b5e36e44?auto=format&fit=crop&w=1200&q=80",
    timestamp: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
    source: "CFPB",
    original_title: "CFPB Rule 1033 Data Portability",
    original_description: "Open banking rules phase out screen-scraping.",
    ai_hook_title:
      "Open banking Rule 1033: secure API portability aims to end password scraping",
    ai_summary: [
      "Regulators prefer signed bank tokens over shared credentials.",
      "Budget apps connect accounts with less friction when banks comply.",
    ],
    tags: ["#Regulation", "#Fintech", "#Banking"],
    read_time: "4 min read",
  },
  {
    id: "news-init-3",
    original_url:
      "https://www.finextra.com/newsarticle/realtime-payroll-earned-wage-access",
    image:
      "https://images.unsplash.com/photo-1590283603385-17ffb3a7f29f?auto=format&fit=crop&w=1200&q=80",
    timestamp: new Date(Date.now() - 90 * 60 * 1000).toISOString(),
    source: "Finextra",
    original_title: "Real-Time Payroll and Earned Wage Access",
    original_description: "Payroll API bridges for accrued income access.",
    ai_hook_title:
      "Earned wage access expands as employers plug into real-time payroll rails",
    ai_summary: [
      "Workers can access earned pay early when products are well designed.",
      "Employer integration is the distribution channel pure apps often lack.",
    ],
    tags: ["#Payments", "#Fintech", "#PersonalFinance"],
    read_time: "3 min read",
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

function FinSignalApp() {
  const [articles, setArticles] = useState<EnrichedArticle[]>(INITIAL_ARTICLES);
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
  const [showSavedOnly, setShowSavedOnly] = useState(false);
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

  const fetchNews = async (force = false) => {
    setRefreshing(true);
    try {
      if (isSupabaseConfigured && supabase) {
        const { data, error } = await supabase
          .from("articles")
          .select("*")
          .order("timestamp", { ascending: false })
          .limit(40);
        if (!error && data && data.length > 0) {
          setArticles(data as EnrichedArticle[]);
          return;
        }
      }
      const url = force ? "/api/news?refresh=true" : "/api/news";
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        const list = Array.isArray(data) ? data : data.articles || [];
        if (list.length) setArticles(list);
      }
    } catch (e) {
      console.warn("Feed fallback", e);
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    void fetchNews(false);
  }, []);

  const tags = useMemo(() => {
    const s = new Set<string>();
    articles.forEach((a) => a.tags?.forEach((t) => s.add(t)));
    return ["All", ...Array.from(s)];
  }, [articles]);

  const filtered = useMemo(() => {
    return articles.filter((a) => {
      if (showSavedOnly && !saved.includes(a.id)) return false;
      const tagOk = selectedTag === "All" || a.tags?.includes(selectedTag);
      const q = searchQuery.trim().toLowerCase();
      if (!q) return tagOk;
      const blob = [
        a.ai_hook_title,
        a.original_title,
        a.source,
        ...(a.ai_summary || []),
        ...(a.tags || []),
      ]
        .join(" ")
        .toLowerCase();
      return tagOk && blob.includes(q);
    });
  }, [articles, selectedTag, searchQuery, showSavedOnly, saved]);

  const hero = filtered[0] ?? articles[0];
  const rest = filtered.slice(1);
  const feedSponsor = sponsors.find(
    (s) => s.placement === "in_feed" || s.placement === "both",
  );
  const sideSponsors = sponsors.filter(
    (s) => !s.placement || s.placement === "sidebar" || s.placement === "both",
  );

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
      setEmailMsg("You're on the list. Weekly brief coming soon.");
      setEmail("");
    } catch {
      setEmailMsg("Connect Supabase to store subscribers.");
    }
  };

  const onLeadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!leadEmail.includes("@")) {
      setLeadMsg("Valid work email required.");
      return;
    }
    const res = await submitSalesLead({
      email: leadEmail,
      name: leadName,
      company: leadCompany,
      message: "Media kit / sponsorship inquiry",
    });
    setLeadMsg(
      res.ok
        ? "Received — we'll reply with rates and slots."
        : "Saved — email hello@finsignal.news if you prefer.",
    );
    if (res.ok) {
      setLeadEmail("");
      setLeadName("");
      setLeadCompany("");
    }
  };

  const pageTitle = active
    ? `${active.ai_hook_title} · FinSignal`
    : "FinSignal — Markets, Fintech & Personal Finance";
  const pageDesc = active
    ? active.ai_summary?.[0] || active.original_description
    : "Global market and fintech wire. Real sources, sharp headlines, clear partner offers.";

  return (
    <div className="min-h-dvh bg-white text-neutral-950">
      <Helmet>
        <title>{pageTitle}</title>
        <meta name="description" content={pageDesc} />
        <link
          rel="canonical"
          href={
            active?.original_url ||
            (typeof window !== "undefined" ? window.location.href : "")
          }
        />
      </Helmet>

      <header className="sticky top-0 z-40 border-b border-neutral-200 bg-white/95 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-3 px-4 sm:h-16 sm:px-6">
          <div className="flex items-center gap-3">
            <button
              type="button"
              className="press grid size-9 place-items-center rounded-lg border border-neutral-200 sm:hidden"
              onClick={() => setMobileNav((v) => !v)}
            >
              {mobileNav ? <X className="size-4" /> : <Menu className="size-4" />}
            </button>
            <a href="/" className="flex items-center gap-2">
              <span className="grid size-8 place-items-center rounded-md bg-neutral-950 text-white">
                <Zap className="size-4" />
              </span>
              <div>
                <p className="text-sm font-extrabold tracking-tight sm:text-base">
                  FinSignal
                </p>
                <p className="hidden text-[10px] font-medium tracking-wide text-neutral-500 uppercase sm:block">
                  Markets · Fintech · Money
                </p>
              </div>
            </a>
          </div>
          <div className="relative hidden max-w-md flex-1 md:block">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-neutral-400" />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search markets, banks, fintech…"
              className="h-10 w-full rounded-full border border-neutral-200 bg-neutral-50 pr-4 pl-10 text-sm outline-none focus:border-teal-700 focus:ring-2 focus:ring-teal-700/15"
            />
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowSavedOnly((v) => !v)}
              className={`press hidden items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold sm:inline-flex ${
                showSavedOnly
                  ? "border-teal-800 bg-teal-50 text-teal-900"
                  : "border-neutral-200 text-neutral-700"
              }`}
            >
              <Bookmark className="size-3.5" /> Saved ({saved.length})
            </button>
            <button
              type="button"
              onClick={() => void fetchNews(true)}
              className="press inline-flex h-9 items-center gap-1.5 rounded-full bg-neutral-950 px-3 text-xs font-semibold text-white"
            >
              <RefreshCw className={`size-3.5 ${refreshing ? "animate-spin" : ""}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
          </div>
        </div>
        {mobileNav ? (
          <div className="border-t border-neutral-100 px-4 py-3 sm:hidden">
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search…"
              className="mb-2 h-10 w-full rounded-xl border border-neutral-200 px-3 text-sm"
            />
          </div>
        ) : null}
        <div className="mx-auto flex max-w-6xl gap-2 overflow-x-auto px-4 pb-3 sm:px-6">
          {tags.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setSelectedTag(t)}
              className={`press shrink-0 rounded-full px-3 py-1 text-[11px] font-semibold tracking-wide ${
                selectedTag === t
                  ? "bg-neutral-950 text-white"
                  : "bg-neutral-100 text-neutral-600"
              }`}
            >
              {t === "All" ? "Top stories" : t.replace("#", "")}
            </button>
          ))}
        </div>
      </header>

      <main className="mx-auto grid max-w-6xl gap-8 px-4 py-6 sm:px-6 lg:grid-cols-[1fr_300px] lg:py-8">
        <div className="min-w-0 space-y-8">
          {hero ? (
            <article
              className="group cursor-pointer border-b border-neutral-200 pb-8"
              onClick={() => setActive(hero)}
            >
              <div className="grid gap-5 md:grid-cols-2 md:items-center">
                <div className="overflow-hidden rounded-xl bg-neutral-100">
                  <img
                    src={hero.image}
                    alt=""
                    className="aspect-[16/10] w-full object-cover transition duration-500 group-hover:scale-[1.02]"
                  />
                </div>
                <div>
                  <p className="text-[11px] font-bold tracking-[0.14em] text-teal-800 uppercase">
                    {hero.source} · {formatRelativeTime(hero.timestamp)}
                  </p>
                  <h1 className="font-display mt-2 text-2xl leading-tight font-semibold tracking-tight sm:text-3xl">
                    {hero.ai_hook_title || hero.original_title}
                  </h1>
                  <ul className="mt-3 space-y-1.5 text-sm text-neutral-600">
                    {(hero.ai_summary || []).slice(0, 2).map((b, i) => (
                      <li key={i} className="flex gap-2">
                        <span className="mt-2 size-1 shrink-0 rounded-full bg-teal-700" />
                        <span>{b}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </article>
          ) : null}

          <section>
            <div className="mb-4 flex items-end justify-between border-b border-neutral-200 pb-2">
              <h2 className="text-xs font-bold tracking-[0.16em] text-neutral-500 uppercase">
                Latest
              </h2>
              <p className="text-[11px] text-neutral-400">{filtered.length} stories</p>
            </div>
            <div className="divide-y divide-neutral-100">
              {rest.map((a, idx) => (
                <React.Fragment key={a.id}>
                  <article
                    className="flex cursor-pointer gap-4 py-5 hover:bg-neutral-50/80"
                    onClick={() => setActive(a)}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] font-bold tracking-wider text-neutral-500 uppercase">
                        {a.source} · {formatRelativeTime(a.timestamp)}
                      </p>
                      <h3 className="font-display mt-1 text-lg font-semibold sm:text-xl">
                        {a.ai_hook_title || a.original_title}
                      </h3>
                      <p className="mt-1 line-clamp-2 text-sm text-neutral-600">
                        {a.ai_summary?.[0] || a.original_description}
                      </p>
                      <button
                        type="button"
                        className="mt-2 text-neutral-400"
                        onClick={(e) => toggleSave(a.id, e)}
                      >
                        {saved.includes(a.id) ? (
                          <BookmarkCheck className="size-3.5 text-teal-800" />
                        ) : (
                          <Bookmark className="size-3.5" />
                        )}
                      </button>
                    </div>
                    <div className="hidden w-28 shrink-0 overflow-hidden rounded-lg bg-neutral-100 sm:block sm:w-36">
                      <img
                        src={a.image}
                        alt=""
                        className="aspect-[4/3] h-full w-full object-cover"
                      />
                    </div>
                  </article>
                  {idx === 2 && feedSponsor ? (
                    <PartnerCard offer={feedSponsor} placement="in_feed" />
                  ) : null}
                </React.Fragment>
              ))}
            </div>
          </section>
        </div>

        <aside className="space-y-6 lg:sticky lg:top-24 lg:self-start">
          <div className="rounded-2xl border border-neutral-200 bg-neutral-950 p-5 text-white">
            <p className="text-[10px] font-bold tracking-[0.18em] text-teal-300 uppercase">
              Weekly brief
            </p>
            <h3 className="font-display mt-2 text-xl font-semibold">
              Signal in your inbox
            </h3>
            <form onSubmit={submitNewsletter} className="mt-4 space-y-2">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@email.com"
                className="h-11 w-full rounded-xl border border-neutral-700 bg-neutral-900 px-3 text-sm text-white outline-none"
              />
              <button
                type="submit"
                className="press h-11 w-full rounded-xl bg-teal-600 text-sm font-bold text-white"
              >
                Subscribe free
              </button>
            </form>
            {emailMsg ? (
              <p className="mt-2 text-xs text-teal-200">{emailMsg}</p>
            ) : null}
          </div>

          {sideSponsors.map((o) => (
            <PartnerCard key={o.id} offer={o} placement="sidebar" compact />
          ))}

          <div className="rounded-2xl border border-neutral-200 p-4">
            <p className="text-[10px] font-bold tracking-wider text-neutral-500 uppercase">
              Advertise · $200–400 / slot
            </p>
            <p className="mt-1 text-sm font-semibold">
              Reach readers who care about money products
            </p>
            <button
              type="button"
              onClick={() => setLeadOpen(true)}
              className="mt-3 text-xs font-bold text-teal-800 underline-offset-2 hover:underline"
            >
              Request media kit →
            </button>
          </div>

          <p className="text-[10px] leading-relaxed text-neutral-400">
            Headlines may be AI-assisted. Verify on the original publisher. Not
            investment advice.
          </p>
        </aside>
      </main>

      {active ? (
        <div className="fixed inset-0 z-50 flex justify-end">
          <button
            type="button"
            className="absolute inset-0 bg-black/40"
            onClick={() => setActive(null)}
          />
          <div className="relative z-10 flex h-full w-full max-w-lg flex-col bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b px-4 py-3">
              <p className="text-[10px] font-bold tracking-wider text-neutral-500 uppercase">
                Briefing
              </p>
              <button
                type="button"
                className="grid size-9 place-items-center rounded-lg border"
                onClick={() => setActive(null)}
              >
                <X className="size-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-5">
              <img
                src={active.image}
                alt=""
                className="mb-4 aspect-[16/9] w-full rounded-xl object-cover"
              />
              <p className="text-[11px] font-bold tracking-wider text-teal-800 uppercase">
                {active.source} · {formatRelativeTime(active.timestamp)}
              </p>
              <h2 className="font-display mt-2 text-2xl font-semibold">
                {active.ai_hook_title || active.original_title}
              </h2>
              <ul className="mt-4 space-y-2 text-sm text-neutral-700">
                {(active.ai_summary || []).map((b, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="mt-2 size-1.5 shrink-0 rounded-full bg-teal-700" />
                    {b}
                  </li>
                ))}
              </ul>
              <a
                href={active.original_url}
                target="_blank"
                rel="noopener noreferrer"
                className="press mt-6 inline-flex h-11 items-center gap-2 rounded-xl bg-neutral-950 px-4 text-sm font-bold text-white"
              >
                Read full story <ExternalLink className="size-3.5" />
              </a>
            </div>
          </div>
        </div>
      ) : null}

      {leadOpen ? (
        <div className="fixed inset-0 z-50 grid place-items-center p-4">
          <button
            type="button"
            className="absolute inset-0 bg-black/40"
            onClick={() => setLeadOpen(false)}
          />
          <form
            onSubmit={onLeadSubmit}
            className="relative z-10 w-full max-w-md space-y-3 rounded-2xl bg-white p-6 shadow-xl"
          >
            <h3 className="text-lg font-bold">Media kit / sponsorship</h3>
            <p className="text-sm text-neutral-600">
              Sidebar ~$200–300 · In-feed ~$250–400 · Newsletter mention available.
            </p>
            <input
              className="h-11 w-full rounded-xl border px-3 text-sm"
              placeholder="Name"
              value={leadName}
              onChange={(e) => setLeadName(e.target.value)}
            />
            <input
              className="h-11 w-full rounded-xl border px-3 text-sm"
              placeholder="Work email"
              value={leadEmail}
              onChange={(e) => setLeadEmail(e.target.value)}
              required
            />
            <input
              className="h-11 w-full rounded-xl border px-3 text-sm"
              placeholder="Company"
              value={leadCompany}
              onChange={(e) => setLeadCompany(e.target.value)}
            />
            <button
              type="submit"
              className="press h-11 w-full rounded-xl bg-neutral-950 text-sm font-bold text-white"
            >
              Send inquiry
            </button>
            {leadMsg ? (
              <p className="text-xs text-teal-800">{leadMsg}</p>
            ) : null}
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
      className={`rounded-2xl border border-amber-200/80 bg-amber-50/50 ${compact ? "p-4" : "my-2 p-5"}`}
    >
      <p className="text-[10px] font-bold tracking-[0.14em] text-amber-800 uppercase">
        {offer.disclosure}
      </p>
      <p className="mt-1 text-xs font-semibold text-neutral-500">
        {offer.sponsorName}
      </p>
      <h4 className="mt-1 text-base font-bold">{offer.headline}</h4>
      {!compact && offer.whyMatters?.length ? (
        <ul className="mt-2 space-y-1 text-sm text-neutral-600">
          {offer.whyMatters.map((w, i) => (
            <li key={i}>· {w}</li>
          ))}
        </ul>
      ) : null}
      <div className="mt-3 flex items-center justify-between gap-2">
        <span className="rounded-full bg-white px-2.5 py-0.5 text-[11px] font-bold text-teal-900 ring-1 ring-neutral-200">
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
