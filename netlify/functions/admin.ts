import { createClient } from "@supabase/supabase-js";
import { createHmac, timingSafeEqual } from "node:crypto";
import { env, json, SPONSOR_PACKAGES, paystackRequest } from "../../src/lib/paystack-server";
import { koraRequest } from "../../src/lib/kora-server";
import { sanitizeArticleHtmlServer } from "../../src/lib/server-content";

function db() {
  const url = env("SUPABASE_URL") || env("VITE_SUPABASE_URL");
  const key = env("SUPABASE_SERVICE_ROLE_KEY");
  return url && key ? createClient(url, key) : null;
}
function signature(payload: string) {
  const secret = env("ADMIN_SESSION_SECRET");
  if (!secret) throw new Error("ADMIN_SESSION_SECRET is not configured.");
  return createHmac("sha256", secret).update(payload).digest("hex");
}
function sessionCookie() {
  const payload = Buffer.from(JSON.stringify({ exp: Date.now() + 1000 * 60 * 60 * 12 })).toString("base64url");
  return "rwdnews_admin=" + payload + "." + signature(payload) + "; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=43200";
}
function authorized(req: Request) {
  const cookie = req.headers.get("cookie") || "";
  const match = cookie.match(/(?:^|;\s*)rwdnews_admin=([^;]+)/);
  if (!match) return false;
  const parts = match[1].split(".");
  if (parts.length !== 2) return false;
  const [payload, sig] = parts;
  const expected = signature(payload);
  if (sig.length !== expected.length) return false;
  try {
    if (!timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return false;
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    return Number(parsed.exp) > Date.now();
  } catch { return false; }
}
function clean(value: unknown, max = 500) { return String(value ?? "").trim().slice(0, max); }
function addMonthsIso(startIso: string, months: number) { const d = new Date(startIso); d.setMonth(d.getMonth() + Math.max(1, Math.floor(Number(months) || 1))); return d.toISOString(); }
async function audit(database: any, action: string, entityType?: string, entityId?: string, details: Record<string, unknown> = {}) {
  await database.from("admin_audit_logs").insert({ action, entity_type: entityType || null, entity_id: entityId || null, details });
}

export default async (req: Request) => {
  if (req.method === "POST") {
    const body = await req.json().catch(() => ({}));

    if (body.action === "login") {
      const password = env("ADMIN_PASSWORD");
      if (!password || !env("ADMIN_SESSION_SECRET")) return json({ error: "Admin login is not configured in Netlify." }, 503);
      if (String(body.password || "") !== password) return json({ error: "Invalid password." }, 401);
      return json({ ok: true }, 200, { "set-cookie": sessionCookie() });
    }

    if (!authorized(req)) return json({ error: "Unauthorized" }, 401);
    const database = db();
    if (!database) return json({ error: "Admin database is not configured. Check Supabase URL and service role key." }, 503);
    if (body.action === "logout") return json({ ok: true }, 200, { "set-cookie": "rwdnews_admin=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0" });

    if (body.action === "article_get") {\n      const id = clean(body.id, 200);\n      if (!id) return json({ error: "Article ID is required." }, 400);\n      const { data, error } = await database.from("articles").select("*").eq("id", id).maybeSingle();\n      if (error) return json({ error: error.message }, 400);\n      if (!data) return json({ error: "Article not found." }, 404);\n      return json({ ok: true, article: data });\n    }\n\n    if (body.action === "article_image_upload") {
      const filename = clean(body.filename || "image", 120).replace(/[^a-zA-Z0-9._-]/g, "-");
      const mime = clean(body.mime_type, 80).toLowerCase();
      const allowed = ["image/jpeg", "image/png", "image/webp", "image/avif"];
      if (!allowed.includes(mime)) return json({ error: "Only JPG, PNG, WebP or AVIF images are allowed." }, 400);
      const raw = String(body.data || "");
      const match = raw.match(/^data:([^;]+);base64,(.+)$/);
      const base64 = match ? match[2] : raw;
      if (!base64) return json({ error: "Image data is missing." }, 400);
      const bytes = Buffer.from(base64, "base64");
      if (bytes.length > 5 * 1024 * 1024) return json({ error: "Image is too large. Maximum size is 5 MB." }, 400);
      const ext = mime.split("/")[1] === "jpeg" ? "jpg" : mime.split("/")[1];
      const path = "articles/" + new Date().toISOString().slice(0,10) + "/" + Date.now().toString(36) + "-" + filename.replace(/.[^.]+$/, "") + "." + ext;
      const { error } = await database.storage.from("rwdnews-images").upload(path, bytes, { contentType: mime, cacheControl: "31536000", upsert: false });
      if (error) return json({ error: error.message }, 400);
      const { data: pub } = database.storage.from("rwdnews-images").getPublicUrl(path);
      await audit(database, "article_image_uploaded", "article_image", path, { mime, bytes: bytes.length });
      return json({ ok: true, url: pub.publicUrl, path });
    }

    if (body.action === "sponsor_create") {
      const sponsorName = clean(body.sponsor_name, 120);
      const headline = clean(body.headline, 180);
      const ctaUrl = clean(body.cta_url, 500);
      if (!sponsorName || !headline || !/^https?:\/\//i.test(ctaUrl)) return json({ error: "Sponsor name, headline and a valid website URL are required." }, 400);
      const slug = sponsorName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 70) + "-" + Date.now().toString(36);
      const currency = "USD";
      const amount = Number(body.amount || 0);
      const durationMonths = Math.max(1, Math.min(12, Math.floor(Number(body.duration_months) || 1)));
      const placement = clean(body.placement || "sidebar", 30);
      if (!["sidebar", "in_feed", "both"].includes(placement)) return json({ error: "Invalid sponsor placement." }, 400);
      if (!Number.isFinite(amount) || amount <= 0) return json({ error: "Monthly sponsor fee must be greater than zero." }, 400);
      const { data, error } = await database.from("sponsors").insert({
        slug, sponsor_name: sponsorName, headline, why_matters: [], cta_text: clean(body.cta_text || "Learn more", 80),
        cta_url: ctaUrl, rate_highlight: "", disclosure: clean(body.disclosure || "Sponsored · Paid placement", 160),
        placement, priority: Number(body.priority || 100),
        currency, monthly_fee_usd: amount || null, monthly_fee_naira: null, duration_months: durationMonths,
        active: false, starts_at: body.starts_at || new Date().toISOString(), ends_at: body.ends_at || addMonthsIso(new Date().toISOString(), durationMonths),
      }).select("id").single();
      if (error) return json({ error: error.message }, 400);
      await audit(database, "sponsor_created", "sponsor", String(data?.id), { sponsor_name: sponsorName, monthly_rate_usd: amount, duration_months: durationMonths, currency });
      return json({ ok: true });
    }

    if (body.action === "sponsor_delete") {
      const id = clean(body.id, 100);
      if (!id) return json({ error: "Sponsor ID is required." }, 400);

      // Preserve payment history while removing the sponsor campaign and its click records.
      const { error: clickError } = await database.from("sponsor_clicks").delete().eq("sponsor_id", id);
      if (clickError) return json({ error: clickError.message }, 400);

      const { error: paymentError } = await database.from("sponsor_payments").update({ sponsor_id: null, updated_at: new Date().toISOString() }).eq("sponsor_id", id);
      if (paymentError) return json({ error: paymentError.message }, 400);

      const { error: sponsorError } = await database.from("sponsors").delete().eq("id", id);
      if (sponsorError) return json({ error: sponsorError.message }, 400);

      await audit(database, "sponsor_deleted", "sponsor", id);
      return json({ ok: true });
    }

    if (body.action === "sponsor_status") {
      const id = clean(body.id, 100);
      const active = Boolean(body.active);
      const sponsorRow = (await database.from("sponsors").select("duration_months").eq("id", id).maybeSingle()).data;
      const now = new Date();
      const durationMonths = Math.max(1, Math.min(12, Number(sponsorRow?.duration_months || 1)));
      const patch = active
        ? { active: true, starts_at: now.toISOString(), ends_at: addMonthsIso(now.toISOString(), durationMonths), updated_at: now.toISOString() }
        : { active: false, updated_at: now.toISOString() };
      const { error } = await database.from("sponsors").update(patch).eq("id", id);
      if (error) return json({ error: error.message }, 400);
      await audit(database, active ? "sponsor_activated" : "sponsor_paused", "sponsor", id, { duration_months: durationMonths });
      return json({ ok: true });
    }

    if (body.action === "lead_status") {
      const id = clean(body.id, 100);
      const status = clean(body.status, 30);
      if (!["new","contacted","won","lost"].includes(status)) return json({ error: "Invalid lead status." }, 400);
      const { error } = await database.from("sales_leads").update({ status }).eq("id", id);
      if (error) return json({ error: error.message }, 400);
      await audit(database, "lead_status_changed", "sales_lead", id, { status });
      return json({ ok: true });
    }

    if (body.action === "article_create") {
      const headline = clean(body.headline, 220);
      const description = clean(body.description, 1000);
      const bodyText = sanitizeArticleHtmlServer(String(body.body ?? "").trim().slice(0, 30000));
      const image = clean(body.image, 2000);
      const originalUrl = clean(body.original_url, 1000);
      const category = clean(body.category || "Business", 50);
      const region = clean(body.region || "Global", 50);
      const storyType = clean(body.story_type || "RockBrief ORIGINAL", 30);
      const subject = clean(body.subject, 180);
      const authorName = clean(body.author_name || "RockBrief Editorial", 120);
      const imageCredit = clean(body.image_credit || "RockBrief", 180);
      const imageLicense = clean(body.image_license || "Owned or licensed by RockBrief", 240);
      const imageSourceUrl = clean(body.image_source_url || originalUrl, 1000);
      const status = ["published","hidden","archived"].includes(String(body.editorial_status)) ? String(body.editorial_status) : "draft";
      if (!headline || !description || !bodyText || !image || !/^https?:\/\//i.test(image)) return json({ error: "Headline, description, article body and a valid image URL are required." }, 400);
      if (originalUrl && !/^https?:\/\//i.test(originalUrl)) return json({ error: "Original/source URL must be a valid URL." }, 400);
      if (!["Business","World","Europe","Middle East","Asia","Africa","Nigeria","Ghana","Sports","Tech","Crypto","Entertainment"].includes(category)) return json({ error: "Invalid category." }, 400);
      if (!["Global","Africa","Nigeria","Ghana","Europe","Middle East","Asia","North America","South America"].includes(region)) return json({ error: "Invalid region." }, 400);
      if (!["WIRE","RockBrief ORIGINAL","DEVELOPING"].includes(storyType)) return json({ error: "Invalid story type." }, 400);
      const timestamp = body.publish_at && !Number.isNaN(Date.parse(String(body.publish_at))) ? new Date(String(body.publish_at)).toISOString() : new Date().toISOString();
      const id = "original-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8);
      const slugSource = headline.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 90);
      const { data, error } = await database.from("articles").insert({
        id, original_url: originalUrl || ("https://rwdnews.local/original/" + id), original_title: headline,
        original_description: description, ai_hook_title: headline, ai_summary: [description],
        tags: Array.isArray(body.tags) ? body.tags.map((x: unknown) => "#" + clean(x, 40).replace(/^#/,"")).filter(Boolean).slice(0, 8) : [],
        source: storyType === "RockBrief ORIGINAL" ? "RockBrief" : clean(body.source || "RockBrief", 120),
        image, read_time: clean(body.read_time || "3 min read", 30), timestamp,
        editorial_status: status === "draft" ? "hidden" : status, featured: Boolean(body.featured), pinned: Boolean(body.pinned),
        story_type: storyType, body: bodyText, category, region, subject, author_name: authorName,
        image_credit: imageCredit, image_license: imageLicense, image_source_url: imageSourceUrl, published_by: "admin",
      }).select("id").single();
      if (error) return json({ error: error.message }, 400);
      await audit(database, "article_created", "article", String(data?.id), { story_type: storyType, category, region, subject, slug: slugSource });
      return json({ ok: true, id: data?.id });
    }

    if (body.action === "article_update") {
      const id = clean(body.id, 200);
      const patch: Record<string, unknown> = {};
      if (typeof body.featured === "boolean") patch.featured = body.featured;
      if (typeof body.pinned === "boolean") patch.pinned = body.pinned;
      if (["published","hidden","archived"].includes(String(body.editorial_status))) patch.editorial_status = body.editorial_status;
      const textFields = ["headline","description","body","image","category","region","story_type","subject","author_name","image_credit","image_license","image_source_url","original_url"] as const;
      for (const field of textFields) {
        if (typeof body[field] === "string") {
          const value = field === "body" ? sanitizeArticleHtmlServer(String(body[field]).slice(0, 100000)) : clean(body[field], 2000);
          if (field === "headline") patch.original_title = value;
          else if (field === "description") patch.original_description = value;
          else patch[field] = value;
        }
      }
      if (Array.isArray(body.tags)) patch.tags = body.tags.map((x: unknown) => clean(x, 80)).filter(Boolean).slice(0, 20);
      if (typeof body.publish_at === "string" && !Number.isNaN(Date.parse(body.publish_at))) patch.timestamp = new Date(body.publish_at).toISOString();
      const { error } = await database.from("articles").update(patch).eq("id", id);
      if (error) return json({ error: error.message }, 400);
      await audit(database, "article_updated", "article", id, patch);
      return json({ ok: true });
    }

    if (body.action === "payment_activate") {
      const reference = clean(body.reference, 120);
      const { data: payment } = await database.from("sponsor_payments").select("*").eq("reference", reference).maybeSingle();
      if (!payment || payment.status !== "paid") return json({ error: "Only verified paid transactions can be activated." }, 400);

      const pkg = SPONSOR_PACKAGES[payment.package_code as keyof typeof SPONSOR_PACKAGES];
      if (payment.design_requested && !payment.creative_url) return json({ error: "This campaign requested RockBrief design. Upload the finished creative before activating it." }, 400);
      const starts = payment.starts_at || new Date().toISOString();
      const durationMonths = Math.max(1, Math.min(12, Math.floor(Number(payment.duration_months || 1))));
      const ends = payment.ends_at || addMonthsIso(starts, durationMonths);
      let sponsorId = payment.sponsor_id as string | null;

      if (!sponsorId) {
        const sponsorName = clean(payment.company || payment.name || "RockBrief Advertiser", 120);
        const slug = sponsorName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 70) + "-" + Date.now().toString(36);
        const { data: sponsor, error } = await database.from("sponsors").insert({
          slug, sponsor_name: sponsorName, headline: clean(payment.headline || pkg?.name || "Sponsored placement", 180),
          why_matters: [], cta_text: "Learn more", cta_url: clean(payment.cta_url || "", 500) || null,
          rate_highlight: "Paid placement", disclosure: "Sponsored · Paid placement", placement: payment.placement || "sidebar",
          creative_url: clean(payment.creative_url || "", 1000) || null,
          logo_url: clean(payment.logo_url || "", 1000) || null,
          creative_alt: clean(payment.headline || sponsorName, 180),
          active: true, priority: 50, currency: "USD", duration_months: Number(payment.duration_months || 1), monthly_rate_usd: payment.amount / Math.max(1, Number(payment.duration_months || 1)), monthly_fee_usd: payment.currency === "USD" ? payment.amount / Math.max(1, Number(payment.duration_months || 1)) : null, monthly_fee_naira: null, starts_at: starts, ends_at: ends,
        }).select("id").single();
        if (error) return json({ error: error.message }, 400);
        sponsorId = sponsor?.id || null;
      } else {
        await database.from("sponsors").update({ active: true, starts_at: starts, ends_at: ends, currency: "USD", duration_months: Number(payment.duration_months || 1), monthly_rate_usd: payment.amount / Math.max(1, Number(payment.duration_months || 1)), monthly_fee_usd: payment.currency === "USD" ? payment.amount / Math.max(1, Number(payment.duration_months || 1)) : null, monthly_fee_naira: null, updated_at: new Date().toISOString() }).eq("id", sponsorId);
      }

      await database.from("sponsor_payments").update({ sponsor_id: sponsorId, starts_at: starts, ends_at: ends, updated_at: new Date().toISOString() }).eq("reference", reference);
      await audit(database, "payment_activated", "sponsor_payment", reference, { sponsor_id: sponsorId, amount: payment.amount, currency: payment.currency });
      return json({ ok: true });
    }

    if (body.action === "payment_status") {
      const reference = clean(body.reference, 120);
      const status = clean(body.status, 30);
      if (!["pending","paid","failed","cancelled","refunded"].includes(status)) return json({ error: "Invalid payment status." }, 400);
      const { error } = await database.from("sponsor_payments").update({ status, updated_at: new Date().toISOString() }).eq("reference", reference);
      if (error) return json({ error: error.message }, 400);
      await audit(database, "payment_status_changed", "sponsor_payment", reference, { status });
      return json({ ok: true });
    }

    if (body.action === "payment_verify") {
      const reference = clean(body.reference, 120);
      const paymentRow = (await database.from("sponsor_payments").select("amount_subunit,amount_kobo,amount,currency,payment_provider").eq("reference", reference).maybeSingle()).data;
      if (!paymentRow) return json({ error: "Payment reference not found." }, 404);

      const provider = String(paymentRow.payment_provider || "kora").toLowerCase();
      let response: Response;
      if (provider === "kora") {
        response = await koraRequest("/api/v1/charges/" + encodeURIComponent(reference));
      } else {
        response = await paystackRequest("/transaction/verify/" + encodeURIComponent(reference));
      }
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload?.status) return json({ error: payload?.message || provider.toUpperCase() + " verification failed." }, 502);

      const expectedCurrency = String(paymentRow.currency || "USD").toUpperCase();
      const expectedAmount = Number(paymentRow?.amount ?? paymentRow?.amount_subunit ?? 0);
      const amountOk = String(payload.data?.currency || "").toUpperCase() === expectedCurrency
        && Number(payload.data?.amount ?? payload.data?.amount_paid ?? 0) === expectedAmount;
      const status = payload.data?.status === "success" && amountOk ? "paid" : (payload.data?.status === "failed" ? "failed" : "pending");
      const providerTransactionId = payload.data?.payment_reference || payload.data?.reference || payload.data?.id || null;
      await database.from("sponsor_payments").update({
        status,
        provider_status: String(payload.data?.status || ""),
        provider_transaction_id: providerTransactionId ? String(providerTransactionId) : null,
        provider_currency: payload.data?.currency ? String(payload.data.currency).toUpperCase() : null,
        paid_at: status === "paid" ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      }).eq("reference", reference);
      await audit(database, "payment_verified", "sponsor_payment", reference, { status, provider });
      return json({ ok: true, status, payment_provider: provider });
    }

    return json({ error: "Unknown action" }, 400);
  }

  if (!authorized(req)) return json({ error: "Unauthorized" }, 401);
  const database = db();
  if (!database) return json({ error: "Admin database is not configured. Check Supabase URL and service role key." }, 503);

  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString();
  const [sponsors, leads, payments, clicks, articles, newsletter, analytics] = await Promise.all([
    database.from("sponsors").select("id,sponsor_name,headline,placement,active,currency,monthly_fee_usd,monthly_fee_naira,starts_at,ends_at,priority").order("priority", { ascending: true }).limit(200),
    database.from("sales_leads").select("id,name,email,company,message,status,created_at").order("created_at", { ascending: false }).limit(100),
    database.from("sponsor_payments").select("id,reference,package_code,package_name,currency,amount,amount_naira,amount_usd,total_amount_usd,email,name,company,status,payment_provider,provider_status,provider_currency,provider_transaction_id,paystack_status,paystack_currency,sponsor_id,creative_mode,creative_url,creative_notes,design_requested,duration_months,monthly_rate_usd,paid_at,created_at").order("created_at", { ascending: false }).limit(1000),
    database.from("sponsor_clicks").select("sponsor_id,sponsor_slug,placement,created_at").order("created_at", { ascending: false }).limit(2000),
    database.from("articles").select("id,original_title,ai_hook_title,source,timestamp,updated_at,editorial_status,featured,pinned,story_type,category,region").order("timestamp", { ascending: false }).limit(100),
    database.from("newsletter_subscribers").select("id,status,created_at").order("created_at", { ascending: false }).limit(1000),
    database.rpc("get_rockbrief_admin_analytics", { p_since: thirtyDaysAgo }),
  ]);

  const firstError = [sponsors, leads, payments, clicks, articles, newsletter, analytics].find((x) => x.error);
  if (firstError?.error) return json({ error: firstError.error.message }, 400);

  const metrics = (analytics.data || {}) as Record<string, any>;
  const clickMap = new Map<string, number>();
  for (const row of clicks.data || []) {
    const key = String(row.sponsor_id || row.sponsor_slug || "unknown");
    clickMap.set(key, (clickMap.get(key) || 0) + 1);
  }
  const paid = (payments.data || []).filter((p: any) => p.status === "paid");
  const revenueNaira = paid.filter((p: any) => String(p.currency || "").toUpperCase() === "NGN")
    .reduce((sum: number, p: any) => sum + Number(p.amount_naira ?? p.amount ?? 0), 0);
  const revenueUsd = paid.filter((p: any) => String(p.currency || "").toUpperCase() === "USD")
    .reduce((sum: number, p: any) => sum + Number(p.amount_usd ?? p.amount ?? 0), 0);
  const recommendationImpressions = Number(metrics.engagement?.recommendation_impressions || 0);
  const recommendationClicks = Number(metrics.engagement?.recommendation_clicks || 0);
  return json({
    generated_at: new Date().toISOString(),
    engagement: {
      recommendation_impressions: recommendationImpressions,
      recommendation_clicks: recommendationClicks,
      recommendation_ctr: recommendationImpressions ? (recommendationClicks / recommendationImpressions) * 100 : 0,
      engaged_reads: Number(metrics.engagement?.engaged_reads || 0),
      return_visits: Number(metrics.engagement?.return_visits || 0),
      returning_sessions: Number(metrics.engagement?.returning_sessions || 0),
      search_events: Number(metrics.engagement?.search_events || 0),
      external_source_clicks: Number(metrics.engagement?.external_source_clicks || 0),
    },
    overview: {
      page_views: Number(metrics.page_views || 0),
      unique_sessions: Number(metrics.unique_sessions || 0),
      article_opens: Number(metrics.article_opens || 0),
      shares: Number(metrics.shares || 0),
      saves: Number(metrics.saves || 0),
      sponsor_clicks: Number(metrics.sponsor_clicks || 0),
      advertiser_leads: Number(metrics.advertiser_leads || 0),
      newsletter_subscribers: Number(metrics.newsletter_subscribers || 0),
      paid_revenue_naira: revenueNaira,
      paid_revenue_usd: revenueUsd,
      pending_payments: Number(metrics.pending_payments || 0),
    },
    daily: metrics.daily || [],
    sources: metrics.sources || [],
    countries: metrics.countries || [],
    cities: metrics.cities || [],
    devices: metrics.devices || [],
    browsers: metrics.browsers || [],
    top_paths: metrics.top_paths || [],
    sponsors: (sponsors.data || []).map((s:any)=>({ ...s, clicks: clickMap.get(String(s.id)) || 0 })),
    leads: leads.data || [],
    payments: payments.data || [],
    articles: articles.data || [],
    top_articles: (metrics.top_articles || []).map((item:any) => ({ ...item, article: (articles.data || []).find((a:any)=>String(a.id)===String(item.id)) || null })),
    audit_logs: (await database.from("admin_audit_logs").select("id,action,entity_type,entity_id,details,created_at").order("created_at",{ascending:false}).limit(100)).data || [],
  });
};
