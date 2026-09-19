import { createClient } from "@supabase/supabase-js";
import { createHmac, timingSafeEqual } from "node:crypto";
import { env, json, SPONSOR_PACKAGES, paystackRequest } from "../../src/lib/paystack-server";

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
async function audit(database: any, action: string, entityType?: string, entityId?: string, details: Record<string, unknown> = {}) {
  await database.from("admin_audit_logs").insert({ action, entity_type: entityType || null, entity_id: entityId || null, details });
}

export default async (req: Request) => {
  const database = db();
  if (!database) return json({ error: "Admin database is not configured. Check Supabase URL and service role key." }, 503);

  if (req.method === "POST") {
    const body = await req.json().catch(() => ({}));

    if (body.action === "login") {
      const password = env("ADMIN_PASSWORD");
      if (!password || !env("ADMIN_SESSION_SECRET")) return json({ error: "Admin login is not configured in Netlify." }, 503);
      if (String(body.password || "") !== password) return json({ error: "Invalid password." }, 401);
      return json({ ok: true }, 200, { "set-cookie": sessionCookie() });
    }

    if (!authorized(req)) return json({ error: "Unauthorized" }, 401);
    if (body.action === "logout") return json({ ok: true }, 200, { "set-cookie": "rwdnews_admin=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0" });

    if (body.action === "sponsor_create") {
      const sponsorName = clean(body.sponsor_name, 120);
      const headline = clean(body.headline, 180);
      const ctaUrl = clean(body.cta_url, 500);
      if (!sponsorName || !headline || !/^https?:\/\//i.test(ctaUrl)) return json({ error: "Sponsor name, headline and a valid website URL are required." }, 400);
      const slug = sponsorName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 70) + "-" + Date.now().toString(36);
      const currency = String(body.currency || "USD").toUpperCase() === "NGN" ? "NGN" : "USD";
      const amount = Number(body.amount || 0);
      const placement = clean(body.placement || "sidebar", 30);
      if (!["sidebar", "in_feed", "both"].includes(placement)) return json({ error: "Invalid sponsor placement." }, 400);
      if (!Number.isFinite(amount) || amount <= 0) return json({ error: "Sponsor fee must be greater than zero." }, 400);
      const { data, error } = await database.from("sponsors").insert({
        slug, sponsor_name: sponsorName, headline, why_matters: [], cta_text: clean(body.cta_text || "Learn more", 80),
        cta_url: ctaUrl, rate_highlight: "", disclosure: clean(body.disclosure || "Sponsored · Paid placement", 160),
        placement, priority: Number(body.priority || 100),
        currency, monthly_fee_usd: currency === "USD" ? amount || null : null, monthly_fee_naira: currency === "NGN" ? amount || null : null,
        active: false, starts_at: body.starts_at || null, ends_at: body.ends_at || null,
      }).select("id").single();
      if (error) return json({ error: error.message }, 400);
      await audit(database, "sponsor_created", "sponsor", String(data?.id), { sponsor_name: sponsorName, amount, currency });
      return json({ ok: true });
    }

    if (body.action === "sponsor_status") {
      const id = clean(body.id, 100);
      const active = Boolean(body.active);
      const { error } = await database.from("sponsors").update({ active, updated_at: new Date().toISOString() }).eq("id", id);
      if (error) return json({ error: error.message }, 400);
      await audit(database, active ? "sponsor_activated" : "sponsor_paused", "sponsor", id);
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
      const bodyText = clean(body.body, 30000);
      const image = clean(body.image, 2000);
      const originalUrl = clean(body.original_url, 1000);
      const category = clean(body.category || "Business", 50);
      const region = clean(body.region || "Global", 50);
      const storyType = clean(body.story_type || "RWDNEWS ORIGINAL", 30);
      const subject = clean(body.subject, 180);
      const authorName = clean(body.author_name || "RWDNEWS Editorial", 120);
      const imageCredit = clean(body.image_credit || "RWDNEWS", 180);
      const imageLicense = clean(body.image_license || "Owned or licensed by RWDNEWS", 240);
      const imageSourceUrl = clean(body.image_source_url || originalUrl, 1000);
      const status = ["published","hidden","archived"].includes(String(body.editorial_status)) ? String(body.editorial_status) : "draft";
      if (!headline || !description || !bodyText || !image || !/^https?:\/\//i.test(image)) return json({ error: "Headline, description, article body and a valid image URL are required." }, 400);
      if (originalUrl && !/^https?:\/\//i.test(originalUrl)) return json({ error: "Original/source URL must be a valid URL." }, 400);
      if (!["Business","World","Europe","Middle East","Asia","Africa","Nigeria","Ghana","Sports","Tech","Crypto","Entertainment"].includes(category)) return json({ error: "Invalid category." }, 400);
      if (!["Global","Africa","Nigeria","Ghana","Europe","Middle East","Asia","North America","South America"].includes(region)) return json({ error: "Invalid region." }, 400);
      if (!["WIRE","RWDNEWS ORIGINAL","DEVELOPING"].includes(storyType)) return json({ error: "Invalid story type." }, 400);
      const timestamp = body.publish_at && !Number.isNaN(Date.parse(String(body.publish_at))) ? new Date(String(body.publish_at)).toISOString() : new Date().toISOString();
      const id = "original-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8);
      const slugSource = headline.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 90);
      const { data, error } = await database.from("articles").insert({
        id, original_url: originalUrl || ("https://rwdnews.local/original/" + id), original_title: headline,
        original_description: description, ai_hook_title: headline, ai_summary: [description],
        tags: Array.isArray(body.tags) ? body.tags.map((x: unknown) => "#" + clean(x, 40).replace(/^#/,"")).filter(Boolean).slice(0, 8) : [],
        source: storyType === "RWDNEWS ORIGINAL" ? "RWDNEWS" : clean(body.source || "RWDNEWS", 120),
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
      const starts = payment.starts_at || new Date().toISOString();
      const ends = payment.ends_at || new Date(Date.parse(starts) + Number(payment.duration_days || pkg?.days || 30) * 86400000).toISOString();
      let sponsorId = payment.sponsor_id as string | null;

      if (!sponsorId) {
        const sponsorName = clean(payment.company || payment.name || "RWDNEWS Advertiser", 120);
        const slug = sponsorName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 70) + "-" + Date.now().toString(36);
        const { data: sponsor, error } = await database.from("sponsors").insert({
          slug, sponsor_name: sponsorName, headline: clean(payment.headline || pkg?.name || "Sponsored placement", 180),
          why_matters: [], cta_text: "Learn more", cta_url: clean(payment.cta_url || "https://rwdnews.netlify.app", 500),
          rate_highlight: "Paid placement", disclosure: "Sponsored · Paid placement", placement: payment.placement || "sidebar",
          active: true, priority: 50, currency: payment.currency || "NGN", monthly_fee_usd: payment.currency === "USD" ? payment.amount : null, monthly_fee_naira: payment.currency === "NGN" ? payment.amount : null, starts_at: starts, ends_at: ends,
        }).select("id").single();
        if (error) return json({ error: error.message }, 400);
        sponsorId = sponsor?.id || null;
      } else {
        await database.from("sponsors").update({ active: true, starts_at: starts, ends_at: ends, currency: payment.currency || "NGN", monthly_fee_usd: payment.currency === "USD" ? payment.amount : null, monthly_fee_naira: payment.currency === "NGN" ? payment.amount : null, updated_at: new Date().toISOString() }).eq("id", sponsorId);
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
      const paymentRow = (await database.from("sponsor_payments").select("amount_subunit,amount_kobo,currency").eq("reference", reference).maybeSingle()).data;
      if (!paymentRow) return json({ error: "Payment reference not found." }, 404);
      const response = await paystackRequest("/transaction/verify/" + encodeURIComponent(reference));
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload?.status) return json({ error: payload?.message || "Paystack verification failed." }, 502);
      const expectedCurrency = String(paymentRow.currency || "NGN").toUpperCase();
      const expectedAmount = Number(paymentRow?.amount_subunit ?? paymentRow?.amount_kobo ?? 0);
      const amountOk = String(payload.data?.currency || "").toUpperCase() === expectedCurrency
        && Number(payload.data?.amount) === expectedAmount;
      const status = payload.data?.status === "success" && amountOk ? "paid" : (payload.data?.status === "failed" ? "failed" : "pending");
      await database.from("sponsor_payments").update({ status, paystack_status: String(payload.data?.status || ""), paystack_transaction_id: payload.data?.id ? String(payload.data.id) : null, paid_at: status === "paid" ? new Date().toISOString() : null, updated_at: new Date().toISOString() }).eq("reference", reference);
      await audit(database, "payment_verified", "sponsor_payment", reference, { status });
      return json({ ok: true, status });
    }

    return json({ error: "Unknown action" }, 400);
  }

  if (!authorized(req)) return json({ error: "Unauthorized" }, 401);

  const [sponsors, leads, events, payments, clicks, articles, newsletter] = await Promise.all([
    database.from("sponsors").select("id,sponsor_name,headline,placement,active,currency,monthly_fee_usd,monthly_fee_naira,starts_at,ends_at,priority").order("priority", { ascending: true }).limit(200),
    database.from("sales_leads").select("id,name,email,company,message,status,created_at").order("created_at", { ascending: false }).limit(100),
    database.from("rwdnews_events").select("event_name,article_id,page_path,source,country,city,device,browser,referrer,session_id,created_at").order("created_at", { ascending: false }).limit(20000),
    database.from("sponsor_payments").select("id,reference,package_code,package_name,currency,amount,amount_naira,amount_usd,email,name,company,status,paystack_status,sponsor_id,paid_at,created_at").order("created_at", { ascending: false }).limit(10000),
    database.from("sponsor_clicks").select("sponsor_id,sponsor_slug,placement,created_at").order("created_at", { ascending: false }).limit(10000),
    database.from("articles").select("id,original_title,ai_hook_title,source,timestamp,editorial_status,featured,pinned,story_type,category,region,subject,author_name,image").order("timestamp", { ascending: false }).limit(100),
    database.from("newsletter_subscribers").select("id,status,created_at").order("created_at", { ascending: false }).limit(10000),
  ]);

  const firstError = [sponsors, leads, events, payments, clicks, articles, newsletter].find((x) => x.error);
  if (firstError?.error) return json({ error: firstError.error.message }, 400);

  const rows = events.data || [];
  const pageViews = rows.filter((r: any) => r.event_name === "page_view");
  const sessions = new Set(pageViews.map((r: any) => r.session_id).filter(Boolean));
  const aggregate = (key: string) => {
    const map = new Map<string, number>();
    for (const row of pageViews) {
      const value = String(row[key] || "Unknown");
      map.set(value, (map.get(value) || 0) + 1);
    }
    return Array.from(map.entries()).map(([label, value]) => ({ label, value })).sort((a,b) => b.value-a.value).slice(0, 15);
  };
  const dailyMap = new Map<string, number>();
  for (const row of pageViews) {
    const day = String(row.created_at).slice(0, 10);
    dailyMap.set(day, (dailyMap.get(day) || 0) + 1);
  }
  const articleMap = new Map<string, number>();
  for (const row of rows.filter((r: any) => r.article_id && (r.event_name === "article_open" || r.event_name === "page_view"))) {
    const id = String(row.article_id);
    articleMap.set(id, (articleMap.get(id) || 0) + 1);
  }
  const clickMap = new Map<string, number>();
  for (const row of clicks.data || []) {
    const key = String(row.sponsor_id || row.sponsor_slug || "unknown");
    clickMap.set(key, (clickMap.get(key) || 0) + 1);
  }
  const paid = (payments.data || []).filter((p: any) => p.status === "paid");
  const revenue = paid.reduce((sum: number, p: any) => sum + Number(p.amount_naira || 0), 0);

  return json({
    generated_at: new Date().toISOString(),
    overview: {
      page_views: pageViews.length,
      unique_sessions: sessions.size,
      article_opens: rows.filter((r:any)=>r.event_name==="article_open").length,
      shares: rows.filter((r:any)=>r.event_name==="article_share").length,
      saves: rows.filter((r:any)=>r.event_name==="article_save").length,
      sponsor_clicks: (clicks.data || []).length,
      advertiser_leads: (leads.data || []).length,
      newsletter_subscribers: (newsletter.data || []).filter((n:any)=>n.status==="active").length,
      paid_revenue_naira: revenue,
      pending_payments: (payments.data || []).filter((p:any)=>p.status==="pending").length,
    },
    daily: Array.from(dailyMap.entries()).sort((a,b)=>a[0].localeCompare(b[0])).slice(-30).map(([day,value])=>({day,value})),
    sources: aggregate("source"),
    countries: aggregate("country"),
    cities: aggregate("city"),
    devices: aggregate("device"),
    browsers: aggregate("browser"),
    top_paths: aggregate("page_path"),
    sponsors: (sponsors.data || []).map((s:any)=>({ ...s, clicks: clickMap.get(String(s.id)) || 0 })),
    leads: leads.data || [],
    payments: payments.data || [],
    articles: articles.data || [],
    top_articles: Array.from(articleMap.entries()).sort((a,b)=>b[1]-a[1]).slice(0,15).map(([id,views])=>({ id, views, article: (articles.data || []).find((a:any)=>String(a.id)===id) || null })),
    audit_logs: (await database.from("admin_audit_logs").select("id,action,entity_type,entity_id,details,created_at").order("created_at",{ascending:false}).limit(100)).data || [],
  });
};
