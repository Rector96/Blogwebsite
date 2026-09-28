import type { Config } from "@netlify/functions";
import { runIngest } from "./news";
import { dispatchToMake } from "./social-dispatch.mjs";

export default async function handler() {
  try {
    const result = await runIngest();
    const articles = Array.isArray(result.articles) ? result.articles : [];
    const ranked = [...articles].sort(
      (a: any, b: any) =>
        Number(b.trend_score || 0) - Number(a.trend_score || 0) ||
        Date.parse(b.timestamp || 0) - Date.parse(a.timestamp || 0),
    );
    let social: unknown = { skipped: true };
    try {
      social = await dispatchToMake(ranked);
    } catch (error) {
      social = { ok: false, error: error instanceof Error ? error.message : "social dispatch failed" };
    }
    console.log("[RockBrief] scheduled ingest successful.", {
      saved: result.saved,
      count: articles.length,
      generatedAt: result.generatedAt,
      social,
    });
    return {
      statusCode: 200,
      body: JSON.stringify({ ok: true, saved: result.saved, count: articles.length, generatedAt: result.generatedAt, social }),
    };
  } catch (error) {
    console.error("[RockBrief] scheduled ingest failed", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ ok: false, error: error instanceof Error ? error.message : "Scheduled ingest failed" }),
    };
  }
}

export const config: Config = {
  schedule: "0 * * * *",
};
