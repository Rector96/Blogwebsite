export async function handler(event: any) {
  const host = String(event?.headers?.host || "").split(":")[0];
  const forwarded = String(event?.headers?.["x-forwarded-proto"] || "https").split(",")[0];
  const site = (process.env.PUBLIC_SITE_URL || (host ? forwarded + "://" + host : "https://rwdnews.netlify.app")).replace(/\/$/, "");
  const body = [
    "User-agent: *",
    "Allow: /",
    "",
    "Sitemap: " + site + "/sitemap.xml",
    "Sitemap: " + site + "/news-sitemap.xml",
    "",
  ].join("\n");
  return {
    statusCode: 200,
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=900, stale-while-revalidate=3600" },
    body,
  };
}
