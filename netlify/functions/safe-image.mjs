/**
 * Cover images for RockBrief.
 *
 * Order:
 * 1) RSS publisher image (matches the story)
 * 2) Known person / club crest map
 * 3) Wikimedia Commons (person/place only, relevance scored)
 * 4) Pexels / Unsplash category-safe stock
 * 5) Logo placeholder
 */

const PLACEHOLDER = "https://rwdnews.netlify.app/rwdnews-logo.svg";

const CATEGORY_QUERY = {
  Sports: "football match stadium",
  Tech: "technology smartphone laptop",
  Business: "business finance skyline",
  Crypto: "cryptocurrency bitcoin",
  Entertainment: "concert stage",
  Nigeria: "lagos nigeria city",
  Ghana: "accra ghana city",
  Africa: "africa city",
  World: "world news skyline",
  Europe: "europe city",
  Asia: "asia city skyline",
  "Middle East": "middle east city",
};

/** High-confidence people/places → Commons-friendly search (avoids random insects). */
const KNOWN_SUBJECTS = [
  ["donald trump", "Donald Trump"],
  ["trump", "Donald Trump"],
  ["joe biden", "Joe Biden"],
  ["biden", "Joe Biden"],
  ["kamala harris", "Kamala Harris"],
  ["vladimir putin", "Vladimir Putin"],
  ["putin", "Vladimir Putin"],
  ["volodymyr zelensky", "Volodymyr Zelenskyy"],
  ["zelensky", "Volodymyr Zelenskyy"],
  ["xi jinping", "Xi Jinping"],
  ["emmanuel macron", "Emmanuel Macron"],
  ["keir starmer", "Keir Starmer"],
  ["bola tinubu", "Bola Tinubu"],
  ["tinubu", "Bola Tinubu"],
  ["peter obi", "Peter Obi"],
  ["nana akufo-addo", "Nana Akufo-Addo"],
  ["cyril ramaphosa", "Cyril Ramaphosa"],
  ["elon musk", "Elon Musk"],
  ["messi", "Lionel Messi"],
  ["ronaldo", "Cristiano Ronaldo"],
  ["mbappe", "Kylian Mbappe"],
  ["united nations", "United Nations headquarters"],
  ["white house", "White House"],
  ["capitol", "United States Capitol"],
  ["lagos", "Lagos Nigeria skyline"],
  ["abuja", "Abuja Nigeria"],
  ["accra", "Accra Ghana"],
];

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
};

const STOP = new Set([
  "the", "and", "for", "with", "from", "that", "this", "after", "before", "into", "over",
  "about", "will", "would", "could", "should", "says", "said", "have", "has", "been",
  "are", "was", "were", "their", "they", "them", "than", "then", "what", "when", "where",
  "while", "which", "who", "how", "why", "new", "latest", "news", "report", "reports",
  "according", "amid", "more", "most", "just", "only", "also", "being", "very",
  "secret", "deals", "sending", "across", "world", "full", "story", "podcast",
  "continue", "reading", "migrants", "migrant",
]);

const BAD_IMAGE = /butterfly|moth|insect|flower|garden|cat |dog |stock photo|abstract|wallpaper|phocides|pigmalion/i;

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
    const value = meta && meta[key] && meta[key].value;
    if (value) return cleanMeta(value);
  }
  return "";
}

function detectKnownSubject(text) {
  const n = normalize(text);
  for (let i = 0; i < KNOWN_SUBJECTS.length; i++) {
    const key = KNOWN_SUBJECTS[i][0];
    const label = KNOWN_SUBJECTS[i][1];
    if (n.indexOf(key) !== -1) return label;
  }
  return "";
}

export function detectClubCrest(text) {
  const n = " " + normalize(text) + " ";
  const keys = Object.keys(CLUB_CRESTS).sort(function (a, b) {
    return b.length - a.length;
  });
  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];
    if (n.indexOf(" " + key + " ") !== -1) {
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

export function extractImageSubject(title, preferredQuery, category) {
  if (category == null) category = "World";
  const preferred = String(preferredQuery || "").trim();
  if (preferred && preferred.length >= 3 && preferred.length <= 80 && !BAD_IMAGE.test(preferred)) {
    const known = detectKnownSubject(preferred);
    if (known) return known;
    return preferred;
  }

  const known = detectKnownSubject(title + " " + preferred);
  if (known) return known;

  const raw = String(title || "").replace(/\s*-\s*Full Story podcast.*/i, "");
  const proper = raw.match(/\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,3})\b/g) || [];
  const filtered = proper
    .map(function (p) {
      return p.trim();
    })
    .filter(function (p) {
      const low = p.toLowerCase();
      return !STOP.has(low) && p.length >= 4 && !BAD_IMAGE.test(p);
    });
  if (filtered.length) return filtered.slice(0, 2).join(" ");

  const words = normalize(title)
    .split(/\s+/)
    .filter(function (w) {
      return w.length >= 4 && !STOP.has(w);
    })
    .slice(0, 4);
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
    u.searchParams.set("gsrlimit", "12");
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
    const pages = Object.values((data && data.query && data.query.pages) || {});
    const allowed =
      /^(CC0(?:\s|$)|CC BY-SA(?:\s|$)|CC BY(?:\s|$)|Public domain(?:\s|$)|PD(?:\s|$)|PDM(?:\s|$)|GFDL)/i;

    const terms = normalize(q)
      .split(/\s+/)
      .filter(function (t) {
        return t.length >= 3 && !STOP.has(t);
      });

    const scored = [];
    for (let i = 0; i < pages.length; i++) {
      const page = pages[i];
      const info = page && page.imageinfo && page.imageinfo[0];
      if (!info) continue;
      const meta = info.extmetadata || {};
      const license = metaValue(meta, ["LicenseShortName", "UsageTerms"]);
      const artist = metaValue(meta, ["Artist", "Credit"]) || "Wikimedia Commons";
      const description = metaValue(meta, ["ImageDescription"]);
      const categories = metaValue(meta, ["Categories"]);
      const image = info.thumburl || info.url || "";
      const source = info.descriptionurl || "";
      const hay = normalize([page.title, description, categories].join(" "));

      if (!image || !/^https?:\/\//i.test(image)) continue;
      if (!/^image\//i.test(String(info.mime || ""))) continue;
      if (Number(info.width || 0) < 400) continue;
      if (license && !allowed.test(license)) continue;
      if (BAD_IMAGE.test(hay) || BAD_IMAGE.test(page.title || "")) continue;

      const hits = terms.filter(function (t) {
        return hay.indexOf(t) !== -1;
      }).length;
      // Require at least half the query terms to match (stops butterfly on Trump)
      if (terms.length && hits < Math.max(1, Math.ceil(terms.length * 0.5))) continue;

      scored.push({
        image: String(image),
        image_credit: "Photo: " + artist + " / Wikimedia Commons",
        image_license: license || "Wikimedia Commons",
        image_source_url: String(source),
        hits: hits,
      });
    }

    scored.sort(function (a, b) {
      return b.hits - a.hits;
    });
    return scored[0] || null;
  } catch (e) {
    return null;
  }
}

async function pexelsSearch(query) {
  const key = process.env.PEXELS_API_KEY || process.env.PEXELS_KEY || process.env.PEXELS_API || "";
  if (!key || !query) return null;
  try {
    const u = new URL("https://api.pexels.com/v1/search");
    u.searchParams.set("query", String(query).slice(0, 80));
    u.searchParams.set("per_page", "4");
    u.searchParams.set("orientation", "landscape");
    const r = await fetch(u.toString(), {
      headers: { Authorization: key, Accept: "application/json" },
      signal: AbortSignal.timeout(4500),
    });
    if (!r.ok) return null;
    const data = await r.json();
    const photos = Array.isArray(data.photos) ? data.photos : [];
    for (let i = 0; i < photos.length; i++) {
      const photo = photos[i];
      const image = (photo.src && (photo.src.large || photo.src.medium)) || "";
      const alt = String(photo.alt || "");
      if (!image) continue;
      if (BAD_IMAGE.test(alt)) continue;
      return {
        image: String(image),
        image_credit: photo.photographer ? "Photo: " + photo.photographer + " / Pexels" : "Pexels",
        image_license: "Pexels License",
        image_source_url: String(photo.url || "https://www.pexels.com/"),
      };
    }
    return null;
  } catch (e) {
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
    const photo = Array.isArray(data.results) ? data.results[0] : null;
    const image = photo && photo.urls && (photo.urls.regular || photo.urls.small);
    if (!image) return null;
    return {
      image: String(image),
      image_credit: photo.user && photo.user.name ? "Photo: " + photo.user.name + " / Unsplash" : "Unsplash",
      image_license: "Unsplash License",
      image_source_url: String((photo.links && photo.links.html) || "https://unsplash.com/"),
    };
  } catch (e) {
    return null;
  }
}

export async function resolveSafeCover({
  title = "",
  category = "World",
  preferredQuery = "",
  rssImage = "",
  preferStock = true,
  preferCrest = true,
} = {}) {
  const haystack = [title, preferredQuery].filter(Boolean).join(" ");

  // 1) RSS image first — matches the publisher story
  if (rssImage && /^https?:\/\//i.test(rssImage) && !/rwdnews-logo/i.test(rssImage)) {
    return {
      image: String(rssImage),
      image_credit: "Publisher feed",
      image_license: "Feed preview",
      image_source_url: String(rssImage),
    };
  }

  // 2) Club crest for sports
  if (preferCrest && (category === "Sports" || /football|soccer|premier|ucl|afcon|club|match/i.test(haystack))) {
    const crest = detectClubCrest(haystack);
    if (crest) return crest;
  }

  const subject = extractImageSubject(title, preferredQuery, category);

  // 3) Wikimedia for real people / places
  const commons = await commonsSearch(subject);
  if (commons) return commons;

  const short = subject.split(/\s+/).slice(0, 2).join(" ");
  if (short && short !== subject) {
    const commons2 = await commonsSearch(short);
    if (commons2) return commons2;
  }

  // 4) Stock — subject first, then category
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
  }

  return {
    image: PLACEHOLDER,
    image_credit: "RockBrief",
    image_license: "Site asset",
    image_source_url: "",
  };
}

export { PLACEHOLDER, CLUB_CRESTS, CATEGORY_QUERY };
