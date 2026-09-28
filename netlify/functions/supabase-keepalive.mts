import type { Config } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";

export default async () => {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  if (!url || !key) {
    console.warn("[RockBrief] Supabase keepalive skipped: database credentials are not configured.");
    return;
  }
  const db = createClient(url, key);
  const { error } = await db.from("articles").select("id", { count: "exact", head: true });
  if (error) throw error;
  console.log("[RockBrief] Supabase keepalive successful.");
};

export const config: Config = {
  schedule: "0 */12 * * *",
};
