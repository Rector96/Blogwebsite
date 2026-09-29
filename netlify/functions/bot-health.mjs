import type { Config } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";

function dbClient() {
  const url = process.env["SUPABASE_URL"] || process.env["VITE_SUPABASE_URL"] || "";
  const key = process.env["SUPABASE_SERVICE_ROLE_KEY"] || "";
  return url && key ? createClient(url, key) : null;
}

export default async function handler() {
  const db = dbClient();
  if (!db) {
    return { statusCode: 503, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ok: false, status: "unconfigured", reason: "Supabase service credentials are not configured" }) };
  }

  const staleMinutes = Math.max(60, Number(process.env.BOT_HEALTH_STALE_MINUTES || 180));
  const since = new Date(Date.now() - staleMinutes * 60_000).toISOString();

  try {
    const [{ data: latest }, { data: recentFailures }, { data: pendingUpdates }, { data: candidates }] = await Promise.all([
      db.from("bot_runs").select("id,status,metrics,error_message,created_at").order("created_at", { ascending: false }).limit(1),
      db.from("bot_runs").select("status,error_message,created_at").eq("status", "failed").gte("created_at", since).order("created_at", { ascending: false }).limit(5),
      db.from("bot_story_clusters").select("cluster_key,trend_score,update_needed,last_seen").eq("update_needed", true).order("trend_score", { ascending: false }).limit(10),
      db.from("bot_story_candidates").select("article_id,trend_score,performance_score,updated_at").order("updated_at", { ascending: false }).limit(10),
    ]);

    const last = latest?.[0] || null;
    const stale = !last || new Date(String(last.created_at)).getTime() < Date.now() - staleMinutes * 60_000;
    const failed = recentFailures?.length || 0;
    const status = failed > 0 ? "degraded" : stale ? "stale" : last?.status === "success" ? "healthy" : "unknown";

    return {
      statusCode: status === "healthy" ? 200 : 503,
      headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
      body: JSON.stringify({
        ok: status === "healthy",
        bot: "RockBrief News Bot",
        status,
        checkedAt: new Date().toISOString(),
        staleMinutes,
        lastRun: last,
        recentFailures: recentFailures || [],
        pendingDevelopingUpdates: pendingUpdates || [],
        recentCandidates: candidates || [],
      }),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Health check failed";
    return { statusCode: 503, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" }, body: JSON.stringify({ ok: false, bot: "RockBrief News Bot", status: "error", error: message }) };
  }
}

export const config: Config = { path: "/api/bot-health" };
