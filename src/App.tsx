import React from "react";
import { HelmetProvider } from "react-helmet-async";
import AdminPage from "./pages/AdminPage";
import { InfoPage } from "./pages/InfoPage";
import StoryPage from "./pages/StoryPage";
import SportsPage from "./pages/SportsPage";
import PredictionsPage from "./pages/PredictionsPage";
import SubmitPage from "./pages/SubmitPage";

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
  region?: string;
  body?: string;
  story_type?: string;
}

function Home() {
  // Temporary shell while full homepage module is restored
  React.useEffect(() => {
    void fetch("/api/news")
      .then((r) => r.json())
      .then((d) => {
        const a = Array.isArray(d.articles) ? d.articles[0] : null;
        if (a?.id) {
          const title = String(a.ai_hook_title || a.original_title || "story")
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-|-$/g, "")
            .slice(0, 90);
          // keep user on home; list links below
        }
      })
      .catch(() => {});
  }, []);

  const [items, setItems] = React.useState<EnrichedArticle[]>([]);
  React.useEffect(() => {
    void fetch("/api/news")
      .then((r) => r.json())
      .then((d) => setItems(Array.isArray(d.articles) ? d.articles : []))
      .catch(() => setItems([]));
  }, []);

  const pathFor = (a: EnrichedArticle) => {
    const title = String(a.ai_hook_title || a.original_title || "story")
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 90);
    try {
      sessionStorage.setItem("rwdnews_pending_story", JSON.stringify(a));
      sessionStorage.setItem("rwdnews_pending_story_id", a.id);
    } catch {}
    return "/news/" + title + "--" + encodeURIComponent(a.id);
  };

  return (
    <div className="min-h-dvh bg-white text-neutral-950">
      <header className="border-b px-4 py-4">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <a href="/">
            <img src="/rwdnews-logo.svg" alt="RWDNEWS" className="w-[180px]" />
          </a>
          <div className="flex gap-3 text-xs font-bold">
            <a href="/sport" className="text-teal-800">
              Sports
            </a>
            <a href="/submit" className="text-amber-800">
              Submit
            </a>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8">
        <p className="text-[10px] font-extrabold tracking-[0.16em] text-amber-800 uppercase">
          Live wire
        </p>
        <h1 className="font-display mt-2 text-3xl font-semibold">Latest on RWDNEWS</h1>
        <p className="mt-2 text-sm text-neutral-600">
          Summaries in one place. Sources credited. Tap a headline to read on RWDNEWS.
        </p>
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {items.map((a) => (
            <a
              key={a.id}
              href={pathFor(a)}
              className="block overflow-hidden rounded-xl border border-neutral-200 bg-white transition hover:border-teal-300"
            >
              {a.image ? (
                <img src={a.image} alt="" className="aspect-[16/9] w-full object-cover" />
              ) : null}
              <div className="p-4">
                <p className="text-[10px] font-bold tracking-wider text-amber-800 uppercase">
                  {a.category || "News"} · {a.source}
                </p>
                <h2 className="font-display mt-1 text-lg font-semibold leading-snug">
                  {a.ai_hook_title || a.original_title}
                </h2>
              </div>
            </a>
          ))}
        </div>
        {!items.length ? (
          <p className="mt-8 text-sm text-neutral-500">Loading stories…</p>
        ) : null}
      </main>
    </div>
  );
}

export default function App() {
  const path = typeof window !== "undefined" ? window.location.pathname : "/";
  let page: React.ReactNode = <Home />;
  if (path.startsWith("/admin")) page = <AdminPage />;
  else if (path.startsWith("/news/")) page = <StoryPage />;
  else if (path === "/submit") page = <SubmitPage />;
  else if (path === "/sport/predictions" || path.startsWith("/sport/predictions/"))
    page = <PredictionsPage />;
  else if (path === "/sport" || path.startsWith("/sport/")) page = <SportsPage />;
  else if (["/about", "/editorial", "/privacy", "/terms", "/advertise"].includes(path))
    page = <InfoPage path={path} />;
  return <HelmetProvider>{page}</HelmetProvider>;
}
