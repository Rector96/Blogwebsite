import type { Config, Context } from "@netlify/functions";
import { createHash } from "node:crypto";
import { database, json } from "../../src/lib/paystack-server";

function classifyDevice(ua: string) {
  if (/tablet|ipad/i.test(ua)) return "tablet";
  if (/mobile|android|iphone|ipod/i.test(ua)) return "mobile";
  return "desktop";
}
function classifyBrowser(ua: string) {
  if (/edg\//i.test(ua)) return "Edge";
  if (/chrome\//i.test(ua) && !/edg\//i.test(ua)) return "Chrome";
  if (/firefox\//i.test(ua)) return "Firefox";
  if (/safari\//i.test(ua) && !/chrome\//i.test(ua)) return "Safari";
  return "Other";
}
function sourceFrom(referrer: string, utmSource: string) {
  if (utmSource) return utmSource.toLowerCase().slice(0, 80);
  if (!referrer) return "Direct";
  try {
    const host = new URL(referrer).hostname.replace(/^www\./, "");
    if (/news\.google\./i.test(host)) return "Google News";
    if (/google\./i.test(host)) return "Google";
    if (/bing\./i.test(host)) return "Bing";
    if (/yahoo\./i.test(host)) return "Yahoo";
    if (/facebook\./i.test(host) || /instagram\./i.test(host)) return "Meta";
    if (/x\.com|twitter\.com/i.test(host)) return "X";
    if (/t\.co/i.test(host)) return "X";
    if (/whatsapp\./i.test(host)) return "WhatsApp";
    if (/t\.me|telegram\./i.test(host)) return "Telegram";
    return host.slice(0, 80);
  } catch { return "Referral"; }
}

export default async (req: Request, context: Context) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  const db = database();
  if (!db) return json({ ok: false }, 503);

  const body = await req.json().catch(() => ({}));
  const event = String(body.event || "").slice(0, 50);
  const allowed = new Set(["page_view","article_open","article_share","article_save","newsletter_signup","sponsor_click","advertise_open","search","external_source_click","recommendation_impression","recommendation_click","reading_engaged","return_visit"]);
  if (!allowed.has(event)) return json({ ok: false }, 400);

  const ua = req.headers.get("user-agent") || "";
  if (/bot|crawler|spider|headless|slurp/i.test(ua)) return json({ ok: true, ignored: true });

  const url = new URL(req.url);
  const referrer = String(body.referrer || req.headers.get("referer") || "").slice(0, 500);
  const utmSource = String(body.utm_source || url.searchParams.get("utm_source") || "").slice(0, 80);
  const ip = context.ip || "";
  const ipHash = ip ? createHash("sha256").update(ip + (process.env.ADMIN_SESSION_SECRET || "rwdnews")).digest("hex").slice(0, 32) : null;

  const { error } = await db.from("rwdnews_events").insert({
    event_name: event,
    article_id: body.articleId ? String(body.articleId).slice(0, 200) : null,
    article_url: body.articleUrl ? String(body.articleUrl).slice(0, 500) : null,
    placement: body.placement ? String(body.placement).slice(0, 80) : null,
    page_path: body.page_path ? String(body.page_path).slice(0, 300) : "/",
    referrer: referrer || null,
    session_id: body.session_id ? String(body.session_id).slice(0, 100) : null,
    source: sourceFrom(referrer, utmSource),
    country: context.geo?.country?.name || context.geo?.country?.code || null,
    city: context.geo?.city || null,
    device: classifyDevice(ua),
    browser: classifyBrowser(ua),
    utm_source: utmSource || null,
    utm_medium: body.utm_medium ? String(body.utm_medium).slice(0, 80) : null,
    utm_campaign: body.utm_campaign ? String(body.utm_campaign).slice(0, 120) : null,
  });
  if (error) console.error("[RWDNEWS] analytics insert failed", error, ipHash);
  return json({ ok: !error });
};

export const config: Config = { path: "/api/track" };
