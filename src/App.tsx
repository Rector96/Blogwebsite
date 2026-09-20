import React, { useEffect, useState } from "react";
import { ArrowUp } from "lucide-react";
import { HelmetProvider } from "react-helmet-async";
import AdminPage from "./pages/AdminPage";
import AdminSubmissionsPage from "./pages/AdminSubmissionsPage";
import { InfoPage } from "./pages/InfoPage";
import StoryPage from "./pages/StoryPage";
import SportsPage from "./pages/SportsPage";
import PredictionsPage from "./pages/PredictionsPage";
import SubmitPage from "./pages/SubmitPage";
import RwdNewsApp from "./AppHome";

export type { EnrichedArticle } from "./AppHome";

function ScrollToTopButton() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 420);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  if (!visible) return null;

  return (
    <button
      type="button"
      aria-label="Back to top"
      title="Back to top"
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      className="fixed bottom-5 right-4 z-[70] grid size-12 place-items-center rounded-full border border-white/20 bg-[#071a2d] text-white shadow-xl transition hover:-translate-y-0.5 hover:bg-[#0f766e] focus:outline-none focus:ring-2 focus:ring-amber-400 sm:bottom-7 sm:right-7"
    >
      <ArrowUp className="size-5" />
    </button>
  );
}

export default function App() {
  const path = typeof window !== "undefined" ? window.location.pathname : "/";
  let page: React.ReactNode = <RwdNewsApp />;
  if (path === "/admin/submissions" || path.startsWith("/admin/submissions/"))
    page = <AdminSubmissionsPage />;
  else if (path.startsWith("/admin")) page = <AdminPage />;
  else if (path.startsWith("/news/")) page = <StoryPage />;
  else if (path === "/submit") page = <SubmitPage />;
  else if (path === "/sport/predictions" || path.startsWith("/sport/predictions/"))
    page = <PredictionsPage />;
  else if (path === "/sport" || path.startsWith("/sport/")) page = <SportsPage />;
  else if (["/about", "/editorial", "/privacy", "/terms", "/advertise"].includes(path))
    page = <InfoPage path={path} />;
  return <HelmetProvider>{page}<ScrollToTopButton /></HelmetProvider>;
}
