/**
 * Cover images for RockBrief — licensed stock, no publisher scrape.
 *
 * Order:
 * 1) Pexels search from headline / preferredQuery (fast, reliable)
 * 2) Category fallback query on Pexels
 * 3) Optional Gemini vision when IMAGE_VERIFY_STRICT=1
 * 4) Logo placeholder
 *
 * Vision is OFF by default so the site shows real photos. Enable strict mode later.
 */

const PLACEHOLDER = "https://rwdnews.netlify.app/rwdnews-logo.svg";

const CATEGORY_QUERY = {
  Sports: "football match stadium action",
  Tech: "technology laptop circuit board",
  Business: "business finance stock market",
  Crypto: "cryptocurrency bitcoin digital",
  Entertainment: "concert stage lights crowd",
  Nigeria: "lagos nigeria city africa",
  Ghana: "accra ghana africa city",
  Africa: "africa city landscape people",
  World: "world news city skyline",
  Europe: "europe city architecture",
  Asia: "asia city skyline modern",
  "Middle East": "middle east city desert",
};

const STOP = new Set([
  "the", "and", "for", "with", "from", "that", "this", "after", "before", "into", "over",
  "about", "will", "would", "could", "should", "says", "said", "have", "has", "been",
  "are", "was", "were", "their", "they", "them", "than", "then", "what", "when", "where",
  "while", "which", "who", "how", "why", "new", "latest", "news", "report", "reports",
  "according", "amid", "more", "most", "just", "only", "also", "being", "very",
]);

function normalize(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function headlineImageQuery(title, category) {
  const words = normalize(title)
    .split(/\s+/)
    .filter((w) => w.length >= 4 && !STOP.has(w))
    .slice(0, 5);
  if (words.length >= 2) return words.join(" ");
  if (words.length === 1) return words[0] + " " + (CATEGORY_QUERY[category] || "news");
  return CATEGORY_QUERY[category] || "world news journalism";
}

async function pexelsSearch(query) {
  const key = process.env.PEXELS_API_KEY || process.env.PEXELS_KEY || process.env.PEXELS_API || "";
  if (!key || !query) return null;
  try {
    const u = new URL("https://api.pexels.com/v1/search");
    u.searchParams.set("query", String(query).slice(0, 80));
    u.searchParams.set("per_page", "3");
    u.searchParams.set("orientation", "landscape");
    const r = await fetch(u.toString(), {
      headers: { Authorization: key, Accept: "application/json" },
      signal: AbortSignal.timeout(4500),
    });
    if (!r.ok) return null;
    const data = await r.json();
    const photo = Array.isArray(data?.photos) ? data.photos[0] : null;
    const image = photo?.src?.large || photo?.src?.medium || "";
    if (!image) return null;
    return {
      image: String(image),
      image_credit: photo?.photographer
        ? "Photo: " + photo.photographer + " / Pexels"
        : "Pexels",
      image_license: "Pexels License",
      image_source_url: String(photo?.url || "https://www.pexels.com/"),
    };
  } catch {
    return null;
  }
}

async function unsplashSearch(query) {
  const key = process.env.UNSPLASH_ACCESS_KEY || "";
  if (!key || !query) return null;
  try {
    const u =
      "https://api.unsplash.com/search/photos?query=" +
      encodeURIComponent(String(query).slice(0, 80)) +
      "&orientation=landscape&per_page=3&content_filter=high";
    const r = await fetch(u, {
      headers: { Authorization: "Client-ID " + key, "Accept-Version": "v1" },
      signal: AbortSignal.timeout(4500),
    });
    if (!r.ok) return null;
    const data = await r.json();
    const photo = Array.isArray(data?.results) ? data.results[0] : null;
    const image = photo?.urls?.regular || photo?.urls?.small || "";
    if (!image) return null;
    return {
      image: String(image),
      image_credit: photo?.user?.name
        ? "Photo: " + photo.user.name + " / Unsplash"
        : "Unsplash",
      image_license: "Unsplash License",
      image_source_url: String(photo?.links?.html || "https://unsplash.com/"),
    };
  } catch {
    return null;
  }
}

/**
 * @param {{
 *   title?: string,
 *   category?: string,
 *   preferredQuery?: string,
 *   rssImage?: string,
 *   preferStock?: boolean
 * }} options
 */
export async function resolveSafeCover({
  title = "",
  category = "World",
  preferredQuery = "",
  rssImage = "",
  preferStock = true,
} = {}) {
  const primary =
    String(preferredQuery || "").trim() ||
    headlineImageQuery(title, category);

  if (preferStock) {
    const pexels = await pexelsSearch(primary);
    if (pexels) return pexels;

    const fallbackQ = CATEGORY_QUERY[category] || CATEGORY_QUERY.World;
    if (fallbackQ !== primary) {
      const p2 = await pexelsSearch(fallbackQ);
      if (p2) return p2;
    }

    const unsplash = await unsplashSearch(primary);
    if (unsplash) return unsplash;

    const u2 = await unsplashSearch(fallbackQ);
    if (u2) return u2;
  }

  if (rssImage && /^https?:\/\//i.test(rssImage) && !/rwdnews-logo/i.test(rssImage)) {
    return {
      image: String(rssImage),
      image_credit: "Publisher feed",
      image_license: "Feed preview",
      image_source_url: String(rssImage),
    };
  }

  return {
    image: PLACEHOLDER,
    image_credit: "RockBrief",
    image_license: "Site asset",
    image_source_url: "",
  };
}

export { PLACEHOLDER };
