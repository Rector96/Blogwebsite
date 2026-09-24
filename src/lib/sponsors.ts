import { isSupabaseConfigured, supabase } from "./supabase";

export type SponsoredOffer = {
  id: string;
  slug?: string;
  sponsorName: string;
  headline: string;
  whyMatters: string[];
  ctaText: string;
  ctaUrl: string;
  rateHighlight: string;
  disclosure: string;
  placement?: string;
  creativeUrl?: string;
};

export async function fetchSponsors(): Promise<SponsoredOffer[]> {
  if (!isSupabaseConfigured || !supabase) return [];
  const { data, error } = await supabase
    .from("sponsors")
    .select(
      "id, slug, sponsor_name, headline, why_matters, cta_text, cta_url, rate_highlight, disclosure, placement, priority, creative_url, creative_alt",
    )
    .eq("active", true)
    .order("priority", { ascending: true });

  if (error || !data?.length) return [];

  return data.map((row) => ({
    id: String(row.id),
    slug: row.slug as string,
    sponsorName: String(row.sponsor_name),
    headline: String(row.headline),
    whyMatters: Array.isArray(row.why_matters)
      ? (row.why_matters as string[])
      : [],
    ctaText: String(row.cta_text || "View offer"),
    ctaUrl: String(row.cta_url),
    rateHighlight: String(row.rate_highlight || ""),
    disclosure: String(row.disclosure || "Sponsored"),
    placement: String(row.placement || "sidebar"),
    creativeUrl: row.creative_url ? String(row.creative_url) : undefined,
  }));
}

export async function logSponsorClick(
  offer: SponsoredOffer,
  placement: string,
) {
  if (!isSupabaseConfigured || !supabase) return;
  try {
    await supabase.from("sponsor_clicks").insert({
      sponsor_id: offer.id.match(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
      )
        ? offer.id
        : null,
      sponsor_slug: offer.slug || offer.id,
      placement,
      page_path:
        typeof window !== "undefined" ? window.location.pathname : "/",
      user_agent:
        typeof navigator !== "undefined" ? navigator.userAgent.slice(0, 180) : "",
    });
  } catch {
    /* non-blocking */
  }
}

export async function submitSalesLead(input: {
  name?: string;
  email: string;
  company?: string;
  message?: string;
}) {
  if (!isSupabaseConfigured || !supabase) {
    return { ok: false as const, reason: "no_supabase" };
  }
  const { error } = await supabase.from("sales_leads").insert({
    name: input.name || null,
    email: input.email.trim().toLowerCase(),
    company: input.company || null,
    message: input.message || null,
    source: "media_kit",
  });
  if (error) return { ok: false as const, reason: error.message };
  return { ok: true as const };
}
