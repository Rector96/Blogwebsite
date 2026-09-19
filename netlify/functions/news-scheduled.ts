import { runIngest } from "./news";

export default async (req: Request) => {
  try {
    const result = await runIngest();
    console.log("[RWDNEWS] scheduled ingest", {
      count: result.articles.length,
      saved: result.saved,
      generatedAt: result.generatedAt,
    });
  } catch (error) {
    console.error("[RWDNEWS] scheduled ingest failed", error);
  }
};

export const config = { schedule: "*/5 * * * *" };
