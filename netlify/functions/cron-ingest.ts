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
    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ok: true,
        count: result.articles.length,
        saved: result.saved,
        generatedAt: result.generatedAt,
      }),
    };
  } catch (error) {
    console.error("[RWDNEWS] cron ingest failed", error);
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ok: false, error: "Ingest failed" }),
    };
  }
}
