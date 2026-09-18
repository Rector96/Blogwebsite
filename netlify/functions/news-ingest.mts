import type { Config } from "@netlify/functions";
import { runIngest } from "./news";

export default async () => {
  const result = await runIngest();
  console.log("[RWDNEWS] scheduled ingest", {
    count: result.articles.length,
    saved: result.saved,
    generatedAt: result.generatedAt,
  });
};

export const config: Config = {
  schedule: "*/30 * * * *",
};
