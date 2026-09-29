import type { Config } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";
import { runIngest } from "./news";
import { dispatchToMake } from "./social-dispatch.mjs";

type Article = Record<string, any>;

function dbClient() {
  const url = process.env["SUPABASE_URL"] || process.env["VITE_SUPABASE_URL"] || "";
  const key = process.env["SUPABASE_SERVICE_ROLE_KEY"] || "";
  return url && key ? createClient(url, key) : null;
}

async function recordBotRun(status: string, metrics: Record<string, any>, errorMessage = "") {
  const db = dbClient();
  if (!db) return;
  try {
    await db.from("bot_runs").insert({
      bot_name: "RockBrief News Bot",
      status,
      metrics,
      error_message: errorMessage || null,
    });
  } catch (error) {
    console.error("[RockBrief Bot] run log failed", error);
  }
}

async function getUnpostedIds(articles: Article[]) {
  const db = dbClient();
  if (!db || !articles.length) return new Set<string>();
  try {
    const ids = articles.map((a) => String(a.id)).filter(Boolean);
    const { data } = await db
      .from("social_posts")
      .select("article_id")
      .in("article_id", ids)
      .eq("status", "sent");
    return new Set((data || []).map((row: any) => String(row.article_id)));
  } catch {
    return new Set<string>();
  }
}

function clusterKey(article: Article) {
  const stop = new Set(["the","and","for","with","from","that","this","after","about","into","over","said","news","report","reports","latest","today","official"]);
  const tokens = String(article.title || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\\s+/)
    .filter((x) => x.length >= 5 && !stop.has(x));
  return [...new Set(tokens)].slice(0, 5).sort().join("-");
}

async function recordCandidates(articles: Article[]) {
  const db = dbClient();
  if (!db || !articles.length) return;
  const rows = articles
    .filter((a) => a?.id && a?.original_url)
    .slice(0, 30)
    .map((a) => ({
      article_id: String(a.id),
      original_url: String(a.original_url),
      title: String(a.ai_hook_title || a.original_title || ""),
      trend_score: Number(a.trend_score || 0),
      trend_label: String(a.trend_label || "Fresh"),
      source: String(a.source || ""),
      discovered_via: Array.isArray(a.discovered_via) ? a.discovered_via : [],
      decision: Number(a.trend_score || 0) >= Number(process.env.BOT_AUTO_SOCIAL_TREND_THRESHOLD || 65)
        ? "social_candidate"
        : "monitor",
      cluster_key: clusterKey(a),
      cluster_title: String(a.ai_hook_title || a.original_title || ""),
      cluster_sources: Array.isArray(a.discovered_via) ? a.discovered_via : [],
      cluster_size: Array.isArray(a.discovered_via) ? Math.max(1, a.discovered_via.length) : 1,
      updated_at: new Date().toISOString(),
    }));
  try {
    await db.from("bot_story_candidates").upsert(rows, { onConflict: "article_id" });
  } catch (error) {
    console.error("[RockBrief Bot] candidate log failed", error);
  }
}

async function recordSocialResults(results: any[]) {
  const db = dbClient();
  if (!db || !results.length) return;
  try {
    const rows = results.map((r) => ({
      article_id: String(r.id),
      platform: "make",
      status: r.ok ? "sent" : "failed",
      response_code: Number(r.status || 0) || null,
      error_message: r.ok ? null : String(r.error || "Social dispatch failed"),
      sent_at: r.ok ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    }));
    await db.from("social_posts").upsert(rows, { onConflict: "article_id,platform" });
  } catch (error) {
    console.error("[RockBrief Bot] social log failed", error);
  }
}

export default async function handler() {
  const startedAt = Date.now();
  try {
    // Phase A: ingest -> score -> persist candidates -> select only fresh, high-trend stories.
    // Existing runIngest remains the publishing engine; this layer adds bot intelligence
    // without replacing the proven ingestion/image/grounding pipeline.
    const result = await runIngest();
    const articles = Array.isArray(result.articles) ? result.articles : [];
    await recordCandidates(articles);

    const threshold = Math.max(0, Math.min(100, Number(process.env.BOT_AUTO_SOCIAL_TREND_THRESHOLD || 65)));
    const maxPosts = Math.max(1, Math.min(10, Number(process.env.SOCIAL_MAX_POSTS || 3)));
    const posted = await getUnpostedIds(articles);

    const ranked = [...articles]
      .filter((a: Article) => {
        const score = Number(a.trend_score || 0);
        const ageHours = (Date.now() - Date.parse(a.timestamp || "")) / 3600000;
        return score >= threshold && ageHours >= -1 && ageHours <= 36 && !posted.has(String(a.id));
      })
      .sort(
        (a: Article, b: Article) =>
          Number(b.trend_score || 0) - Number(a.trend_score || 0) ||
          Date.parse(b.timestamp || 0) - Date.parse(a.timestamp || 0),
      )
      .slice(0, maxPosts);

    let social: any = { skipped: true, reason: "no fresh high-trend candidates" };
    if (ranked.length) {
      try {
        social = await dispatchToMake(ranked);
        if (Array.isArray(social?.results)) await recordSocialResults(social.results);
      } catch (error) {
        social = { ok: false, error: error instanceof Error ? error.message : "social dispatch failed" };
      }
    }

    const metrics = {
      saved: result.saved,
      scanned: articles.length,
      candidates: ranked.length,
      threshold,
      social,
      durationMs: Date.now() - startedAt,
      generatedAt: result.generatedAt,
    };
    await recordBotRun("success", metrics);
    console.log("[RockBrief Bot] cycle complete", metrics);

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ok: true, bot: "RockBrief News Bot", ...metrics }),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Scheduled bot failed";
    await recordBotRun("failed", { durationMs: Date.now() - startedAt }, message);
    console.error("[RockBrief Bot] cycle failed", error);
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ok: false, bot: "RockBrief News Bot", error: message }),
    };
  }
}

export const config: Config = {
  schedule: "0 * * * *",
};
