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
function sessionToken() {
  const payload = Buffer.from(JSON.stringify({ exp: Date.now() + 1000 * 60 * 60 * 12 })).toString("base64url");
  return payload + "." + signature(payload);
}
function authorized(req: Request) {
  const bearer = req.headers.get("authorization") || "";
  const bearerToken = bearer.match(/^Bearer\s+(.+)$/i)?.[1] || "";
  const cookie = req.headers.get("cookie") || "";
  const cookieToken = cookie.match(/(?:^|;\s*)rwdnews_admin=([^;]+)/)?.[1] || "";
  const token = bearerToken || cookieToken;
  if (!token) return false;
  const parts = token.split(".");
  if (parts.length !== 2) return false;
  const [payload, sig] = parts;
  const expected = signature(payload);
  if (sig.length !== expected.length) return false;
  try {
    if (!timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return false;
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    return Number(parsed.exp) > Date.now();
  } catch {
    return false;
  }
}
function clean(value: unknown, max = 500) {
  return String(value ?? "").trim().slice(0, max);
}
function articleWordCount(html: string) {
  return clean(String(html || "").replace(/<[^>]*>/g, " ").replace(/&nbsp;/gi, " "), 100000)
    .split(/\s+/)
    .filter(Boolean).length;
}
function readingTime(words: number) {
  return `${Math.max(1, Math.ceil(words / 180))} min read`;
}
function addMonthsIso(startIso: string, months: number) {
  const d = new Date(startIso);
  d.setMonth(d.getMonth() + Math.max(1, Math.floor(Number(months) || 1)));
  return d.toISOString();
}
async function audit(database: any, action: string, entityType?: string, entityId?: string, details: Record<string, unknown> = {}) {
  await database.from("admin_audit_logs").insert({
    action,
    entity_type: entityType || null,
    entity_id: entityId || null,
    details,
  });
}

const ALLOWED_STORY_TYPES = [
  "WIRE",
  "RockBrief ORIGINAL",
  "RWDNEWS ORIGINAL",
  "DEVELOPING",
  "EXPLAINER",
  "BIO",
  "PROFILE",
  "FEATURE",
  "COMMENTARY",
];
const ALLOWED_CATEGORIES = [
  "Business",
  "World",
  "Europe",
  "Middle East",
  "Asia",
  "Africa",
  "Nigeria",
  "Ghana",
  "Sports",
  "Tech",
  "Crypto",
  "Entertainment",
  "Explainers",
  "Profiles",
];
const ALLOWED_REGIONS = [
  "Global",
  "Africa",
  "Nigeria",
  "Ghana",
  "Europe",
  "Middle East",
  "Asia",
  "North America",
  "South America",
];

export default async (req: Request) => {
  if (req.method === "POST") {
    const body = await req.json().catch(() => ({}));

    if (body.action === "login") {
      const password = env("ADMIN_PASSWORD");
      if (!password || !env("ADMIN_SESSION_SECRET"))
        return json({ error: "Admin login is not configured in Netlify." }, 503);
      if (String(body.password || "") !== password) return json({ error: "Invalid password." }, 401);
      const token = sessionToken();
      return json(
        { ok: true, session_token: token },
        200,
        {
          "set-cookie":
            "rwdnews_admin=" + token + "; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=43200",
          "cache-control": "no-store",
        },
      );
    }

    if (!authorized(req)) return json({ error: "Unauthorized" }, 401, { "cache-control": "no-store" });
    const database = db();
    if (!database)
      return json({ error: "Admin database is not configured. Check Supabase URL and service role key." }, 503);
    if (body.action === "logout")
      return json(
        { ok: true },
        200,
        { "set-cookie": "rwdnews_admin=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0" },
      );

    if (body.action === "article_get") {
      const id = clean(body.id, 200);
      if (!id) return json({ error: "Article ID is required." }, 400);
      const { data, error } = await database.from("articles").select("*").eq("id", id).maybeSingle();
      if (error) return json({ error: error.message }, 400);
      if (!data) return json({ error: "Article not found." }, 404);
      return json({ ok: true, article: data });
    }

    if (body.action === "article_image_upload") {
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
      const path =
        "articles/" +
        new Date().toISOString().slice(0, 10) +
        "/" +
        Date.now().toString(36) +
        "-" +
        filename.replace(/\.[^.]+$/, "") +
        "." +
        ext;
      const { error } = await database.storage.from("rwdnews-images").upload(path, bytes, {
        contentType: mime,
        cacheControl: "31536000",
        upsert: false,
      });
      if (error) return json({ error: error.message }, 400);
      const { data: pub } = database.storage.from("rwdnews-images").getPublicUrl(path);
      await audit(database, "article_image_uploaded", "article_image", path, { mime, bytes: bytes.length });
      return json({ ok: true, url: pub.publicUrl, path });
    }

    if (body.action === "article_create") {
      const headline = clean(body.headline, 220);
      const description = clean(body.description, 1000);
      const bodyText = sanitizeArticleHtmlServer(String(body.body ?? "").trim().slice(0, 30000));
      const bodyWords = articleWordCount(bodyText);
      const image = clean(body.image, 2000);
      const originalUrl = clean(body.original_url, 1000);
      const category = clean(body.category || "Business", 50);
      const region = clean(body.region || "Global", 50);
      const storyType = clean(body.story_type || "RockBrief ORIGINAL", 40);
      const subject = clean(body.subject, 180);
      const authorName = clean(body.author_name || "RockBrief Editorial", 120);
      const imageCredit = clean(body.image_credit || "RockBrief", 180);
      const imageLicense = clean(body.image_license || "Owned or licensed by RockBrief", 240);
      const imageSourceUrl = clean(body.image_source_url || originalUrl, 1000);
      const status = ["published", "hidden", "archived", "draft", "pending"].includes(
        String(body.editorial_status),
      )
        ? String(body.editorial_status)
        : "draft";
      if (!headline || !description || !bodyText || !image || !/^https?:\/\//i.test(image))
        return json(
          { error: "Headline, description, article body and a valid image URL are required." },
          400,
        );
      if ((status === "published" || status === "pending") && bodyWords < 400)
        return json(
          { error: `Published stories require at least 400 words. Current count: ${bodyWords}.` },
          400,
        );
      if (originalUrl && !/^https?:\/\//i.test(originalUrl))
        return json({ error: "Original/source URL must be a valid URL." }, 400);
      if (!ALLOWED_CATEGORIES.includes(category)) return json({ error: "Invalid category." }, 400);
      if (!ALLOWED_REGIONS.includes(region)) return json({ error: "Invalid region." }, 400);
      if (!ALLOWED_STORY_TYPES.includes(storyType))
        return json({ error: "Invalid story type." }, 400);
      const timestamp =
        body.publish_at && !Number.isNaN(Date.parse(String(body.publish_at)))
          ? new Date(String(body.publish_at)).toISOString()
          : new Date().toISOString();
      const id = "original-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8);
      const editorialStatus =
        status === "draft" || status === "pending" ? "hidden" : status === "published" ? "published" : status;
      const { data, error } = await database
        .from("articles")
        .insert({
          id,
          original_url: originalUrl || "https://rwdnews.local/original/" + id,
          original_title: headline,
          original_description: description,
          ai_hook_title: headline,
          ai_summary: [description],
          tags: Array.isArray(body.tags)
            ? body.tags.map((x: unknown) => "#" + clean(x, 40).replace(/^#/, "")).filter(Boolean).slice(0, 8)
            : [],
          source:
            storyType === "RockBrief ORIGINAL" || storyType === "EXPLAINER" || storyType === "BIO"
              ? "RockBrief"
              : clean(body.source || "RockBrief", 120),
          image,
          read_time: readingTime(bodyWords),
          timestamp,
          editorial_status: editorialStatus,
          featured: Boolean(body.featured),
          pinned: Boolean(body.pinned),
          story_type: storyType,
          body: bodyText,
          category,
          region,
          subject,
          author_name: authorName,
          image_credit: imageCredit,
          image_license: imageLicense,
          image_source_url: imageSourceUrl,
          published_by: "admin",
        })
        .select("id")
        .single();
      if (error) return json({ error: error.message }, 400);
      await audit(database, "article_created", "article", String(data?.id), {
        story_type: storyType,
        category,
        region,
      });
      return json({ ok: true, id: data?.id });
    }

    if (body.action === "article_update") {
      const id = clean(body.id, 200);
      const patch: Record<string, unknown> = {};
      if (typeof body.featured === "boolean") patch.featured = body.featured;
      if (typeof body.pinned === "boolean") patch.pinned = body.pinned;
      if (["published", "hidden", "archived"].includes(String(body.editorial_status)))
        patch.editorial_status = body.editorial_status;
      if (String(body.editorial_status) === "draft" || String(body.editorial_status) === "pending")
        patch.editorial_status = "hidden";
      const current =
        typeof body.body === "string" || typeof body.editorial_status === "string"
          ? (await database.from("articles").select("editorial_status").eq("id", id).maybeSingle()).data
          : null;
      const textFields = [
        "headline",
        "description",
        "body",
        "image",
        "category",
        "region",
        "story_type",
        "subject",
        "author_name",
        "image_credit",
        "image_license",
        "image_source_url",
        "original_url",
      ] as const;
      for (const field of textFields) {
        if (typeof body[field] === "string") {
          const value =
            field === "body"
              ? sanitizeArticleHtmlServer(String(body[field]).slice(0, 100000))
              : clean(body[field], 2000);
          if (field === "headline") patch.original_title = value;
          else if (field === "description") patch.original_description = value;
          else patch[field] = value;
        }
      }
      if (typeof body.story_type === "string" && !ALLOWED_STORY_TYPES.includes(String(patch.story_type)))
        return json({ error: "Invalid story type." }, 400);
      if (typeof body.category === "string" && !ALLOWED_CATEGORIES.includes(String(patch.category)))
        return json({ error: "Invalid category." }, 400);
      if (typeof body.body === "string") {
        const words = articleWordCount(String(patch.body || ""));
        const targetStatus = String(body.editorial_status || current?.editorial_status || "published");
        if (targetStatus === "published" && words < 400)
          return json(
            { error: `Published stories require at least 400 words. Current count: ${words}.` },
            400,
          );
        patch.read_time = readingTime(words);
      }
      if (Array.isArray(body.tags))
        patch.tags = body.tags
          .map((x: unknown) => "#" + clean(x, 80).replace(/^#/, ""))
          .filter(Boolean)
          .slice(0, 20);
      if (typeof body.publish_at === "string" && !Number.isNaN(Date.parse(body.publish_at)))
        patch.timestamp = new Date(body.publish_at).toISOString();
      const { error } = await database.from("articles").update(patch).eq("id", id);
      if (error) return json({ error: error.message }, 400);
      await audit(database, "article_updated", "article", id, patch);
      return json({ ok: true });
    }

    if (body.action === "sponsor_create") {
      const sponsorName = clean(body.sponsor_name, 120);
      const headline = clean(body.headline, 180);
      const ctaUrl = clean(body.cta_url, 500);
      if (!sponsorName || !headline || !/^https?:\/\//i.test(ctaUrl))
        return json({ error: "Sponsor name, headline and a valid website URL are required." }, 400);
      const slug =
        sponsorName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 70) +
        "-" +
        Date.now().toString(36);
      const amount = Number(body.amount || 0);
      const durationMonths = Math.max(1, Math.min(12, Math.floor(Number(body.duration_months) || 1)));
      const placement = clean(body.placement || "sidebar", 30);
      if (!["sidebar", "in_feed", "both"].includes(placement))
        return json({ error: "Invalid sponsor placement." }, 400);
      if (!Number.isFinite(amount) || amount <= 0)
        return json({ error: "Monthly sponsor fee must be greater than zero." }, 400);
      const { data, error } = await database
        .from("sponsors")
        .insert({
          slug,
          sponsor_name: sponsorName,
          headline,
          why_matters: [],
          cta_text: clean(body.cta_text || "Learn more", 80),
          cta_url: ctaUrl,
          rate_highlight: "",
          disclosure: clean(body.disclosure || "Sponsored · Paid placement", 160),
          placement,
          priority: Number(body.priority || 100),
          currency: "USD",
          monthly_fee_usd: amount || null,
          monthly_fee_naira: null,
          duration_months: durationMonths,
          active: false,
          starts_at: body.starts_at || new Date().toISOString(),
          ends_at: body.ends_at || addMonthsIso(new Date().toISOString(), durationMonths),
        })
        .select("id")
        .single();
      if (error) return json({ error: error.message }, 400);
      await audit(database, "sponsor_created", "sponsor", String(data?.id), {
        sponsor_name: sponsorName,
      });
      return json({ ok: true });
    }

    if (body.action === "sponsor_status") {
      const id = clean(body.id, 100);
      const active = Boolean(body.active);
      const sponsorRow = (await database.from("sponsors").select("duration_months").eq("id", id).maybeSingle())
        .data;
      const now = new Date();
      const durationMonths = Math.max(1, Math.min(12, Number(sponsorRow?.duration_months || 1)));
      const patch = active
        ? {
            active: true,
            starts_at: now.toISOString(),
            ends_at: addMonthsIso(now.toISOString(), durationMonths),
            updated_at: now.toISOString(),
          }
        : { active: false, updated_at: now.toISOString() };
      const { error } = await database.from("sponsors").update(patch).eq("id", id);
      if (error) return json({ error: error.message }, 400);
      await audit(database, active ? "sponsor_activated" : "sponsor_paused", "sponsor", id, {});
      return json({ ok: true });
    }

    if (body.action === "lead_status") {
      const id = clean(body.id, 100);
      const status = clean(body.status, 30);
      if (!["new", "contacted", "won", "lost"].includes(status))
        return json({ error: "Invalid lead status." }, 400);
      const { error } = await database.from("sales_leads").update({ status }).eq("id", id);
      if (error) return json({ error: error.message }, 400);
      await audit(database, "lead_status_changed", "sales_lead", id, { status });
      return json({ ok: true });
    }

    return json({ error: "Unknown action" }, 400);
  }

  if (!authorized(req)) return json({ error: "Unauthorized" }, 401, { "cache-control": "no-store" });
  const database = db();
  if (!database) return json({ error: "Admin database is not configured." }, 503);

  const since = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();
  const [articles, sponsors, leads, payments, audit_logs] = await Promise.all([
    database
      .from("articles")
      .select("id,original_title,ai_hook_title,category,story_type,editorial_status,timestamp,featured,pinned")
      .order("timestamp", { ascending: false })
      .limit(100),
    database.from("sponsors").select("*").order("created_at", { ascending: false }).limit(50),
    database.from("sales_leads").select("*").order("created_at", { ascending: false }).limit(50),
    database.from("sponsor_payments").select("*").order("created_at", { ascending: false }).limit(50),
    database
      .from("admin_audit_logs")
      .select("id,action,entity_type,entity_id,details,created_at")
      .order("created_at", { ascending: false })
      .limit(100),
  ]);

  return json({
    generated_at: new Date().toISOString(),
    overview: {
      articles: articles.data?.length || 0,
      sponsors: sponsors.data?.length || 0,
      leads: leads.data?.length || 0,
      payments: payments.data?.length || 0,
    },
    articles: articles.data || [],
    sponsors: sponsors.data || [],
    leads: leads.data || [],
    payments: payments.data || [],
    audit_logs: audit_logs.data || [],
    daily: [],
    sources: [],
    countries: [],
    cities: [],
    devices: [],
    browsers: [],
    top_paths: [],
    top_articles: [],
  });
};
