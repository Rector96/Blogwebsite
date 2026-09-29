import { readFileSync, existsSync } from "node:fs";

const requiredFiles = [
  "netlify/functions/news.ts",
  "netlify/functions/news-scheduled.ts",
  "netlify/functions/social-dispatch.mjs",
  "netlify/functions/safe-image.mjs",
  "netlify/functions/bot-health.mjs",
  "supabase_master.sql",
];

for (const file of requiredFiles) {
  if (!existsSync(file)) throw new Error(`Missing News Bot file: ${file}`);
}

const scheduler = readFileSync("netlify/functions/news-scheduled.ts", "utf8");
const news = readFileSync("netlify/functions/news.ts", "utf8");
const social = readFileSync("netlify/functions/social-dispatch.mjs", "utf8");
const health = readFileSync("netlify/functions/bot-health.mjs", "utf8");
const sql = readFileSync("supabase_master.sql", "utf8");

const checks = [
  [scheduler, "refreshBotPerformance", "performance feedback loop"],
  [scheduler, "applyDevelopingUpdates", "developing story updates"],
  [scheduler, "event_key", "event-aware social records"],
  [news, "validatePublishableArticle", "publication quality gate"],
  [news, "googleSearch", "grounded verification"],
  [social, "dispatchToMake", "social dispatch"],
  [social, "event_key", "social event propagation"],
  [health, "staleMinutes", "bot stale-run detection"],
  [health, "recentFailures", "bot failure visibility"],
  [health, "/api/bot-health", "bot health endpoint"],
  [sql, "bot_story_candidates", "candidate table"],
  [sql, "bot_story_performance", "performance table"],
  [sql, "bot_story_updates", "update table"],
];

for (const [source, needle, label] of checks) {
  if (!source.includes(needle)) throw new Error(`Smoke check failed: ${label}`);
}

console.log("RockBrief News Bot smoke checks passed.");
