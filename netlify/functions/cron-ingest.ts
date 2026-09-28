import { runIngest } from "./news";
import { dispatchToMake } from "./social-dispatch.mjs";

export async function handler(event: {
  headers?: Record<string, string | undefined>;
  queryStringParameters?: Record<string, string | undefined> | null;
}) {
  const secret = process.env["CRON_SECRET"] || "";
  const auth = event.headers?.authorization || event.headers?.Authorization || "";
  const supplied =
    auth.replace(/^Bearer\s+/i, "") || event.queryStringParameters?.secret || "";

  if (!secret || supplied !== secret) {
    return {
      statusCode: 401,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ok: false, error: "Unauthorized" }),
    };
  }

  try {
    const result = await runIngest();
    const articles = Array.isArray(result)
      ? result
      : Array.isArray((result as any)?.articles)
        ? (result as any).articles
        : [];
    const saved =
      typeof (result as any)?.saved === "number" ? (result as any).saved : articles.length;
    const generatedAt =
      typeof (result as any)?.generatedAt === "string"
        ? (result as any).generatedAt
        : new Date().toISOString();

    // Social: send a few top stories to Make.com (if MAKE_WEBHOOK_URL is set)
    let social: unknown = { skipped: true };
    try {
      // Prefer highest trend / freshest
      const ranked = [...articles].sort(
        (a: any, b: any) =>
          Number(b.trend_score || 0) - Number(a.trend_score || 0) ||
          Date.parse(b.timestamp || 0) - Date.parse(a.timestamp || 0),
      );
      social = await dispatchToMake(ranked);
    } catch (e) {
      social = {
        ok: false,
        error: e instanceof Error ? e.message : "social dispatch failed",
      };
    }

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ok: true,
        count: articles.length,
        saved,
        generatedAt,
        social,
      }),
    };
  } catch (error) {
    console.error("[RockBrief] cron ingest failed", error);
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ok: false,
        error: error instanceof Error ? error.message : "Ingest failed",
      }),
    };
  }
}
