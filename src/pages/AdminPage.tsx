import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { Helmet } from "react-helmet-async";
import { BarChart3, Copy, DollarSign, Globe2, LogOut, Megaphone, Newspaper, Settings, Share2, ShieldCheck, Users, Search } from "lucide-react";
import RichArticleEditor from "../components/RichArticleEditor";

// Temporary thin restore — full Admin restored in follow-up if deploy broke.
// Users: if you see this page only, pull previous commit 26941e63 AdminPage.
export default function AdminPage() {
  return (
    <div className="grid min-h-dvh place-items-center bg-neutral-950 p-6 text-center text-white">
      <div className="max-w-md">
        <p className="text-[10px] font-bold tracking-[0.18em] text-amber-400 uppercase">RockBrief Admin</p>
        <h1 className="font-display mt-2 text-2xl font-semibold">Admin file was being updated</h1>
        <p className="mt-3 text-sm text-neutral-300">
          A full restore is in progress. If this message stays more than a few minutes, open GitHub and revert
          <code className="mx-1 text-amber-300">src/pages/AdminPage.tsx</code>
          to commit before PLACEHOLDER, or contact your developer.
        </p>
        <a href="/" className="mt-6 inline-block rounded-full bg-white px-4 py-2 text-sm font-bold text-neutral-950">Open site</a>
      </div>
    </div>
  );
}
