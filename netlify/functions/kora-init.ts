import {
  database,
  SPONSOR_PACKAGES,
  cleanText,
  env,
  json,
  makeReference,
  koraRequest,
  type SponsorPackageCode,
  type SponsorCurrency,
  SPONSOR_MAX_MONTHS,
  sponsorTotalUsd,
} from "../../src/lib/kora-server";

export default async (req: Request) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  const db = database();
  if (!db) return json({ error: "Payment database is not configured." }, 503);

  const body = await req.json().catch(() => ({}));
  const packageCode = cleanText(body.package_code, 40) as SponsorPackageCode;
  const currency = "USD" as SponsorCurrency;
  const months = Math.max(1, Math.min(SPONSOR_MAX_MONTHS, Math.floor(Number(body.months) || 1)));

  const pkg = SPONSOR_PACKAGES[packageCode];
  const email = cleanText(body.email, 160).toLowerCase();
  const name = cleanText(body.name, 120);
  const company = cleanText(body.company, 160);
  const headline = cleanText(body.headline, 180);
  const ctaUrl = cleanText(body.cta_url, 500);
  const creativeMode = String(body.creative_mode || "upload") === "design" ? "design" : "upload";
  const creativeUrl = cleanText(body.creative_url, 1000);
  const creativeNotes = cleanText(body.creative_notes, 1000);
  const baseAmount = sponsorTotalUsd(packageCode, months);

  if (!pkg || !baseAmount || !/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(email)) {
    return json({ error: "Choose a valid sponsorship package and enter a valid email." }, 400);
  }
  if (ctaUrl && !/^https?:\\/\\//i.test(ctaUrl)) {
    return json({ error: "Website URL must start with http:// or https://." }, 400);
  }
  if (creativeMode === "upload" && !creativeUrl) {
    return json({ error: "Upload your advert creative or choose RWDNEWS design it." }, 400);
  }

  const reference = makeReference();
  const { error: insertError } = await db.from("sponsor_payments").insert({
    reference,
    package_code: packageCode,
    package_name: pkg.name,
    currency,
    amount: baseAmount,
    amount_subunit: baseAmount,
    amount_usd: baseAmount,
    amount_naira: null,
    amount_kobo: null,
    email,
    name: name || null,
    company: company || null,
    headline: headline || null,
    cta_url: ctaUrl || null,
    creative_mode: creativeMode,
    creative_url: creativeUrl || null,
    creative_notes: creativeNotes || null,
    design_requested: creativeMode === "design",
    placement: pkg.placement,
    duration_days: months * 30,
    duration_months: months,
    status: "pending",
    payment_provider: "kora",
    provider_status: "initialized",
    provider_currency: currency,
    metadata: { source: "rockbrief_advertise", currency, payment_provider: "kora", duration_months: months, monthly_rate_usd: pkg.usd },
  });

  if (insertError) return json({ error: "Could not create payment record." }, 500);

  const siteUrl = env("PUBLIC_SITE_URL").replace(/\\/$/, "") || new URL(req.url).origin;
  const notificationUrl = siteUrl + "/api/kora/webhook";
  const redirectUrl = siteUrl + "/advertise?payment=callback";

  try {
    const response = await koraRequest("/api/v1/charges/initialize", {
      method: "POST",
      body: JSON.stringify({
        amount: baseAmount,
        currency: "USD",
        reference,
        redirect_url: redirectUrl,
        notification_url: notificationUrl,
        narration: "RockBrief " + pkg.name,
        merchant_bears_cost: true,
        customer: { name: name || company || "RockBrief Advertiser", email },
        metadata: { payment_reference: reference, package_code: packageCode, source: "rwdnews" },
      }),
    });

    const payload = await response.json().catch(() => ({}));
    const checkoutUrl = payload?.data?.checkout_url;
    if (!response.ok || !payload?.status || !checkoutUrl) {
      await db.from("sponsor_payments").update({
        status: "failed",
        provider_status: "initialize_failed",
        updated_at: new Date().toISOString(),
      }).eq("reference", reference);
      return json({ error: payload?.message || "Kora could not initialize the payment." }, 502);
    }

    await db.from("sponsor_payments").update({
      provider_status: "initialized",
      updated_at: new Date().toISOString(),
    }).eq("reference", reference);

    return json({
      ok: true,
      reference,
      authorization_url: checkoutUrl,
      amount: baseAmount,
      currency: "USD",
      package_name: pkg.name,
      months,
      monthly_rate_usd: pkg.usd,
      payment_provider: "kora",
    });
  } catch (error) {
    await db.from("sponsor_payments").update({
      status: "failed",
      provider_status: "initialize_failed",
      updated_at: new Date().toISOString(),
    }).eq("reference", reference);
    return json({ error: error instanceof Error ? error.message : "Kora is unavailable." }, 502);
  }
};
