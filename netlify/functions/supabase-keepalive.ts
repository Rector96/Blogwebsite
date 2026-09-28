import { createClient } from "@supabase/supabase-js";

export default async () => {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || "";

  if (!url || !key) {
    return new Response(JSON.stringify({ ok: false, error: "Supabase environment variables are not configured." }), {
      status: 503,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const database = createClient(url, key);
    const { error } = await database.from("articles").select("id").limit(1);
    if (error) throw error;

    return new Response(JSON.stringify({ ok: true, checked_at: new Date().toISOString() }), {
      status: 200,
      headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
    });
  } catch (error) {
    console.error("[RockBrief] Supabase keepalive failed", error);
    return new Response(JSON.stringify({
      ok: false,
      error: error instanceof Error ? error.message : "Supabase keepalive failed",
    }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};

export const config = {
  schedule: "0 */12 * * *",
};
