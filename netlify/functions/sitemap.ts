import { createClient } from "@supabase/supabase-js";

function env(name: string) {
  return process.env[name] || "";
}

function escapeXml(value: string) {
  return value
    .replace(/&/g, "&")
    .replace(/</g, "<")
    .replace(/>/g, ">")
    .replace(/"/g, """)
    .replace(/'/g, "'");
}

export async function handler() {
  const site = (env("PUBLIC_SITE_URL") || "https://rwdnews.netlify.app").replace(/\/$/, "");
  const url = env("SUPABASE_URL") || env("VITE_SUPABASE_URL");
  const key = env("SUPABASE_SERVICE_ROLE_KEY");
  let storyUrls: string[] = [];

  if (url && key) {
    try {
      const db = createClient(url, key);
      const { data } = await db
        .from("articles")
        .select("id,original_title,ai_hook_title,timestamp")
        .order("timestamp", { ascending: false })
        .limit(500);
      storyUrls = (data || []).map((a: any) => {
        const title = String(a.ai_hook_title || a.original_title || "")
          .toLowerCase()
          .normalize("NFKD")
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-|-$/g, "")
          .slice(0, 90);
        return site + "/news/" + title + "--" + encodeURIComponent(String(a.id));
      });
    } catch {
      storyUrls = [];
    }
  }

  const staticPaths = [
    "/",
    "/sports",
    "/sports/predictions",
    "/about",
    "/editorial",
    "/advertise",
    "/privacy",
    "/terms",
  ];
  const urls = [...staticPaths.map((p) => site + p), ...storyUrls];
  const xml =
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' +
    urls.map((u) => "<url><loc>" + escapeXml(u) + "</loc></url>").join("") +
    "</urlset>";

  return {
    statusCode: 200,
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=900, stale-while-revalidate=3600",
    },
    body: xml,
  };
}
