/**
 * RockBrief intelligence helpers — result-oriented enrichment for every story.
 * Used by news ingest + social dispatch. No Make.com dependency.
 */

export function cleanText(value) {
  return String(value || "")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Build multi-network share pack from a publishable article. */
export function buildSharePack(article, siteBase = "https://rwdnews.netlify.app") {
  const title = cleanText(article.ai_hook_title || article.original_title || "");
  const bullets = Array.isArray(article.ai_summary)
    ? article.ai_summary.map(cleanText).filter(Boolean).slice(0, 3)
    : [];
  const slug = title
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 90);
  const url = `${String(siteBase).replace(/\/$/, "")}/news/${slug}--${encodeURIComponent(String(article.id || ""))}`;
  const hook = bullets[0] || cleanText(article.original_description || "").slice(0, 180);
  const tags = Array.isArray(article.tags)
    ? article.tags.map(String).slice(0, 3).join(" ")
    : "#RockBrief";

  const x = `${title.slice(0, 200)}\n\n${url}`.slice(0, 280);
  const facebook = [title, "", hook, "", `Read the full briefing → ${url}`, "", tags].join("\n").slice(0, 1800);
  const whatsapp = `*RockBrief*\n${title}\n\n${hook}\n\n${url}`;
  const linkedin = `${title}\n\n${hook}\n\nFull analysis: ${url}`;

  return { url, x, facebook, whatsapp, linkedin, title, hook, tags };
}

/** Append Africa / emerging-markets lens to body if model returned one. */
export function mergeAfricaLensIntoBody(body, africaLens) {
  const b = cleanText(body);
  const lens = cleanText(africaLens);
  if (!lens || lens.length < 40) return body || "";
  if (/why (this|it) matters (in|for) africa/i.test(b)) return body || "";
  const section =
    "\n\n## Why this matters in Africa\n\n" +
    lens +
    "\n\n*RockBrief Africa desk — context for readers across the continent and diaspora.*";
  return (body || "") + section;
}

/** 60-second audio script from title + bullets + first body para. */
export function buildAudioScript(article) {
  const title = cleanText(article.ai_hook_title || article.original_title || "");
  const bullets = Array.isArray(article.ai_summary)
    ? article.ai_summary.map(cleanText).filter(Boolean).slice(0, 3)
    : [];
  const body = cleanText(String(article.body || "").replace(/##[^
]+/g, " ")).slice(0, 400);
  const parts = [
    `RockBrief. ${title}.`,
    bullets.length ? bullets.join(" ") : body,
    "Full report on RockBrief. Sources credited.",
  ];
  return parts.join(" ").replace(/\s+/g, " ").trim().slice(0, 900);
}

/** Extract "Why this matters in Africa" block from stored HTML/markdown body. */
export function extractAfricaLensFromBody(body) {
  const raw = String(body || "");
  const m = raw.match(/##\s*Why this matters in Africa\s*([\s\S]*?)(?=##\s|$)/i);
  if (!m) return "";
  return cleanText(m[1]).slice(0, 1200);
}

/** Rank articles for a user preference profile (client or server). */
export function rankForYou(articles, prefs) {
  const list = Array.isArray(articles) ? [...articles] : [];
  const cats = new Set((prefs?.categories || []).map(String));
  const tags = new Set((prefs?.tags || []).map((t) => String(t).toLowerCase()));
  const now = Date.now();
  return list
    .map((a) => {
      let score = Number(a.trend_score || 0);
      const ageH = Math.max(0, (now - Date.parse(a.timestamp || 0)) / 3600000);
      score += Math.max(0, 30 - ageH);
      if (cats.has(String(a.category || ""))) score += 40;
      const atags = Array.isArray(a.tags) ? a.tags.map((t) => String(t).toLowerCase()) : [];
      if (atags.some((t) => tags.has(t) || [...tags].some((p) => t.includes(p)))) score += 20;
      if (prefs?.sportsBoost && /sport|football|soccer/i.test(`${a.category} ${a.ai_hook_title}`))
        score += 25;
      if (prefs?.africaBoost && /africa|nigeria|ghana|kenya/i.test(`${a.category} ${a.region} ${a.ai_hook_title}`))
        score += 25;
      return { a, score };
    })
    .sort((x, y) => y.score - x.score)
    .map((x) => x.a);
}
