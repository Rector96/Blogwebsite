import { database, SPONSOR_PACKAGES, cleanText, env, json, makeReference, paystackRequest, type SponsorPackageCode, type SponsorCurrency } from "../../src/lib/paystack-server";

export default async (req: Request) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  const db = database();
  if (!db) return json({ error: "Payment database is not configured." }, 503);

  const body = await req.json().catch(() => ({}));
  const packageCode = cleanText(body.package_code, 40) as SponsorPackageCode;
  const currency = (String(body.currency || "USD").toUpperCase() === "NGN" ? "NGN" : "USD") as SponsorCurrency;
  const pkg = SPONSOR_PACKAGES[packageCode];
  const email = cleanText(body.email, 160).toLowerCase();
  const name = cleanText(body.name, 120);
  const company = cleanText(body.company, 160);
  const headline = cleanText(body.headline, 180);
  const ctaUrl = cleanText(body.cta_url, 500);
  const baseAmount = pkg ? (currency === "USD" ? pkg.usd : pkg.ngn) : 0;
  const amountSubunit = baseAmount * 100;

  if (currency === "USD" && env("PAYSTACK_USD_ENABLED").toLowerCase() !== "true") {
    return json({ error: "USD sponsorship payments are not enabled yet. Please choose NGN." }, 400);
  }
  if (!pkg || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return json({ error: "Choose a valid sponsorship package and enter a valid email." }, 400);
  }
  if (ctaUrl && !/^https?:\/\//i.test(ctaUrl)) return json({ error: "Website URL must start with http:// or https://." }, 400);

  const reference = makeReference();
  const { error: insertError } = await db.from("sponsor_payments").insert({
    reference,
    package_code: packageCode,
    package_name: pkg.name,
    currency,
    amount: baseAmount,
    amount_subunit: amountSubunit,
    amount_usd: currency === "USD" ? baseAmount : null,
    amount_naira: currency === "NGN" ? baseAmount : null,
    amount_kobo: currency === "NGN" ? amountSubunit : null,
    email,
    name: name || null,
    company: company || null,
    headline: headline || null,
    cta_url: ctaUrl || null,
    placement: pkg.placement,
    duration_days: pkg.days,
    status: "pending",
    paystack_currency: currency,
    metadata: { source: "rwdnews_advertise", currency },
  });
  if (insertError) return json({ error: "Could not create payment record." }, 500);

  const siteUrl = env("PUBLIC_SITE_URL").replace(/\/$/, "") || new URL(req.url).origin;
  let response: Response;
  try {
    response = await paystackRequest("/transaction/initialize", {
      method: "POST",
      body: JSON.stringify({
        email,
        amount: String(amountSubunit),
        currency,
        reference,
        callback_url: siteUrl + "/advertise?payment=callback",
        metadata: {
          payment_reference: reference,
          package_code: packageCode,
          package_name: pkg.name,
          currency,
          company,
          name,
        },
      }),
    });
  } catch (error) {
    await db.from("sponsor_payments").update({ status: "failed", paystack_status: "initialize_failed", updated_at: new Date().toISOString() }).eq("reference", reference);
    return json({ error: error instanceof Error ? error.message : "Paystack is unavailable." }, 502);
  }

  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload?.status || !payload?.data?.authorization_url) {
    await db.from("sponsor_payments").update({ status: "failed", paystack_status: "initialize_failed", updated_at: new Date().toISOString() }).eq("reference", reference);
    return json({ error: payload?.message || "Paystack could not initialize the payment." }, 502);
  }

  return json({
    ok: true,
    reference,
    authorization_url: payload.data.authorization_url,
    amount: baseAmount,
    currency,
    package_name: pkg.name,
  });
};
