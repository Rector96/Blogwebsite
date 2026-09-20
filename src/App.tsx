import React from "react";
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
  return <HelmetProvider>{page}</HelmetProvider>;
}
