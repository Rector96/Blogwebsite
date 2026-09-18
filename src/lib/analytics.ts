import { isSupabaseConfigured, supabase } from "./supabase";

const SESSION_KEY = "rwdnews_session_v1";

function getSessionId() {
  if (typeof window === "undefined") return "server";
  try {
    const existing = window.localStorage.getItem(SESSION_KEY);
    if (existing) return existing;
    const id =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : Math.random().toString(36).slice(2) + Date.now().toString(36);
    window.localStorage.setItem(SESSION_KEY, id);
    return id;
  } catch {
    return "anonymous";
  }
}

export type RwdNewsEvent = {
  event:
    | "article_open"
    | "article_share"
    | "article_save"
    | "newsletter_signup"
    | "sponsor_click"
    | "advertise_open";
  articleId?: string;
  articleUrl?: string;
  placement?: string;
};

export async function logRwdNewsEvent(input: RwdNewsEvent) {
  if (!isSupabaseConfigured || !supabase) return;
  try {
    await supabase.from("rwdnews_events").insert({
      event_name: input.event,
      article_id: input.articleId || null,
      article_url: input.articleUrl || null,
      placement: input.placement || null,
      page_path: typeof window !== "undefined" ? window.location.pathname : "/",
      referrer:
        typeof document !== "undefined" ? document.referrer.slice(0, 500) : null,
      session_id: getSessionId(),
    });
  } catch {
    // Analytics must never block the reading experience.
  }
}
