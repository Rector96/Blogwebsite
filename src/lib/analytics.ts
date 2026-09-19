const SESSION_KEY = "rwdnews_session_v1";

function getSessionId() {
  if (typeof window === "undefined") return "server";
  try {
    const existing = window.localStorage.getItem(SESSION_KEY);
    if (existing) return existing;
    const id = typeof crypto !== "undefined" && "randomUUID" in crypto
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
    | "page_view"
    | "article_open"
    | "article_share"
    | "article_save"
    | "newsletter_signup"
    | "sponsor_click"
    | "advertise_open"
    | "search"
    | "external_source_click"
    | "recommendation_impression"
    | "recommendation_click"
    | "reading_engaged"
    | "return_visit";
  articleId?: string;
  articleUrl?: string;
  placement?: string;
};

export async function logRwdNewsEvent(input: RwdNewsEvent) {
  try {
    await fetch("/api/track", {
      method: "POST",
      keepalive: true,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        ...input,
        session_id: getSessionId(),
        page_path: typeof window !== "undefined" ? window.location.pathname : "/",
        referrer: typeof document !== "undefined" ? document.referrer.slice(0, 500) : "",
      }),
    });
  } catch {
    /* Analytics must never block the reading experience. */
  }
}
