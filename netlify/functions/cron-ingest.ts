import { runIngest } from "./news";

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
    // Support both array return and { articles, saved, generatedAt }
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

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ok: true,
        count: articles.length,
        saved,
        generatedAt,
      }),
    };
  } catch (error) {
    console.error("[RWDNEWS] cron ingest failed", error);
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
