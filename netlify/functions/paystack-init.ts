import { database, SPONSOR_PACKAGES, cleanText, env, json, makeReference, paystackRequest, type SponsorPackageCode } from "./_paystack";

export default async (req: Request) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  const db = database();
  if (!db) return json({ error: "Payment database is not configured." }, 503);

  const body = await req.json().catch(() => ({}));
  const packageCode = cleanText(body.package_code, 40) as SponsorPackageCode;
  const pkg = SPONSOR_PACKAGES[packageCode];
  const email = cleanText(body.email, 160).toLowerCase();
  const name = cleanText(body.name, 120);
  const company = cleanText(body.company, 160);
  const headline = cleanText(body.headline, 180);
  const ctaUrl = cleanText(body.cta_url, 500);

  if (!pkg || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return json({ error: "Choose a valid sponsorship package and enter a valid email." }, 400);
  }
  if (ctaUrl && !/^https?:\/\//i.test(ctaUrl)) return json({ error: "Website URL must start with http:// or https://." }, 400);

  const reference = makeReference();
  const { error: insertError } = await db.from("sponsor_payments").insert({
    reference,
    package_code: packageCode,
    package_name: pkg.name,
    amount_naira: pkg.amountNaira,
    amount_kobo: pkg.amountNaira * 100,
    email,
    name: name || null,
    company: company || null,
    headline: headline || null,
    cta_url: ctaUrl || null,
    placement: pkg.placement,
    duration_days: pkg.days,
    status: "pending",
    metadata: { source: "rwdnews_advertise" },
  });
  if (insertError) return json({ error: "Could not create payment record." }, 500);

  const siteUrl = env("PUBLIC_SITE_URL").replace(/\/$/, "") || new URL(req.url).origin;
  const response = await paystackRequest("/transaction/initialize", {
    method: "POST",
    body: JSON.stringify({
      email,
      amount: String(pkg.amountNaira * 100),
      currency: "NGN",
      reference,
      callback_url: siteUrl + "/advertise?payment=callback",
      metadata: {
        payment_reference: reference,
        package_code: packageCode,
        package_name: pkg.name,
        company,
        name,
      },
    }),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload?.status || !payload?.data?.authorization_url) {
    await db.from("sponsor_payments").update({ status: "failed", paystack_status: "initialize_failed", updated_at: new Date().toISOString() }).eq("reference", reference);
    return json({ error: payload?.message || "Paystack could not initialize the payment." }, 502);
  }

  return json({
    ok: true,
    reference,
    authorization_url: payload.data.authorization_url,
    amount_naira: pkg.amountNaira,
    package_name: pkg.name,
  });
};
