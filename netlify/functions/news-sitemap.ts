import { createClient } from "@supabase/supabase-js";

function env(name: string) {
  return process.env[name] || "";
}

function escapeXml(value: string) {
  return String(value || "")
    .split("&").join("&amp;")
    .split("<").join("&lt;")
    .split(">").join("&gt;")
    .split('"').join("&quot;")
    .split("'").join("&apos;");
}

function slugFor(title: string) {
  return String(title || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 90);
}

export async function handler() {
  const site = (env("PUBLIC_SITE_URL") || "https://rwdnews.netlify.app").replace(/\/$/, "");
  const url = env("SUPABASE_URL") || env("VITE_SUPABASE_URL");
  const key = env("SUPABASE_SERVICE_ROLE_KEY");
  const cutoff = Date.now() - 48 * 60 * 60 * 1000;

  let articles: any[] = [];
  if (url && key) {
    try {
      const db = createClient(url, key);
      const { data } = await db
        .from("articles")
        .select("id,original_title,ai_hook_title,timestamp,category,editorial_status,original_description")
        .eq("editorial_status", "published")
        .gte("timestamp", new Date(cutoff).toISOString())
        .order("timestamp", { ascending: false })
        .limit(1000);
      articles = Array.isArray(data) ? data : [];
    } catch {
      articles = [];
    }
  }

  const body =
    '<?xml version="1.0" encoding="UTF-8"?>' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" ' +
    'xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">' +
    articles
      .filter((article) => article?.timestamp && !Number.isNaN(new Date(article.timestamp).getTime()))
      .filter((article) => String(article?.original_description || "").replace(/<[^>]*>/g, " ").trim().length >= 40)
      .map((article) => {
        const title = String(article.ai_hook_title || article.original_title || "").trim();
        const publicationDate = new Date(article.timestamp).toISOString();
        const url = site + "/news/" + slugFor(title) + "--" + encodeURIComponent(String(article.id));
        return (
          "<url><loc>" + escapeXml(url) + "</loc>" +
          "<news:news><news:publication>" +
          "<news:name>RWDNEWS</news:name><news:language>en</news:language>" +
          "</news:publication>" +
          "<news:publication_date>" + escapeXml(publicationDate) + "</news:publication_date>" +
          "<news:title>" + escapeXml(title) + "</news:title>" +
          "</news:news></url>"
        );
      })
      .join("") +
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
