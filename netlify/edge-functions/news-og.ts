/** Open Graph HTML for social crawlers on /news/* — humans get SPA via context.next() */

const BOT =
  /bot|crawl|slurp|spider|facebookexternalhit|Facebot|Twitterbot|LinkedInBot|WhatsApp|TelegramBot|Discordbot|Slackbot|SkypeUriPreview|embedly|pinterest|redditbot|Applebot|BingPreview/i;

function escapeHtml(s: string) {
  return String(s || "")
    .replace(/&/g, "&")
    .replace(/</g, "<")
    .replace(/>/g, ">")
    .replace(/"/g, """);
}

function storyIdFromPath(pathname: string) {
  const path = pathname.replace(/^\/news\//, "");
  const marker = path.lastIndexOf("--");
  if (marker < 0) return "";
  try {
    return decodeURIComponent(path.slice(marker + 2));
  } catch {
    return path.slice(marker + 2);
  }
}

function absoluteUrl(origin: string, value: string) {
  const v = String(value || "").trim();
  if (!v) return origin + "/rwdnews-logo.svg";
  if (/^https?:\/\//i.test(v)) return v;
  if (v.startsWith("//")) return "https:" + v;
  if (v.startsWith("/")) return origin + v;
  return origin + "/" + v;
}

function clean(value: string) {
  return String(value || "")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export default async function handler(request: Request, context: { next: () => Promise<Response> }) {
  const ua = request.headers.get("user-agent") || "";
  if (!BOT.test(ua)) {
    return context.next();
  }

  const url = new URL(request.url);
  const origin = url.origin;
  const id = storyIdFromPath(url.pathname);
  if (!id) return context.next();

  // @ts-ignore Deno global on Netlify Edge
  const env = (globalThis as any).Deno?.env;
  const supabaseUrl = (env?.get?.("SUPABASE_URL") || env?.get?.("VITE_SUPABASE_URL") || "") as string;
  const supabaseKey = (env?.get?.("SUPABASE_ANON_KEY") ||
    env?.get?.("VITE_SUPABASE_ANON_KEY") ||
    env?.get?.("SUPABASE_SERVICE_ROLE_KEY") ||
    "") as string;

  let title = "RockBrief story";
  let description = "Clear, source-backed global news briefings from RockBrief.";
  let image = origin + "/rwdnews-logo.svg";
  let published = new Date().toISOString();
  let section = "News";

  if (supabaseUrl && supabaseKey) {
    try {
      const endpoint =
        supabaseUrl.replace(/\/$/, "") +
        "/rest/v1/articles?id=eq." +
        encodeURIComponent(id) +
        "&select=id,ai_hook_title,original_title,original_description,ai_summary,image,timestamp,category&limit=1";
      const res = await fetch(endpoint, {
        headers: {
          apikey: supabaseKey,
          Authorization: "Bearer " + supabaseKey,
        },
      });
      if (res.ok) {
        const rows = await res.json();
        const row = Array.isArray(rows) ? rows[0] : null;
        if (row) {
          title = clean(row.ai_hook_title || row.original_title || title);
          const summary = Array.isArray(row.ai_summary) ? row.ai_summary[0] : "";
          description = clean(summary || row.original_description || description).slice(0, 200);
          image = absoluteUrl(origin, row.image || "");
          if (/\.svg(\?|$)/i.test(image)) image = origin + "/og-default.png";
          published = row.timestamp || published;
          section = row.category || section;
        }
      }
    } catch {
      /* defaults */
    }
  }

  if (/\.svg(\?|$)/i.test(image)) image = origin + "/og-default.png";

  const pageUrl = origin + url.pathname;
  const html =
    "<!DOCTYPE html><html lang=\"en\"><head><meta charset=\"utf-8\" />" +
    "<title>" +
    escapeHtml(title) +
    " — RockBrief</title>" +
    "<meta name=\"description\" content=\"" +
    escapeHtml(description) +
    "\" />" +
    "<link rel=\"canonical\" href=\"" +
    escapeHtml(pageUrl) +
    "\" />" +
    "<meta property=\"og:site_name\" content=\"RockBrief\" />" +
    "<meta property=\"og:type\" content=\"article\" />" +
    "<meta property=\"og:title\" content=\"" +
    escapeHtml(title) +
    "\" />" +
    "<meta property=\"og:description\" content=\"" +
    escapeHtml(description) +
    "\" />" +
    "<meta property=\"og:url\" content=\"" +
    escapeHtml(pageUrl) +
    "\" />" +
    "<meta property=\"og:image\" content=\"" +
    escapeHtml(image) +
    "\" />" +
    "<meta name=\"twitter:card\" content=\"summary_large_image\" />" +
    "<meta name=\"twitter:title\" content=\"" +
    escapeHtml(title) +
    "\" />" +
    "<meta name=\"twitter:image\" content=\"" +
    escapeHtml(image) +
    "\" />" +
    "</head><body><p><a href=\"" +
    escapeHtml(pageUrl) +
    "\">" +
    escapeHtml(title) +
    "</a></p></body></html>";

  return new Response(html, {
    status: 200,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "public, max-age=300",
      "x-rockbrief-og": "1",
    },
  });
}

export const config = { path: "/news/*" };
