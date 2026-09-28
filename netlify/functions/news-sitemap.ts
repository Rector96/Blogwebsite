import { createClient } from "@supabase/supabase-js";

function escapeXml(value: string) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function siteFrom(event: any) {
  const host = String(event?.headers?.host || "").split(":")[0];
  const forwarded = String(event?.headers?.["x-forwarded-proto"] || "https").split(",")[0];
  return (process.env.PUBLIC_SITE_URL || (host ? forwarded + "://" + host : "https://rwdnews.netlify.app")).replace(/\/$/, "");
}

export async function handler(event: any) {
  const site = siteFrom(event);
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || "";
  const cutoff = Date.now() - 48 * 60 * 60 * 1000;
  let stories: any[] = [];

  if (url && key) {
    try {
      const db = createClient(url, key);
      const { data } = await db
        .from("articles")
        .select("id,original_title,ai_hook_title,timestamp,updated_at")
        .eq("editorial_status", "published")
        .gte("timestamp", new Date(cutoff).toISOString())
        .order("timestamp", { ascending: false })
        .limit(1000);
      stories = data || [];
    } catch {
      stories = [];
    }
  }

  const urls = stories.map((article) => {
    const title = String(article.ai_hook_title || article.original_title || "")
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 90);
    const id = String(article.id || "");
    const publishedTime = Date.parse(String(article.timestamp || ""));
    if (!title || !id || !Number.isFinite(publishedTime)) return "";
    const loc = site + "/news/" + title + "--" + encodeURIComponent(id);
    const published = new Date(publishedTime).toISOString();
    return "<url><loc>" + escapeXml(loc) + "</loc><news:news><news:publication><news:name>RockBrief</news:name><news:language>en</news:language></news:publication><news:publication_date>" + escapeXml(published) + "</news:publication_date><news:title>" + escapeXml(String(article.ai_hook_title || article.original_title || "")) + "</news:title></news:news></url>";
  }).filter(Boolean).join("");

  const body = "<?xml version=\"1.0\" encoding=\"UTF-8\"?>" +
    "<urlset xmlns=\"http://www.sitemaps.org/schemas/sitemap/0.9\" xmlns:news=\"http://www.google.com/schemas/sitemap-news/0.9\">" +
    urls +
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
