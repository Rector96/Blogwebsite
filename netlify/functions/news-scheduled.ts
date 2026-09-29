import type { Config } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";
import { generateDevelopingUpdate, runIngest } from "./news";
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
    .split(/\s+/)
    .filter((x) => x.length >= 5 && !stop.has(x));
  return [...new Set(tokens)].slice(0, 5).sort().join("-");
}

async function syncStoryClusters(articles: Article[]) {
  const db = dbClient();
  if (!db || !articles.length) return { clusters: 0, updates: 0 };

  const grouped = new Map<string, Article[]>();
  for (const article of articles) {
    const key = clusterKey(article);
    if (!key) continue;
    const list = grouped.get(key) || [];
    list.push(article);
    grouped.set(key, list);
  }

  let updates = 0;
  const keys = [...grouped.keys()].slice(0, 60);
  let existingRows: any[] = [];
  try {
    const { data } = await db.from("bot_story_clusters").select("*").in("cluster_key", keys);
    existingRows = Array.isArray(data) ? data : [];
  } catch (error) {
    console.error("[RockBrief Bot] cluster read failed", error);
  }
  const existing = new Map(existingRows.map((row) => [String(row.cluster_key), row]));

  const rows = [...grouped.entries()].map(([key, members]) => {
    const best = [...members].sort((a, b) => Number(b.trend_score || 0) - Number(a.trend_score || 0))[0];
    const sources = [...new Set(members.flatMap((a) => Array.isArray(a.discovered_via) ? a.discovered_via : [a.source]).filter(Boolean).map(String))];
    const previous = existing.get(key);
    const previousSources = Array.isArray(previous?.sources) ? previous.sources.map(String) : [];
    const hasNewSource = sources.some((source) => !previousSources.includes(source));
    const shouldUpdate = Boolean(previous) && (members.length > Number(previous.member_count || 0) || hasNewSource);
    if (shouldUpdate) updates++;

    return {
      cluster_key: key,
      canonical_article_id: String(best.id),
      canonical_title: String(best.ai_hook_title || best.original_title || ""),
      source_count: sources.length,
      sources,
      member_count: members.length,
      trend_score: Number(best.trend_score || 0),
      trend_label: String(best.trend_label || "Fresh"),
      first_seen: previous?.first_seen || new Date().toISOString(),
      last_seen: new Date().toISOString(),
      update_needed: shouldUpdate || Boolean(previous?.update_needed),
      metadata: {
        category: String(best.category || "World"),
        region: String(best.region || "Global"),
        latest_source: String(best.source || ""),
      },
    };
  });

  try {
    if (rows.length) await db.from("bot_story_clusters").upsert(rows, { onConflict: "cluster_key" });
  } catch (error) {
    console.error("[RockBrief Bot] cluster write failed", error);
  }
  return { clusters: rows.length, updates };
}

async function applyDevelopingUpdates(articles: Article[]) {
  const db = dbClient();
  if (!db || !articles.length) return { checked: 0, updated: 0 };

  const { data: clusters } = await db
    .from("bot_story_clusters")
    .select("*")
    .eq("update_needed", true)
    .order("trend_score", { ascending: false })
    .limit(8);
  if (!Array.isArray(clusters) || !clusters.length) return { checked: 0, updated: 0 };

  let updated = 0;
  for (const cluster of clusters) {
    const canonicalId = String(cluster.canonical_article_id || "");
    const current = articles.find((a) => String(a.id) === canonicalId);
    if (!current?.body) continue;

    const reports = articles
      .filter((a) => clusterKey(a) === String(cluster.cluster_key))
      .sort((a, b) => Date.parse(b.timestamp || "") - Date.parse(a.timestamp || ""))
      .slice(0, 6)
      .map((a) => ({
        title: String(a.original_title || a.ai_hook_title || ""),
        description: String(a.original_description || a.ai_summary?.join(" ") || ""),
        source: String(a.source || ""),
        timestamp: String(a.timestamp || ""),
      }));

    const result = await generateDevelopingUpdate({
      title: String(current.ai_hook_title || current.original_title || ""),
      previousBody: String(current.body || ""),
      reports,
    });
    if (!result) {
      await db.from("bot_story_clusters").update({
        update_needed: false,
      }).eq("cluster_key", String(cluster.cluster_key));
      continue;
    }

    const nextTimestamp = new Date().toISOString();
    const updateRecord = {
      cluster_key: String(cluster.cluster_key),
      article_id: canonicalId,
      previous_title: String(current.ai_hook_title || current.original_title || ""),
      new_title: result.updated_title,
      summary: result.update_summary,
      source_count: Number(cluster.source_count || reports.length),
      created_at: nextTimestamp,
    };

    const { error: articleError } = await db
      .from("articles")
      .update({
        ai_hook_title: result.updated_title,
        body: result.updated_body,
        timestamp: nextTimestamp,
        trend_score: Number(cluster.trend_score || current.trend_score || 0),
        trend_label: String(cluster.trend_label || current.trend_label || "Developing"),
        discovered_via: Array.isArray(cluster.sources) ? cluster.sources : current.discovered_via,
      })
      .eq("id", canonicalId);

    if (articleError) {
      console.error("[RockBrief Bot] article update failed", articleError.message);
      continue;
    }

    await db.from("bot_story_updates").insert(updateRecord);
    await db.from("bot_story_clusters").update({
      update_needed: false,
      last_updated_at: nextTimestamp,
    }).eq("cluster_key", String(cluster.cluster_key));
    updated++;
  }

  return { checked: clusters.length, updated };
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

async function refreshBotPerformance() {
  const db = dbClient();
  if (!db) return { tracked: 0, performance: new Map<string, number>() };

  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  try {
    const { data: candidates } = await db
      .from("bot_story_candidates")
      .select("article_id,trend_score")
      .order("updated_at", { ascending: false })
      .limit(250);
    const ids = (candidates || []).map((row: any) => String(row.article_id)).filter(Boolean);
    if (!ids.length) return { tracked: 0, performance: new Map<string, number>() };

    const [{ data: events }, { data: social }] = await Promise.all([
      db.from("rwdnews_events")
        .select("article_id,event_name,created_at")
        .in("article_id", ids)
        .gte("created_at", since)
        .limit(10000),
      db.from("social_posts")
        .select("article_id,platform,status,event_key,updated_at")
        .in("article_id", ids)
        .gte("updated_at", since)
        .limit(5000),
    ]);

    const eventMap = new Map<string, Record<string, number>>();
    for (const row of events || []) {
      const id = String(row.article_id || "");
      if (!id) continue;
      const bucket = eventMap.get(id) || {};
      const name = String(row.event_name || "unknown");
      bucket[name] = (bucket[name] || 0) + 1;
      eventMap.set(id, bucket);
    }

    const socialMap = new Map<string, Record<string, number>>();
    for (const row of social || []) {
      const id = String(row.article_id || "");
      if (!id) continue;
      const bucket = socialMap.get(id) || { sent: 0, failed: 0 };
      if (row.status === "sent") bucket.sent++;
      if (row.status === "failed") bucket.failed++;
      socialMap.set(id, bucket);
    }

    const rows = ids.map((articleId) => {
      const e = eventMap.get(articleId) || {};
      const s = socialMap.get(articleId) || { sent: 0, failed: 0 };
      const views = Number(e.page_view || 0);
      const opens = Number(e.article_open || 0);
      const shares = Number(e.article_share || 0);
      const saves = Number(e.article_save || 0);
      const engaged = Number(e.reading_engaged || 0);
      const returning = Number(e.return_visit || 0);
      const weightedEngagement = opens + shares * 4 + saves * 3 + engaged * 5 + returning * 2;
      const engagementRate = views > 0 ? Math.min(1, weightedEngagement / views) : 0;
      const deliveryTotal = s.sent + s.failed;
      const deliveryRate = deliveryTotal > 0 ? s.sent / deliveryTotal : 0;
      const performanceScore = Math.round(Math.min(100, engagementRate * 85 + deliveryRate * 15));
      return {
        article_id: articleId,
        window_start: since,
        page_views: views,
        article_opens: opens,
        shares,
        saves,
        engaged_reads: engaged,
        return_visits: returning,
        social_sent: s.sent,
        social_failed: s.failed,
        engagement_rate: Number(engagementRate.toFixed(4)),
        delivery_rate: Number(deliveryRate.toFixed(4)),
        performance_score: performanceScore,
        metrics: { views, opens, shares, saves, engaged, returning, weightedEngagement },
        updated_at: new Date().toISOString(),
      };
    });

    await db.from("bot_story_performance").upsert(rows, { onConflict: "article_id,window_start" });

    const performance = new Map<string, number>();
    for (const row of rows) performance.set(row.article_id, Number(row.performance_score || 0));

    for (const row of rows) {
      await db.from("bot_story_candidates")
        .update({ performance_score: row.performance_score })
        .eq("article_id", row.article_id);
    }

    return { tracked: rows.length, performance };
  } catch (error) {
    console.error("[RockBrief Bot] performance refresh failed", error);
    return { tracked: 0, performance: new Map<string, number>() };
  }
}

async function recordSocialResults(results: any[]) {
  const db = dbClient();
  if (!db || !results.length) return;
  try {
    const rows = results.map((r) => ({
      article_id: String(r.id),
      event_key: String(r.event_key || "initial"),
      platform: String(r.platform || "make"),
      status: r.ok ? "sent" : "failed",
      response_code: Number(r.status || 0) || null,
      error_message: r.ok ? null : String(r.error || "Social dispatch failed"),
      sent_at: r.ok ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    }));
    await db.from("social_posts").upsert(rows, { onConflict: "article_id,platform,event_key" });
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
    const clusterMetrics = await syncStoryClusters(articles);
    const updateMetrics = await applyDevelopingUpdates(articles);
    await recordCandidates(articles);
    const performanceMetrics = await refreshBotPerformance();

    const threshold = Math.max(0, Math.min(100, Number(process.env.BOT_AUTO_SOCIAL_TREND_THRESHOLD || 65)));
    const maxPosts = Math.max(1, Math.min(10, Number(process.env.SOCIAL_MAX_POSTS || 3)));
    const posted = await getUnpostedIds(articles);

    const clusterMap = new Map<string, Article>();
    for (const article of articles) {
      const key = clusterKey(article);
      if (!key) continue;
      const previous = clusterMap.get(key);
      if (!previous || Number(article.trend_score || 0) > Number(previous.trend_score || 0)) {
        clusterMap.set(key, article);
      }
    }

    const ranked = [...clusterMap.values()]
      .filter((a: Article) => {
        const score = Number(a.trend_score || 0);
        const ageHours = (Date.now() - Date.parse(a.timestamp || "")) / 3600000;
        return score >= threshold && ageHours >= -1 && ageHours <= 36 && !posted.has(String(a.id));
      })
      .sort(
        (a: Article, b: Article) =>
          Number(b.trend_score || 0) - Number(a.trend_score || 0) ||
          Number(performanceMetrics.performance.get(String(b.id)) || 0) - Number(performanceMetrics.performance.get(String(a.id)) || 0) ||
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
      clusters: clusterMetrics.clusters,
      storyUpdatesDetected: clusterMetrics.updates,
      storiesCheckedForUpdate: updateMetrics.checked,
      storiesUpdated: updateMetrics.updated,
      performanceTracked: performanceMetrics.tracked,
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
