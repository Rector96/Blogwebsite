import { createClient } from "@supabase/supabase-js";

export const SPONSOR_PACKAGES = {
  sidebar: { name: "Sidebar Sponsor", usd: 75, ngn: 75000, placement: "sidebar", days: 30 },
  in_feed: { name: "In-feed Sponsor", usd: 100, ngn: 100000, placement: "in_feed", days: 30 },
  homepage: { name: "Homepage Featured Sponsor", usd: 150, ngn: 150000, placement: "both", days: 30 },
  homepage_sidebar: { name: "Homepage + Sidebar", usd: 200, ngn: 200000, placement: "both", days: 30 },
  newsletter: { name: "Newsletter Sponsor", usd: 75, ngn: 75000, placement: "newsletter", days: 30 },
  sponsored_story: { name: "Sponsored Article / Briefing", usd: 150, ngn: 150000, placement: "in_feed", days: 30 },
  premium: { name: "Premium Monthly Package", usd: 300, ngn: 300000, placement: "both", days: 30 },
} as const;

export type SponsorCurrency = "USD" | "NGN";

export type SponsorPackageCode = keyof typeof SPONSOR_PACKAGES;

export function env(name: string) {
  return Netlify.env.get(name) || "";
}

export function database() {
  const url = env("SUPABASE_URL") || env("VITE_SUPABASE_URL");
  const key = env("SUPABASE_SERVICE_ROLE_KEY");
  return url && key ? createClient(url, key) : null;
}

export async function paystackRequest(path: string, init: RequestInit = {}) {
  const secret = env("PAYSTACK_SECRET_KEY");
  if (!secret) throw new Error("PAYSTACK_SECRET_KEY is not configured.");
  return fetch("https://api.paystack.co" + path, {
    ...init,
    headers: {
      Authorization: "Bearer " + secret,
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });
}

export function json(data: unknown, status = 200, extraHeaders: Record<string,string> = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json", ...extraHeaders },
  });
}

export function cleanText(value: unknown, max = 500) {
  return String(value ?? "").trim().slice(0, max);
}

export function makeReference() {
  return "RWD-" + Date.now().toString(36).toUpperCase() + "-" + crypto.randomUUID().replace(/-/g, "").slice(0, 10).toUpperCase();
}
