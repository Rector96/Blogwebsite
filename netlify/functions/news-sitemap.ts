import { createClient } from "@supabase/supabase-js";
import type { Config, Context } from "@netlify/functions";
import { runIngest } from "./news";

function env(name: string) {
  return Netlify.env.get(name) || "";
}

function escapeXml(value: string) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function slugify(value: string) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 90);
}

function getSite(request: Request) {
  const configured = env("PUBLIC_SITE_URL").replace(/\/$/, "");
  if (configured) return configured;
  return new URL(request.url).origin;
}

function xmlFor(stories: Array<Record<string, unknown>>, site: string) {
  const urls = stories
    .map((article) => {
      const title = String(article.ai_hook_title || article.original_title || "");
      const slug = slugify(title);
      const id = String(article.id || "");
      const publishedTime = Date.parse(String(article.timestamp || ""));
      if (!slug || !id || !Number.isFinite(publishedTime)) return "";

      const loc = site + "/news/" + slug + "--" + encodeURIComponent(id);
      const published = new Date(publishedTime).toISOString();

      return [
        "<url>",
        "<loc>" + escapeXml(loc) + "</loc>",
        "<news:news>",
        "<news:publication>",
        "<news:name>RockBrief</news:name>",
        "<news:language>en</news:language>",
        "</news:publication>",
        "<news:publication_date>" + escapeXml(published) + "</news:publication_date>",
        "<news:title>" + escapeXml(title) + "</news:title>",
        "</news:news>",
        "</url>",
      ].join("");
    })
    .filter(Boolean)
    .join("");

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">',
    urls,
    "</urlset>",
  ].join("");
}

async function getRecentStories(cutoff: string) {
  const supabaseUrl = env("SUPABASE_URL") || env("VITE_SUPABASE_URL");
  const supabaseKey =
    env("SUPABASE_SERVICE_ROLE_KEY") ||
    env("SUPABASE_ANON_KEY") ||
    env("VITE_SUPABASE_ANON_KEY");

  if (!supabaseUrl || !supabaseKey) return [];

  try {
    const db = createClient(supabaseUrl, supabaseKey);
    const { data, error } = await db
      .from("articles")
      .select("id,original_title,ai_hook_title,timestamp")
      .eq("editorial_status", "published")
      .gte("timestamp", cutoff)
      .order("timestamp", { ascending: false })
      .limit(1000);

    if (error || !Array.isArray(data)) return [];
    return data as Array<Record<string, unknown>>;
  } catch {
    return [];
  }
}

export default async function handler(request: Request, _context: Context) {
  const site = getSite(request);
  const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();

  let stories = await getRecentStories(cutoff);

  // Google News requires <url> entries. If the wire has gone quiet for 48 hours,
  // refresh the news feed once so a legitimate newly published story can populate
  // the sitemap. We never add an older story just to satisfy the XML validator.
  if (!stories.length) {
    try {
      await runIngest();
      stories = await getRecentStories(cutoff);
    } catch (error) {
      console.error("[RockBrief] News Sitemap refresh failed", error);
    }
  }

  return new Response(xmlFor(stories, site), {
    status: 200,
    headers: {
      "Content-Type": "application/xml; charset=UTF-8",
      "Cache-Control": "public, max-age=300, stale-while-revalidate=600",
      "X-RockBrief-News-Sitemap": "1",
    },
  });
}

export const config: Config = {
  path: "/news-sitemap.xml",
};
