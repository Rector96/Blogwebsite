import { createClient } from "@supabase/supabase-js";

function env(name: string) {
  return process.env[name] || "";
}

function escapeXml(value: string) {
  // Split/join avoids entity corruption during tooling/deploy
  return value
    .split("&").join("&" + "amp;")
    .split("<").join("&" + "lt;")
    .split(">").join("&" + "gt;")
    .split('"').join("&" + "quot;")
    .split("'").join("&" + "apos;");
}

export async function handler() {
  const site = (env("PUBLIC_SITE_URL") || "https://rwdnews.netlify.app").replace(/\/$/, "");
  const url = env("SUPABASE_URL") || env("VITE_SUPABASE_URL");
  const key = env("SUPABASE_SERVICE_ROLE_KEY");
  let storyUrls: Array<{ url: string; lastmod: string }> = [];

  if (url && key) {
    try {
      const db = createClient(url, key);
      const { data } = await db
        .from("articles")
        .select("id,original_title,ai_hook_title,timestamp")
        .order("timestamp", { ascending: false })
        .limit(5000);
      storyUrls = (data || []).map((a: any) => {
        const title = String(a.ai_hook_title || a.original_title || "")
          .toLowerCase()
          .normalize("NFKD")
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-|-$/g, "")
          .slice(0, 90);
        const parsed = Date.parse(String(a.timestamp || ""));
        return {
          url: site + "/news/" + title + "--" + encodeURIComponent(String(a.id)),
          lastmod: Number.isFinite(parsed) ? new Date(parsed).toISOString() : "",
        };
      });
    } catch {
      storyUrls = [];
    }
  }

  const staticPaths = [
    "/",
    "/sport",
    "/sport/live",
    "/sport/fixtures",
    "/sport/results",
    "/sport/predictions",
    "/tech",
    "/business",
    "/crypto",
    "/nigeria",
    "/africa",
    "/world",
    "/entertainment",
    "/about",
    "/editorial",
    "/advertise",
    "/privacy",
    "/terms",
  ];
  const urls = [
    ...staticPaths.map((p) => ({ url: site + p, lastmod: "" })),
    ...storyUrls,
  ];
  const body =
    "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n" +
    "<urlset xmlns=\"http://www.sitemaps.org/schemas/sitemap/0.9\">" +
    urls.map((u) => "<url><loc>" + escapeXml(u.url) + "</loc>" + (u.lastmod ? "<lastmod>" + escapeXml(u.lastmod) + "</lastmod>" : "") + "</url>").join("") +
    "</urlset>";

  return {
    statusCode: 200,
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=900, stale-while-revalidate=3600",
    },
    body,
  };
}
