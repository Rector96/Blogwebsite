/**
 * Safe image policy for RWDNEWS
 * 1) Licensed stock matching the HEADLINE keywords (Pexels, then Unsplash)
 * 2) Optional RSS feed thumbnail (hotlink only — never re-hosted as ours)
 * 3) RWDNEWS logo placeholder
 *
 * We do NOT scrape publisher og:image HTML or claim ownership of their photos.
 */

const PLACEHOLDER = "https://rwdnews.netlify.app/rwdnews-logo.svg";

const STOP = new Set([
  "the","and","for","with","from","that","this","after","before","into","over","under",
  "about","will","would","could","should","says","said","have","has","been","are","was",
  "were","their","they","them","than","then","what","when","where","while","which","who",
  "how","why","new","latest","news","report","reports","according","amid","more","most",
  "just","only","also","been","being","very","much","many","some","such","like",
]);

const CATEGORY_FALLBACK = {
  Sports: "football stadium crowd",
  Tech: "technology laptop abstract",
  Business: "business finance city",
  Crypto: "cryptocurrency digital",
  Entertainment: "stage concert lights",
  Nigeria: "lagos nigeria city skyline",
  Ghana: "accra ghana africa",
  Africa: "africa city landscape",
  World: "world city skyline news",
  Europe: "europe city architecture",
  Asia: "asia city skyline",
  "Middle East": "middle east city",
};

export function headlineImageQuery(title, category) {
  const raw = String(title || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 4 && !STOP.has(w))
    .slice(0, 5);
  const base = raw.join(" ").trim();
  if (base) return base;
  return CATEGORY_FALLBACK[category] || "news journalism desk";
}

async function pexelsSearch(query) {
  const key = process.env.PEXELS_API_KEY || process.env.PEXELS_KEY || process.env.PEXELS_API || "";
  if (!key) return null;
  try {
    const u = new URL("https://api.pexels.com/v1/search");
    u.searchParams.set("query", query);
    u.searchParams.set("per_page", "1");
    u.searchParams.set("orientation", "landscape");
    const r = await fetch(u.toString(), {
      headers: { Authorization: key, Accept: "application/json" },
      signal: AbortSignal.timeout(4500),
    });
    if (!r.ok) return null;
    const data = await r.json();
    const photo = Array.isArray(data?.photos) ? data.photos[0] : null;
    const url = photo?.src?.large || photo?.src?.medium || "";
    if (!url) return null;
    return {
      image: String(url),
      image_credit: photo?.photographer
        ? `Photo: ${photo.photographer} / Pexels`
        : "Pexels",
      image_license: "Pexels License",
    };
  } catch {
    return null;
  }
}

async function unsplashSearch(query) {
  const key = process.env.UNSPLASH_ACCESS_KEY || "";
  if (!key) return null;
  try {
    const u = `https://api.unsplash.com/photos/random?query=${encodeURIComponent(query)}&orientation=landscape&content_filter=high`;
    const r = await fetch(u, {
      headers: { Authorization: `Client-ID ${key}`, "Accept-Version": "v1" },
      signal: AbortSignal.timeout(4500),
    });
    if (!r.ok) return null;
    const data = await r.json();
    const url = data?.urls?.regular || data?.urls?.small || "";
    if (!url) return null;
    return {
      image: String(url),
      image_credit: data?.user?.name ? `Photo: ${data.user.name} / Unsplash` : "Unsplash",
      image_license: "Unsplash License",
    };
  } catch {
    return null;
  }
}

/**
 * @param {{ title?: string, category?: string, rssImage?: string, preferStock?: boolean }}
 */
export async function resolveSafeCover({ title = "", category = "World", rssImage = "", preferStock = true } = {}) {
  const query = headlineImageQuery(title, category);

  if (preferStock) {
    const pexels = await pexelsSearch(query);
    if (pexels) return pexels;
    const unsplash = await unsplashSearch(query);
    if (unsplash) return unsplash;
  }

  // RSS thumbnail only as hotlink — credit as feed preview, not our photo
  if (rssImage && /^https?:\/\//i.test(rssImage) && !/rwdnews-logo/i.test(rssImage)) {
    return {
      image: String(rssImage),
      image_credit: "Publisher feed",
      image_license: "Feed preview",
    };
  }

  if (!preferStock) {
    const pexels = await pexelsSearch(query);
    if (pexels) return pexels;
    const unsplash = await unsplashSearch(query);
    if (unsplash) return unsplash;
  }

  return {
    image: PLACEHOLDER,
    image_credit: "RWDNEWS",
    image_license: "Site asset",
  };
}

export { PLACEHOLDER };
