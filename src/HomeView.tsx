import React from "react";
import { Helmet } from "react-helmet-async";
import { Bookmark, BookmarkCheck, ChevronLeft, ChevronRight, RefreshCw, Search } from "lucide-react";
import { ArticleReader } from "./components/ArticleReader";
import { AdSlot } from "./components/AdSlot";
import { SiteFooter } from "./components/SiteFooter";
import { LanguageSwitcher } from "./components/LanguageSwitcher";
import type { EnrichedArticle } from "./AppHome";

/** Insert an ad cell after every N story cards in the grid. */
const categoryMeta: Record<string, { title: string; description: string }> = {
  All: { title: "RockBrief — Global News, Briefed Clearly", description: "Source-backed global news briefings across world affairs, business, technology, sports, Africa and more." },
  World: { title: "World News — RockBrief", description: "Latest source-backed world news, international affairs and major global developments, briefed clearly by RockBrief." },
  Africa: { title: "Africa News — RockBrief", description: "Source-backed Africa news, regional developments, business, technology, culture and major stories from across the continent." },
  Nigeria: { title: "Nigeria News — RockBrief", description: "Latest source-backed Nigeria news, business, technology, society and major developments, briefed clearly." },
  Business: { title: "Business News — RockBrief", description: "Latest source-backed business, markets, companies, finance, trade and economic news from around the world." },
  Tech: { title: "Technology News — RockBrief", description: "Latest source-backed technology news covering AI, software, cybersecurity, chips, startups and digital innovation." },
  Crypto: { title: "Crypto News — RockBrief", description: "Latest source-backed cryptocurrency, blockchain, Bitcoin, Ethereum and digital finance news, briefed clearly." },
  Entertainment: { title: "Entertainment News — RockBrief", description: "Latest source-backed entertainment, film, music, celebrities and culture news from around the world." },
  Sports: { title: "Sports News — RockBrief", description: "Latest source-backed sports news, football, basketball, tennis, motorsport and major sporting developments." },
};

function withFeedAds(items: EnrichedArticle[], every = 5) {
  const out: Array<{ type: "story"; item: EnrichedArticle } | { type: "ad"; key: string }> = [];
  items.forEach((item, i) => {
    out.push({ type: "story", item });
    if ((i + 1) % every === 0) {
      out.push({ type: "ad", key: `feed-ad-${i}` });
    }
  });
  return out;
}

export function HomeView({
  emptyForTab,
  displayList,
  hero,
  heroStories,
  heroIndex,
  setHeroIndex,
  secondary,
  rest,
  sportsCards,
  sportsLoading,
  selectedTag,
  setSelectedTag,
  searchQuery,
  setSearchQuery,
  tags,
  recommended,
  sponsors,
  saved,
  toggleSave,
  openArticle,
  openAdvertiserForm,
  fetchNews,
  refreshing,
  feedSource,
  email,
  setEmail,
  emailMsg,
  submitNewsletter,
  leadOpen,
  setLeadOpen,
  leadName,
  setLeadName,
  leadEmail,
  setLeadEmail,
  leadCompany,
  setLeadCompany,
  leadMsg,
  onLeadSubmit,
  active,
  setActive,
  carouselPaused,
  setCarouselPaused,
  formatRelativeTime,
  todayLabel,
  storyPath,
  normalizeTags,
}: any) {
  const feedCells = withFeedAds(Array.isArray(rest) ? rest : [], 5);
  const meta = categoryMeta[selectedTag] || categoryMeta.All;
  const canonicalPath = selectedTag === "All" ? "/" : selectedTag === "Sports" ? "/sport" : `/${String(selectedTag).toLowerCase()}`;
  const canonicalUrl = typeof window !== "undefined" ? `${window.location.origin}${canonicalPath}` : canonicalPath;

  return (
    <div className="min-h-dvh bg-white text-neutral-950">
      <Helmet>
        <title>{meta.title}</title>
        <meta name="description" content={meta.description} />
        <meta name="robots" content="index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1" />
        <link rel="canonical" href={canonicalUrl} />
        <meta property="og:title" content={meta.title} />
        <meta property="og:description" content={meta.description} />
        <meta property="og:type" content="website" />
        <meta property="og:site_name" content="RockBrief" />
        <meta property="og:url" content={canonicalUrl} />
      </Helmet>

      <div className="border-b border-neutral-200 bg-neutral-950 text-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-2 px-3 py-1.5 text-[11px] sm:px-6">
          <span className="truncate font-medium tracking-wide text-neutral-300">{todayLabel()}</span>
          <span className="hidden text-neutral-400 md:inline">
            {feedSource === "live" ? "Live global wire · Sources credited" : "Reconnecting to the wire"}
          </span>
          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            <a href="/sport" className="font-semibold text-teal-300 hover:text-white">
              Sports
            </a>
            <button type="button" onClick={openAdvertiserForm} className="hidden font-semibold text-amber-400 sm:inline">
              Advertise
            </button>
          </div>
        </div>
      </div>

      <header className="sticky top-0 z-30 border-b border-neutral-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-2 px-3 py-3 sm:gap-3 sm:px-6 sm:py-4">
          <a href="/" className="block min-w-0 shrink" aria-label="RockBrief home">
            <img
              src="/rwdnews-logo.svg"
              alt="RockBrief"
              className="h-auto w-[150px] sm:w-[220px] md:w-[275px]"
            />
          </a>
          <div className="flex items-center gap-1.5 sm:gap-2">
            <div className="relative hidden md:block">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-neutral-400" />
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search"
                className="h-9 w-40 rounded-full border border-neutral-200 bg-neutral-50 pr-3 pl-9 text-sm outline-none lg:w-52"
              />
            </div>
            <LanguageSwitcher />
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

        <p className="border-t border-neutral-100 bg-neutral-50/80 px-3 py-1.5 text-center text-[10px] font-semibold tracking-wide text-neutral-500 sm:text-[11px]">
          Global news, briefed clearly · Sources always credited
        </p>

        <div className="border-t border-neutral-100 bg-neutral-50/70">
          <div className="mx-auto max-w-6xl px-3 py-2 sm:px-6">
            <div className="flex min-w-0 gap-1.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {tags.map((t: string) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => {
                    setSelectedTag(t);
                    const target =
                      t === "All" ? "/" : t === "Sports" ? "/sport" : `/${t.toLowerCase()}`;
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
            <p className="mt-1.5 text-[10px] text-neutral-400">
              {selectedTag === "All"
                ? `${displayList.length} stories · global desk`
                : `${displayList.length} ${selectedTag} stories`}
            </p>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-3 py-3 sm:px-6">
        <AdSlot slot="leaderboard" variant="inline" label="Advertisement" className="min-h-[90px]" />
      </div>

      <main className="mx-auto max-w-6xl px-3 pb-12 sm:px-6">
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
              <a
                href={storyPath(hero)}
                onClick={(e: React.MouseEvent) => {
                  e.preventDefault();
                  openArticle(hero);
                }}
                className="group block cursor-pointer lg:col-span-7"
              >
                <div className="overflow-hidden bg-neutral-100">
                  {hero.image ? (
                    <img
                      src={hero.image}
                      alt={hero.ai_hook_title || hero.original_title || "RockBrief news"}
                      className="aspect-[16/10] w-full object-cover transition duration-500 group-hover:scale-[1.02]"
                      loading="eager"
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
                <h1 className="font-display mt-1 text-xl leading-[1.15] font-semibold sm:text-3xl">
                  {hero.ai_hook_title || hero.original_title}
                </h1>
              </a>

              <div className="space-y-4 lg:col-span-5">
                {secondary.map((a: EnrichedArticle) => (
                  <a
                    key={a.id}
                    href={storyPath(a)}
                    onClick={(e: React.MouseEvent) => {
                      e.preventDefault();
                      openArticle(a);
                    }}
                    className="group flex gap-3 border-b border-neutral-100 pb-4"
                  >
                    {a.image ? (
                      <img src={a.image} alt={a.ai_hook_title || a.original_title || "RockBrief news"} className="size-16 shrink-0 object-cover sm:size-20" loading="lazy" />
                    ) : null}
                    <div className="min-w-0">
                      <p className="text-[10px] font-bold tracking-wider text-amber-800 uppercase">
                        {a.category || a.source}
                      </p>
                      <h2 className="font-display mt-0.5 text-sm font-semibold leading-snug group-hover:text-teal-800 sm:text-base">
                        {a.ai_hook_title || a.original_title}
                      </h2>
                    </div>
                  </a>
                ))}
              </div>
            </div>

            {heroStories.length > 1 ? (
              <div className="mt-4 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setHeroIndex((i: number) => (i - 1 + heroStories.length) % heroStories.length)}
                  className="grid size-8 place-items-center border border-neutral-200"
                >
                  <ChevronLeft className="size-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setHeroIndex((i: number) => (i + 1) % heroStories.length)}
                  className="grid size-8 place-items-center border border-neutral-200"
                >
                  <ChevronRight className="size-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setCarouselPaused((v: boolean) => !v)}
                  className="text-xs font-semibold text-neutral-500"
                >
                  {carouselPaused ? "Play" : "Pause"}
                </button>
              </div>
            ) : null}
          </section>
        ) : null}

        <div className="my-6">
          <AdSlot slot="mid_home" variant="inline" label="Advertisement" className="min-h-[100px]" />
        </div>

        <section className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {feedCells.map((cell) =>
            cell.type === "ad" ? (
              <div key={cell.key} className="col-span-full sm:col-span-2 lg:col-span-3">
                <AdSlot slot="in_feed" variant="feed" label="Advertisement" className="min-h-[100px]" />
              </div>
            ) : (
              <a
                key={cell.item.id}
                href={storyPath(cell.item)}
                onClick={(e: React.MouseEvent) => {
                  e.preventDefault();
                  openArticle(cell.item);
                }}
                className="group overflow-hidden border border-neutral-200 bg-white transition hover:border-teal-300"
              >
                {cell.item.image ? (
                  <img
                    src={cell.item.image}
                    alt={cell.item.ai_hook_title || cell.item.original_title || "RockBrief news"}
                    className="aspect-[16/9] w-full object-cover"
                    loading="lazy"
                  />
                ) : null}
                <div className="p-3 sm:p-4">
                  <p className="text-[10px] font-bold tracking-wider text-amber-800 uppercase">
                    {cell.item.category || cell.item.source} · {formatRelativeTime(cell.item.timestamp)}
                  </p>
                  <h2 className="font-display mt-1 text-base font-semibold leading-snug group-hover:text-teal-800 sm:text-lg">
                    {cell.item.ai_hook_title || cell.item.original_title}
                  </h2>
                  <button
                    type="button"
                    className="mt-2 text-neutral-400"
                    onClick={(e) => toggleSave(cell.item.id, e)}
                    aria-label="Save"
                  >
                    {saved.includes(cell.item.id) ? (
                      <BookmarkCheck className="size-4 text-teal-800" />
                    ) : (
                      <Bookmark className="size-4" />
                    )}
                  </button>
                </div>
              </a>
            ),
          )}
        </section>

        {recommended?.length ? (
          <section className="mt-12">
            <h2 className="font-display text-xl font-semibold sm:text-2xl">Recommended</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {recommended.map((a: EnrichedArticle) => (
                <a
                  key={a.id}
                  href={storyPath(a)}
                  onClick={(e: React.MouseEvent) => {
                    e.preventDefault();
                    openArticle(a);
                  }}
                  className="border border-neutral-200 p-3 hover:border-teal-300"
                >
                  <p className="text-[10px] font-bold text-amber-800 uppercase">{a.category}</p>
                  <h3 className="font-display mt-1 font-semibold">{a.ai_hook_title || a.original_title}</h3>
                </a>
              ))}
            </div>
          </section>
        ) : null}

        <form onSubmit={submitNewsletter} className="mt-12 border border-neutral-200 bg-neutral-50 p-5 sm:p-6">
          <h2 className="font-display text-lg font-semibold sm:text-xl">Get the RockBrief briefing</h2>
          <p className="mt-1 text-xs text-neutral-500">Global headlines, short and clear — in your inbox.</p>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email address"
              className="h-11 flex-1 border border-neutral-200 px-3 text-sm"
            />
            <button type="submit" className="h-11 bg-neutral-950 px-5 text-xs font-bold text-white">
              Subscribe
            </button>
          </div>
          {emailMsg ? <p className="mt-2 text-xs text-teal-800">{emailMsg}</p> : null}
        </form>
      </main>

      <SiteFooter />

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
            <h3 className="font-display text-xl font-semibold">Advertise on RockBrief</h3>
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
