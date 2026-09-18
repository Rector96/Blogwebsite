import { createClient } from "@supabase/supabase-js";
import { createHmac, timingSafeEqual } from "node:crypto";

function env(name: string) { return Netlify.env.get(name) || ""; }
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
  if (!env("ADMIN_SESSION_SECRET")) throw new Error("ADMIN_SESSION_SECRET is not configured.");
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

export default async (req: Request) => {
  const database = db();
  if (!database) return new Response(JSON.stringify({ error: "Admin database is not configured. Check SUPABASE_URL/VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in Netlify." }), { status: 503, headers: { "content-type": "application/json" } });

  if (req.method === "POST") {
    const body = await req.json().catch(() => ({}));
    if (body.action === "login") {
      const password = env("ADMIN_PASSWORD");
      const sessionSecret = env("ADMIN_SESSION_SECRET");
      if (!password || !sessionSecret) {
        return new Response(JSON.stringify({ error: "Admin login is not configured. Check ADMIN_PASSWORD and ADMIN_SESSION_SECRET in Netlify for the Production environment, then redeploy." }), { status: 503, headers: { "content-type": "application/json" } });
      }
      if (String(body.password || "") !== password) {
        return new Response(JSON.stringify({ error: "Invalid password. Use the exact ADMIN_PASSWORD value saved in Netlify." }), { status: 401, headers: { "content-type": "application/json" } });
      }
      return new Response(JSON.stringify({ ok: true }), { headers: { "content-type": "application/json", "set-cookie": sessionCookie() } });
    }
    if (!authorized(req)) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { "content-type": "application/json" } });
    if (body.action === "logout") return new Response(JSON.stringify({ ok: true }), { headers: { "content-type": "application/json", "set-cookie": "rwdnews_admin=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0" } });
    if (body.action === "sponsor_status") {
      const { error } = await database.from("sponsors").update({ active: Boolean(body.active), updated_at: new Date().toISOString() }).eq("id", String(body.id));
      if (error) return new Response(JSON.stringify({ error: error.message }), { status: 400, headers: { "content-type": "application/json" } });
      return Response.json({ ok: true });
    }
    if (body.action === "lead_status") {
      const { error } = await database.from("sales_leads").update({ status: String(body.status) }).eq("id", String(body.id));
      if (error) return new Response(JSON.stringify({ error: error.message }), { status: 400, headers: { "content-type": "application/json" } });
      return Response.json({ ok: true });
    }
    return new Response(JSON.stringify({ error: "Unknown action" }), { status: 400, headers: { "content-type": "application/json" } });
  }

  if (!authorized(req)) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { "content-type": "application/json" } });

  const [sponsors, leads, events] = await Promise.all([
    database.from("sponsors").select("id,sponsor_name,headline,placement,active,monthly_fee_usd").order("priority", { ascending: true }),
    database.from("sales_leads").select("id,name,email,company,message,status,created_at").order("created_at", { ascending: false }).limit(100),
    database.from("rwdnews_events").select("event_name,created_at").order("created_at", { ascending: false }).limit(5000),
  ]);

  if (sponsors.error || leads.error || events.error) {
    return new Response(JSON.stringify({ error: sponsors.error?.message || leads.error?.message || events.error?.message }), { status: 400, headers: { "content-type": "application/json" } });
  }

  const eventMap = new Map<string, { event_name: string; day: string; event_count: number }>();
  for (const row of events.data || []) {
    const day = String(row.created_at).slice(0, 10);
    const key = String(row.event_name) + "|" + day;
    const existing = eventMap.get(key);
    if (existing) existing.event_count += 1;
    else eventMap.set(key, { event_name: String(row.event_name), day, event_count: 1 });
  }

  return Response.json({ sponsors: sponsors.data || [], leads: leads.data || [], events: Array.from(eventMap.values()) });
};
