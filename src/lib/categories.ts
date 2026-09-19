/** Canonical homepage category tabs */
export const CANONICAL_CATEGORIES = [
  "Breaking",
  "World",
  "Nigeria",
  "Ghana",
  "Africa",
  "Europe",
  "Middle East",
  "Asia",
  "Sports",
  "Business",
  "Tech",
  "Crypto",
  "Entertainment",
] as const;

export type CanonicalCategory = (typeof CANONICAL_CATEGORIES)[number] | "All";

const SPORT_RE =
  /\b(sport|sports|football|soccer|premier league|champions league|uefa|fifa|nba|nfl|mlb|nhl|tennis|cricket|formula\s?1|f1|olympics|athletics|match|fixture|goalkeeper|midfielder|striker|basketball|baseball|rugby|wrestling|boxing|ufc|mma|transfer window|league table|scoreline|full-?time|half-?time)\b/i;

const TECH_RE =
  /\b(ai|artificial intelligence|chip|semiconductor|software|cyber|robot|technology|tech|startup|app store|iphone|android|google|microsoft|apple|meta)\b/i;

const CRYPTO_RE =
  /\b(bitcoin|crypto|ethereum|blockchain|token|defi|nft|binance|coinbase)\b/i;

const BUSINESS_RE =
  /\b(market|markets|stock|stocks|bank|banking|economy|economic|finance|financial|oil|trade|company|companies|revenue|profit|gdp|inflation|interest rate|central bank)\b/i;

const ENTERTAINMENT_RE =
  /\b(movie|film|music|celebrity|actor|actress|nollywood|actress|wedding|marriage|divorce|award|oscar|grammy|netflix|series|tv show)\b/i;

function blobOf(article: {
  category?: string;
  tags?: string[];
  ai_hook_title?: string;
  original_title?: string;
  original_description?: string;
  source?: string;
}) {
  const tags = (article.tags || []).map((t) => String(t).replace(/^#/, "")).join(" ");
  return [
    article.category || "",
    tags,
    article.ai_hook_title || "",
    article.original_title || "",
    article.original_description || "",
    article.source || "",
  ]
    .join(" ")
    .toLowerCase();
}

/** Infer a better category when feed metadata is missing or wrong */
export function inferCategory(article: {
  category?: string;
  tags?: string[];
  ai_hook_title?: string;
  original_title?: string;
  original_description?: string;
  source?: string;
}): string {
  const raw = String(article.category || "").trim();
  const blob = blobOf(article);

  if (SPORT_RE.test(blob) || /espn|bbc sport|guardian sport/i.test(article.source || ""))
    return "Sports";
  if (CRYPTO_RE.test(blob)) return "Crypto";
  if (TECH_RE.test(blob)) return "Tech";
  if (ENTERTAINMENT_RE.test(blob)) return "Entertainment";
  if (/\b(nigeria|nigerian|lagos|abuja)\b/i.test(blob)) return "Nigeria";
  if (/\b(ghana|ghanaian|accra)\b/i.test(blob)) return "Ghana";
  if (/\b(africa|african|kenya|egypt|south africa)\b/i.test(blob)) return "Africa";
  if (BUSINESS_RE.test(blob)) return "Business";
  if (/\b(europe|eu |britain|uk |france|germany|ukraine)\b/i.test(blob)) return "Europe";
  if (/\b(middle east|israel|gaza|iran|saudi|uae)\b/i.test(blob)) return "Middle East";
  if (/\b(asia|china|india|japan|korea)\b/i.test(blob)) return "Asia";

  if (raw && raw !== "Business") return raw;
  return raw || "World";
}

/** Strict tab filter: All = everything; other tabs = that category only */
export function matchesCategory(
  article: {
    category?: string;
    tags?: string[];
    ai_hook_title?: string;
    original_title?: string;
    original_description?: string;
    source?: string;
    trend_label?: string;
  },
  selected: string,
): boolean {
  if (!selected || selected === "All") return true;
  if (selected === "Breaking") {
    return article.trend_label === "Breaking" || article.trend_label === "Trending";
  }

  const inferred = inferCategory(article);
  if (inferred === selected) return true;

  const stored = String(article.category || "").trim();
  if (stored.toLowerCase() === selected.toLowerCase()) return true;

  const tags = (article.tags || []).map((t) => String(t).replace(/^#/, "").toLowerCase());
  if (tags.includes(selected.toLowerCase())) return true;

  if (selected === "Sports") return SPORT_RE.test(blobOf(article));

  return false;
}
