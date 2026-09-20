import { Helmet } from "react-helmet-async";
import { AdminSubmissions } from "../components/AdminSubmissions";

/**
 * Standalone admin review desk for /submit stories.
 * Open from the main admin (or /admin/submissions) after signing in on /admin once.
 */
export default function AdminSubmissionsPage() {
  return (
    <div className="min-h-dvh bg-neutral-100 text-neutral-950">
      <Helmet>
        <title>Submissions — RWDNEWS Admin</title>
        <meta name="robots" content="noindex,nofollow" />
      </Helmet>
      <header className="border-b bg-neutral-950 text-white">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-4">
          <div>
            <p className="text-[10px] font-bold tracking-[0.16em] text-amber-400 uppercase">
              Private operations
            </p>
            <h1 className="font-display text-xl font-semibold">Review submissions</h1>
          </div>
          <div className="flex gap-2 text-xs font-semibold">
            <a href="/admin" className="border border-neutral-700 px-3 py-2">
              Full admin
            </a>
            <a href="/" className="border border-neutral-700 px-3 py-2 text-amber-400">
              Open site
            </a>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-4xl px-4 py-8">
        <AdminSubmissions />
      </main>
    </div>
  );
}
