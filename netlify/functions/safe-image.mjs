/**
 * Subject-aware cover images for RockBrief.
 *
 * Order (legal / free only — no publisher scrape):
 * 1) Known football club crest (curated Wikimedia)
 * 2) Wikimedia Commons search for person / place / subject
 * 3) Pexels (headline, then category)
 * 4) Unsplash if key present
 * 5) RSS feed thumbnail (hotlink credit only)
 * 6) Site logo placeholder
 */

const PLACEHOLDER = "https://rwdnews.netlify.app/rwdnews-logo.svg";

const CATEGORY_QUERY = {
  Sports: "football stadium match crowd",
  Tech: "technology laptop circuit board",
  Business: "business finance office skyline",
  Crypto: "cryptocurrency bitcoin digital",
  Entertainment: "concert stage lights",
  Nigeria: "lagos nigeria city africa",
  Ghana: "accra ghana africa city",
  Africa: "africa city landscape",
  World: "world city skyline news",
  Europe: "europe city architecture",
  Asia: "asia city skyline",
  "Middle East": "middle east city",
};

/** Curated club crests — Wikimedia Commons URLs only. */
const CLUB_CRESTS = {
  arsenal: {
    image: "https://upload.wikimedia.org/wikipedia/en/5/53/Arsenal_FC.svg",
    credit: "Arsenal F.C. crest / Wikimedia",
    license: "Trademark display for news identification",
  },
  chelsea: {
    image: "https://upload.wikimedia.org/wikipedia/en/c/cc/Chelsea_FC.svg",
    credit: "Chelsea F.C. crest / Wikimedia",
    license: "Trademark display for news identification",
  },
  liverpool: {
    image: "https://upload.wikimedia.org/wikipedia/en/0/0c/Liverpool_FC.svg",
    credit: "Liverpool F.C. crest / Wikimedia",
    license: "Trademark display for news identification",
  },
  "man city": {
    image: "https://upload.wikimedia.org/wikipedia/en/e/eb/Manchester_City_FC_badge.svg",
    credit: "Manchester City crest / Wikimedia",
    license: "Trademark display for news identification",
  },
  "manchester city": {
    image: "https://upload.wikimedia.org/wikipedia/en/e/eb/Manchester_City_FC_badge.svg",
    credit: "Manchester City crest / Wikimedia",
    license: "Trademark display for news identification",
  },
  "man united": {
    image: "https://upload.wikimedia.org/wikipedia/en/7/7a/Manchester_United_FC_crest.svg",
    credit: "Manchester United crest / Wikimedia",
    license: "Trademark display for news identification",
  },
  "manchester united": {
    image: "https://upload.wikimedia.org/wikipedia/en/7/7a/Manchester_United_FC_crest.svg",
    credit: "Manchester United crest / Wikimedia",
    license: "Trademark display for news identification",
  },
  tottenham: {
    image: "https://upload.wikimedia.org/wikipedia/en/b/b4/Tottenham_Hotspur.svg",
    credit: "Tottenham Hotspur crest / Wikimedia",
    license: "Trademark display for news identification",
  },
  barcelona: {
    image: "https://upload.wikimedia.org/wikipedia/en/4/47/FC_Barcelona_%28crest%29.svg",
    credit: "FC Barcelona crest / Wikimedia",
    license: "Trademark display for news identification",
  },
  "real madrid": {
    image: "https://upload.wikimedia.org/wikipedia/en/5/56/Real_Madrid_CF.svg",
    credit: "Real Madrid crest / Wikimedia",
    license: "Trademark display for news identification",
  },
  psg: {
    image: "https://upload.wikimedia.org/wikipedia/en/a/a7/Paris_Saint-Germain_F.C..svg",
    credit: "Paris Saint-Germain crest / Wikimedia",
    license: "Trademark display for news identification",
  },
  "paris saint-germain": {
    image: "https://upload.wikimedia.org/wikipedia/en/a/a7/Paris_Saint-Germain_F.C..svg",
    credit: "Paris Saint-Germain crest / Wikimedia",
    license: "Trademark display for news identification",
  },
  bayern: {
    image: "https://upload.wikimedia.org/wikipedia/commons/1/1b/FC_Bayern_M%C3%BCnchen_logo_%282017%29.svg",
    credit: "FC Bayern Munich crest / Wikimedia",
    license: "Trademark display for news identification",
  },
  "bayern munich": {
    image: "https://upload.wikimedia.org/wikipedia/commons/1/1b/FC_Bayern_M%C3%BCnchen_logo_%282017%29.svg",
    credit: "FC Bayern Munich crest / Wikimedia",
    license: "Trademark display for news identification",
  },
  dortmund: {
    image: "https://upload.wikimedia.org/wikipedia/commons/6/67/Borussia_Dortmund_logo.svg",
    credit: "Borussia Dortmund crest / Wikimedia",
    license: "Trademark display for news identification",
  },
  juventus: {
    image: "https://upload.wikimedia.org/wikipedia/commons/1/15/Juventus_FC_2017_logo.svg",
    credit: "Juventus crest / Wikimedia",
    license: "Trademark display for news identification",
  },
  inter: {
    image: "https://upload.wikimedia.org/wikipedia/commons/0/05/FC_Internazionale_Milano_2021.svg",
    credit: "Inter Milan crest / Wikimedia",
    license: "Trademark display for news identification",
  },
  nigeria: {
    image: "https://upload.wikimedia.org/wikipedia/commons/7/79/Flag_of_Nigeria.svg",
    credit: "Flag of Nigeria / Wikimedia",
    license: "Public domain",
  },
  "super eagles": {
    image: "https://upload.wikimedia.org/wikipedia/commons/7/79/Flag_of_Nigeria.svg",
    credit: "Flag of Nigeria / Wikimedia",
    license: "Public domain",
  },
  ghana: {
    image: "https://upload.wikimedia.org/wikipedia/commons/1/19/Flag_of_Ghana.svg",
    credit: "Flag of Ghana / Wikimedia",
    license: "Public domain",
  },
};

const STOP = new Set([
  "the", "and", "for", "with", "from", "that", "this", "after", "before", "into", "over",
  "about", "will", "would", "could", "should", "says", "said", "have", "has", "been",
  "are", "was", "were", "their", "they", "them", "than", "then", "what", "when", "where",
  "while", "which", "who", "how", "why", "new", "latest", "news", "report", "reports",
  "according", "amid", "more", "most", "just", "only", "also", "being", "very", "hints",
  "calls", "extends", "record", "unbeaten",
]);

function normalize(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanMeta(value) {
  return String(value || "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&[^;]+;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function metaValue(meta, keys) {
  for (const key of keys) {
    const value = meta?.[key]?.value;
    if (value) return cleanMeta(value);
  }
  return "";
}

export function detectClubCrest(text) {
  const n = " " + normalize(text) + " ";
  const keys = Object.keys(CLUB_CRESTS).sort((a, b) => b.length - a.length);
  for (const key of keys) {
    // Word-boundary style match so "interest" does not hit "inter"
    const needle = " " + key + " ";
    if (n.includes(needle)) {
      const crest = CLUB_CRESTS[key];
      return {
        image: crest.image,
        image_credit: crest.credit,
        image_license: crest.license,
        image_source_url: crest.image,
        subject: key,
      };
    }
  }
  return null;
}

export function extractImageSubject(title, preferredQuery = "", category = "World") {
  const preferred = String(preferredQuery || "").trim();
  if (preferred && preferred.length >= 3 && preferred.length <= 80) {
    return preferred;
  }

  const raw = String(title || "");
  const proper = raw.match(/\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,3})\b/g) || [];
  const filtered = proper
    .map((p) => p.trim())
    .filter((p) => {
      const low = p.toLowerCase();
      return !STOP.has(low) && p.length >= 4;
    });
  if (filtered.length) {
    return filtered.slice(0, 2).join(" ");
  }

  const words = normalize(title)
    .split(/\s+/)
    .filter((w) => w.length >= 4 && !STOP.has(w))
    .slice(0, 5);
  if (words.length >= 2) return words.join(" ");
  if (words.length === 1) return words[0];
  return CATEGORY_QUERY[category] || CATEGORY_QUERY.World;
}

export function headlineImageQuery(title, category) {
  return extractImageSubject(title, "", category);
}

async function commonsSearch(query) {
  const q = String(query || "").trim();
  if (!q || q.length < 3) return null;

  try {
    const u = new URL("https://commons.wikimedia.org/w/api.php");
    u.searchParams.set("action", "query");
    u.searchParams.set("format", "json");
    u.searchParams.set("generator", "search");
    u.searchParams.set("gsrsearch", q);
    u.searchParams.set("gsrnamespace", "6");
    u.searchParams.set("gsrlimit", "8");
    u.searchParams.set("prop", "imageinfo");
    u.searchParams.set("iiprop", "url|size|mime|extmetadata");
    u.searchParams.set("iiurlwidth", "1200");
    u.searchParams.set(
      "iiextmetadatafilter",
      "Artist|Credit|ImageDescription|LicenseShortName|UsageTerms|Categories|LicenseUrl",
    );

    const r = await fetch(u.toString(), {
      headers: {
        Accept: "application/json",
        "Api-User-Agent": "RockBrief/1.0 (https://rwdnews.netlify.app/; news covers)",
      },
      signal: AbortSignal.timeout(5000),
    });
    if (!r.ok) return null;

    const data = await r.json();
    const pages = Object.values(data?.query?.pages || {});
    const allowed =
      /^(CC0(?:\s|$)|CC BY-SA(?:\s|$)|CC BY(?:\s|$)|Public domain(?:\s|$)|PD(?:\s|$)|PDM(?:\s|$)|GFDL)/i;

    const terms = normalize(q)
      .split(/\s+/)
      .filter((t) => t.length >= 3 && !STOP.has(t));

    const scored = [];
    for (const page of pages) {
      const info = page?.imageinfo?.[0];
      if (!info) continue;
      const meta = info.extmetadata || {};
      const license = metaValue(meta, ["LicenseShortName", "UsageTerms"]);
      const artist = metaValue(meta, ["Artist", "Credit"]) || "Wikimedia Commons";
      const description = metaValue(meta, ["ImageDescription"]);
      const categories = metaValue(meta, ["Categories"]);
      const image = info.thumburl || info.url || "";
      const source = info.descriptionurl || "";

      if (!image || !/^https?:\/\//i.test(image)) continue;
      if (!/^image\//i.test(String(info.mime || ""))) continue;
      if (Number(info.width || 0) < 400) continue;
      if (license && !allowed.test(license)) continue;

      const hay = normalize([page.title, description, categories].join(" "));
      const hits = terms.filter((t) => hay.includes(t)).length;
      if (terms.length && hits < 1) continue;

      scored.push({
        image: String(image),
        image_credit: "Photo: " + artist + " / Wikimedia Commons",
        image_license: license || "Wikimedia Commons",
        image_source_url: String(source),
        hits,
      });
    }

    scored.sort((a, b) => b.hits - a.hits);
    return scored[0] || null;
  } catch {
    return null;
  }
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
 *   preferStock?: boolean,
 *   preferCrest?: boolean,
 * }} options
 */
export async function resolveSafeCover({
  title = "",
  category = "World",
  preferredQuery = "",
  rssImage = "",
  preferStock = true,
  preferCrest = true,
} = {}) {
  const haystack = [title, preferredQuery].filter(Boolean).join(" ");

  // 1) Club / national crest for sports identification
  if (preferCrest && (category === "Sports" || /football|soccer|premier|ucl|afcon|club|match/i.test(haystack))) {
    const crest = detectClubCrest(haystack);
    if (crest) return crest;
  }

  const subject = extractImageSubject(title, preferredQuery, category);

  // 2) Wikimedia Commons — real people / places when free photos exist
  const commons = await commonsSearch(subject);
  if (commons) return commons;

  const short = subject.split(/\s+/).slice(0, 2).join(" ");
  if (short && short !== subject) {
    const commons2 = await commonsSearch(short);
    if (commons2) return commons2;
  }

  // 3) Licensed stock
  if (preferStock) {
    const pexels = await pexelsSearch(subject);
    if (pexels) return pexels;

    const catQ = CATEGORY_QUERY[category] || CATEGORY_QUERY.World;
    if (catQ !== subject) {
      const p2 = await pexelsSearch(catQ);
      if (p2) return p2;
    }

    const unsplash = await unsplashSearch(subject);
    if (unsplash) return unsplash;

    const u2 = await unsplashSearch(catQ);
    if (u2) return u2;
  }

  // 4) RSS preview hotlink
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

export { PLACEHOLDER, CLUB_CRESTS, CATEGORY_QUERY };
