import { runIngest } from "./news";

export default async (req: Request) => {
  const secret = process.env.CRON_SECRET || "";
  const supplied =
    req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ||
    new URL(req.url).searchParams.get("secret") ||
    "";

  if (!secret || supplied !== secret) {
    return new Response(JSON.stringify({ ok: false, error: "Unauthorized" }), {
      status: 401,
      headers: { "content-type": "application/json" },
    });
  }

  try {
    const result = await runIngest();
    return new Response(
      JSON.stringify({
        ok: true,
        count: result.articles.length,
        saved: result.saved,
        generatedAt: result.generatedAt,
      }),
      { headers: { "content-type": "application/json" } },
    );
  } catch (error) {
    console.error("[RWDNEWS] cron ingest failed", error);
    return new Response(JSON.stringify({ ok: false, error: "Ingest failed" }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }
};
