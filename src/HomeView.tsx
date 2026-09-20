import React from "react";
import { Helmet } from "react-helmet-async";
import { Bookmark, BookmarkCheck, ChevronLeft, ChevronRight, RefreshCw, Search } from "lucide-react";
import { ArticleReader } from "./components/ArticleReader";
import { AdSlot } from "./components/AdSlot";
import { SiteFooter } from "./components/SiteFooter";
import type { EnrichedArticle } from "./AppHome";

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
  return (
    <div className="min-h-dvh bg-white text-neutral-950">
      <Helmet>
        <title>RWDNEWS — Global News, Trends & Briefings</title>
        <meta
          name="description"
          content="RWDNEWS brings the global wire into one place — clear summaries, sources credited."
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
            <img src="/rwdnews-logo.svg" alt="RWDNEWS" className="h-auto w-[205px] sm:w-[275px]" />
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
            <p className="mt-2 text-[10px] text-neutral-400">
              {selectedTag === "All"
                ? `${displayList.length} stories · all topics`
                : `${displayList.length} ${selectedTag} stories only`}
            </p>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-4 py-3 sm:px-6">
        <AdSlot slot="leaderboard" />
      </div>

      <main className="mx-auto max-w-6xl px-4 pb-12 sm:px-6">
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
                      <img src={a.image} alt="" className="size-20 shrink-0 object-cover" />
                    ) : null}
                    <div>
                      <p className="text-[10px] font-bold tracking-wider text-amber-800 uppercase">
                        {a.category || a.source}
                      </p>
                      <h2 className="font-display mt-0.5 text-base font-semibold leading-snug group-hover:text-teal-800">
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

        <section className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {rest.map((a: EnrichedArticle) => (
            <a
              key={a.id}
              href={storyPath(a)}
              onClick={(e: React.MouseEvent) => {
                e.preventDefault();
                openArticle(a);
              }}
              className="group overflow-hidden border border-neutral-200 bg-white transition hover:border-teal-300"
            >
              {a.image ? (
                <img src={a.image} alt="" className="aspect-[16/9] w-full object-cover" />
              ) : null}
              <div className="p-4">
                <p className="text-[10px] font-bold tracking-wider text-amber-800 uppercase">
                  {a.category || a.source} · {formatRelativeTime(a.timestamp)}
                </p>
                <h2 className="font-display mt-1 text-lg font-semibold leading-snug group-hover:text-teal-800">
                  {a.ai_hook_title || a.original_title}
                </h2>
                <button
                  type="button"
                  className="mt-2 text-neutral-400"
                  onClick={(e) => toggleSave(a.id, e)}
                  aria-label="Save"
                >
                  {saved.includes(a.id) ? (
                    <BookmarkCheck className="size-4 text-teal-800" />
                  ) : (
                    <Bookmark className="size-4" />
                  )}
                </button>
              </div>
            </a>
          ))}
        </section>

        {recommended?.length ? (
          <section className="mt-12">
            <h2 className="font-display text-2xl font-semibold">Recommended</h2>
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

        <form onSubmit={submitNewsletter} className="mt-12 border border-neutral-200 bg-neutral-50 p-6">
          <h2 className="font-display text-xl font-semibold">Get the RWDNEWS briefing</h2>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email"
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
