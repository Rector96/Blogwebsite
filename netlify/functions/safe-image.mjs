/**
 * Cover images for RockBrief — must match the headline.
 *
 * Order:
 * 1) RSS publisher image
 * 2) Club crest (sports)
 * 3) Curated person / org portrait (direct Wikimedia URLs)
 * 4) Wikipedia pageimage for known people
 * 5) Topic keyword → relevant stock query (Pexels)
 * 6) Category stock fallback
 * 7) Logo only if nothing else
 */

const PLACEHOLDER = "https://rwdnews.netlify.app/rwdnews-logo.svg";

const CATEGORY_QUERY = {
  Sports: "football stadium crowd",
  Tech: "technology laptop smartphone",
  Business: "oil refinery industry",
  Crypto: "bitcoin cryptocurrency",
  Entertainment: "concert stage lights",
  Nigeria: "lagos nigeria city skyline",
  Ghana: "accra ghana city",
  Africa: "africa city skyline",
  World: "world news city skyline",
  Europe: "europe city architecture",
  Asia: "asia city skyline",
  "Middle East": "middle east city",
};

/** Direct free portraits — no search, no random insects */
const PERSON_IMAGES = {
  "donald trump": {
    image: "https://upload.wikimedia.org/wikipedia/commons/5/56/Donald_Trump_official_portrait.jpg",
    credit: "Official White House photo / Wikimedia",
    license: "Public domain",
  },
  trump: {
    image: "https://upload.wikimedia.org/wikipedia/commons/5/56/Donald_Trump_official_portrait.jpg",
    credit: "Official White House photo / Wikimedia",
    license: "Public domain",
  },
  "joe biden": {
    image: "https://upload.wikimedia.org/wikipedia/commons/6/68/Joe_Biden_presidential_portrait.jpg",
    credit: "Official White House photo / Wikimedia",
    license: "Public domain",
  },
  biden: {
    image: "https://upload.wikimedia.org/wikipedia/commons/6/68/Joe_Biden_presidential_portrait.jpg",
    credit: "Official White House photo / Wikimedia",
    license: "Public domain",
  },
  "bola tinubu": {
    image: "https://upload.wikimedia.org/wikipedia/commons/thumb/7/77/Bola_Tinubu_portrait.jpg/800px-Bola_Tinubu_portrait.jpg",
    credit: "Wikimedia Commons",
    license: "Wikimedia",
  },
  tinubu: {
    image: "https://upload.wikimedia.org/wikipedia/commons/thumb/7/77/Bola_Tinubu_portrait.jpg/800px-Bola_Tinubu_portrait.jpg",
    credit: "Wikimedia Commons",
    license: "Wikimedia",
  },
  "elon musk": {
    image: "https://upload.wikimedia.org/wikipedia/commons/thumb/9/99/Elon_Musk_Royal_Society_%28crop2%29.jpg/800px-Elon_Musk_Royal_Society_%28crop2%29.jpg",
    credit: "Wikimedia Commons",
    license: "CC BY",
  },
  "lionel messi": {
    image: "https://upload.wikimedia.org/wikipedia/commons/thumb/b/b4/Lionel-Messi-Argentina-2022-FIFA-World-Cup_%28cropped%29.jpg/800px-Lionel-Messi-Argentina-2022-FIFA-World-Cup_%28cropped%29.jpg",
    credit: "Wikimedia Commons",
    license: "CC BY",
  },
  messi: {
    image: "https://upload.wikimedia.org/wikipedia/commons/thumb/b/b4/Lionel-Messi-Argentina-2022-FIFA-World-Cup_%28cropped%29.jpg/800px-Lionel-Messi-Argentina-2022-FIFA-World-Cup_%28cropped%29.jpg",
    credit: "Wikimedia Commons",
    license: "CC BY",
  },
  "cristiano ronaldo": {
    image: "https://upload.wikimedia.org/wikipedia/commons/thumb/8/8c/Cristiano_Ronaldo_2018.jpg/800px-Cristiano_Ronaldo_2018.jpg",
    credit: "Wikimedia Commons",
    license: "CC BY",
  },
  ronaldo: {
    image: "https://upload.wikimedia.org/wikipedia/commons/thumb/8/8c/Cristiano_Ronaldo_2018.jpg/800px-Cristiano_Ronaldo_2018.jpg",
    credit: "Wikimedia Commons",
    license: "CC BY",
  },
  fifa: {
    image: "https://upload.wikimedia.org/wikipedia/commons/thumb/a/aa/FIFA_logo_without_slogan.svg/800px-FIFA_logo_without_slogan.svg.png",
    credit: "FIFA logo / Wikimedia",
    license: "Trademark display",
  },
  uefa: {
    image: "https://upload.wikimedia.org/wikipedia/commons/thumb/d/d2/UEFA_logo.svg/800px-UEFA_logo.svg.png",
    credit: "UEFA logo / Wikimedia",
    license: "Trademark display",
  },
};

/** Wikipedia titles for pageimage lookup */
const WIKI_TITLES = {
  trump: "Donald Trump",
  "donald trump": "Donald Trump",
  biden: "Joe Biden",
  "joe biden": "Joe Biden",
  tinubu: "Bola Tinubu",
  "bola tinubu": "Bola Tinubu",
  "peter obi": "Peter Obi",
  putin: "Vladimir Putin",
  zelensky: "Volodymyr Zelenskyy",
  "elon musk": "Elon Musk",
  messi: "Lionel Messi",
  ronaldo: "Cristiano Ronaldo",
  mbappe: "Kylian Mbappé",
  "man city": "Manchester City F.C.",
  "manchester city": "Manchester City F.C.",
  arsenal: "Arsenal F.C.",
  chelsea: "Chelsea F.C.",
  liverpool: "Liverpool F.C.",
  nigeria: "Nigeria",
  lagos: "Lagos",
  abuja: "Abuja",
  ghana: "Ghana",
  accra: "Accra",
};

/** Headline topic → stock photo query (never random) */
const TOPIC_QUERIES = [
  [/migrant|deport|asylum|immigration/i, "immigration border checkpoint"],
  [/oil|crude|refiner|petroleum|petrol|fuel/i, "oil refinery industry"],
  [/helicopter|military|army|navy|defence|defense/i, "military helicopter aircraft"],
  [/abduct|kidnap|rescue|bandit/i, "security police nigeria"],
  [/senate|national assembly|parliament|lawmaker/i, "nigeria national assembly"],
  [/tax|ombud|revenue|customs/i, "tax finance office"],
  [/vandal|power|electricity|grid/i, "electricity power lines africa"],
  [/school|student|education/i, "school students africa"],
  [/football|soccer|premier|champions|match|goal/i, "football match stadium"],
  [/crypto|bitcoin|ethereum/i, "bitcoin cryptocurrency"],
  [/ai |artificial intelligence|chip|software/i, "technology artificial intelligence"],
  [/market|stock|bank|economy|inflation/i, "finance stock market"],
  [/dance|dancer|music|concert/i, "dancer performance stage"],
  [/nigeria|lagos|abuja/i, "lagos nigeria city"],
  [/ghana|accra/i, "accra ghana city"],
];

const CLUB_CRESTS = {
  arsenal: {
    image: "https://upload.wikimedia.org/wikipedia/en/5/53/Arsenal_FC.svg",
    credit: "Arsenal F.C. crest / Wikimedia",
    license: "Trademark display",
  },
  chelsea: {
    image: "https://upload.wikimedia.org/wikipedia/en/c/cc/Chelsea_FC.svg",
    credit: "Chelsea F.C. crest / Wikimedia",
    license: "Trademark display",
  },
  liverpool: {
    image: "https://upload.wikimedia.org/wikipedia/en/0/0c/Liverpool_FC.svg",
    credit: "Liverpool F.C. crest / Wikimedia",
    license: "Trademark display",
  },
  "man city": {
    image: "https://upload.wikimedia.org/wikipedia/en/e/eb/Manchester_City_FC_badge.svg",
    credit: "Manchester City crest / Wikimedia",
    license: "Trademark display",
  },
  "manchester city": {
    image: "https://upload.wikimedia.org/wikipedia/en/e/eb/Manchester_City_FC_badge.svg",
    credit: "Manchester City crest / Wikimedia",
    license: "Trademark display",
  },
  city: {
    image: "https://upload.wikimedia.org/wikipedia/en/e/eb/Manchester_City_FC_badge.svg",
    credit: "Manchester City crest / Wikimedia",
    license: "Trademark display",
  },
  "man united": {
    image: "https://upload.wikimedia.org/wikipedia/en/7/7a/Manchester_United_FC_crest.svg",
    credit: "Manchester United crest / Wikimedia",
    license: "Trademark display",
  },
  "manchester united": {
    image: "https://upload.wikimedia.org/wikipedia/en/7/7a/Manchester_United_FC_crest.svg",
    credit: "Manchester United crest / Wikimedia",
    license: "Trademark display",
  },
  barcelona: {
    image: "https://upload.wikimedia.org/wikipedia/en/4/47/FC_Barcelona_%28crest%29.svg",
    credit: "FC Barcelona crest / Wikimedia",
    license: "Trademark display",
  },
  "real madrid": {
    image: "https://upload.wikimedia.org/wikipedia/en/5/56/Real_Madrid_CF.svg",
    credit: "Real Madrid crest / Wikimedia",
    license: "Trademark display",
  },
  italy: {
    image: "https://upload.wikimedia.org/wikipedia/en/0/04/Italy_national_football_team_logo.svg",
    credit: "Italy national team / Wikimedia",
    license: "Trademark display",
  },
};

const STOP = new Set([
  "the", "and", "for", "with", "from", "that", "this", "after", "before", "into", "over",
  "about", "will", "would", "could", "should", "says", "said", "have", "has", "been",
  "are", "was", "were", "their", "they", "them", "than", "then", "what", "when", "where",
  "while", "which", "who", "how", "why", "new", "latest", "news", "report", "reports",
  "according", "amid", "more", "most", "just", "only", "also", "being", "very",
  "secret", "deals", "sending", "across", "world", "full", "story", "podcast",
  "continue", "reading", "migrants", "migrant", "sources", "should", "face",
]);

const BAD_IMAGE =
  /butterfly|moth|insect|flower|garden|cat |dog |phocides|pigmalion|stock photo|abstract|wallpaper|rwdnews-logo|secret.?woods/i;

function normalize(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function pack(image, credit, license, source) {
  return {
    image: String(image),
    image_credit: String(credit || "RockBrief"),
    image_license: String(license || ""),
    image_source_url: String(source || image || ""),
  };
}

function detectPersonImage(text) {
  const n = normalize(text);
  const keys = Object.keys(PERSON_IMAGES).sort(function (a, b) {
    return b.length - a.length;
  });
  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];
    if (n.indexOf(key) !== -1) {
      const p = PERSON_IMAGES[key];
      return pack(p.image, p.credit, p.license, p.image);
    }
  }
  return null;
}

export function detectClubCrest(text) {
  const n = " " + normalize(text) + " ";
  const keys = Object.keys(CLUB_CRESTS).sort(function (a, b) {
    return b.length - a.length;
  });
  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];
    // Avoid matching short "city" inside unrelated words when not sports context
    if (key === "city" && !/man\s*city|manchester\s*city|city\s*(knew|face|guilty|sanctions)/i.test(text)) {
      continue;
    }
    if (n.indexOf(" " + key + " ") !== -1) {
      const crest = CLUB_CRESTS[key];
      return pack(crest.image, crest.credit, crest.license, crest.image);
    }
  }
  return null;
}

function topicStockQuery(title, category) {
  const t = String(title || "");
  for (let i = 0; i < TOPIC_QUERIES.length; i++) {
    if (TOPIC_QUERIES[i][0].test(t)) return TOPIC_QUERIES[i][1];
  }
  return CATEGORY_QUERY[category] || CATEGORY_QUERY.World;
}

function wikiTitleFromText(text) {
  const n = normalize(text);
  const keys = Object.keys(WIKI_TITLES).sort(function (a, b) {
    return b.length - a.length;
  });
  for (let i = 0; i < keys.length; i++) {
    if (n.indexOf(keys[i]) !== -1) return WIKI_TITLES[keys[i]];
  }
  return "";
}

async function wikipediaPageImage(wikiTitle) {
  if (!wikiTitle) return null;
  try {
    const u = new URL("https://en.wikipedia.org/w/api.php");
    u.searchParams.set("action", "query");
    u.searchParams.set("format", "json");
    u.searchParams.set("titles", wikiTitle);
    u.searchParams.set("prop", "pageimages");
    u.searchParams.set("pithumbsize", "1000");
    u.searchParams.set("origin", "*");
    const r = await fetch(u.toString(), {
      headers: {
        Accept: "application/json",
        "Api-User-Agent": "RockBrief/1.0 (https://rwdnews.netlify.app/; news covers)",
      },
      signal: AbortSignal.timeout(4500),
    });
    if (!r.ok) return null;
    const data = await r.json();
    const pages = Object.values((data && data.query && data.query.pages) || {});
    for (let i = 0; i < pages.length; i++) {
      const thumb = pages[i] && pages[i].thumbnail && pages[i].thumbnail.source;
      if (thumb && /^https?:\/\//i.test(thumb) && !BAD_IMAGE.test(thumb)) {
        return pack(thumb, wikiTitle + " / Wikipedia", "Wikipedia page image", thumb);
      }
    }
    return null;
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
    u.searchParams.set("per_page", "6");
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
      if (BAD_IMAGE.test(alt) || BAD_IMAGE.test(image)) continue;
      return pack(
        image,
        photo.photographer ? "Photo: " + photo.photographer + " / Pexels" : "Pexels",
        "Pexels License",
        photo.url || "https://www.pexels.com/",
      );
    }
    return null;
  } catch (e) {
    return null;
  }
}

export function extractImageSubject(title, preferredQuery, category) {
  if (category == null) category = "World";
  const preferred = String(preferredQuery || "").trim();
  if (preferred && preferred.length >= 3 && preferred.length <= 80 && !BAD_IMAGE.test(preferred)) {
    return preferred;
  }
  return topicStockQuery(title, category);
}

export function headlineImageQuery(title, category) {
  return extractImageSubject(title, "", category);
}

/** True if stored image should be replaced */
export function isBadCover(image, credit) {
  const s = String(image || "") + " " + String(credit || "");
  if (!image || /rwdnews-logo/i.test(image)) return true;
  if (BAD_IMAGE.test(s)) return true;
  return false;
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

  // 1) RSS publisher image — real story photo
  if (rssImage && /^https?:\/\//i.test(rssImage) && !isBadCover(rssImage, "")) {
    return pack(rssImage, "Publisher feed", "Feed preview", rssImage);
  }

  // 2) Curated person / org portrait (Trump, Tinubu, FIFA…)
  const person = detectPersonImage(haystack);
  if (person) return person;

  // 3) Club crest for sports headlines
  if (preferCrest && (category === "Sports" || /football|soccer|premier|ucl|afcon|club|match|fifa|uefa|italy|city knew|guilty/i.test(haystack))) {
    const crest = detectClubCrest(haystack);
    if (crest) return crest;
  }

  // 4) Wikipedia page portrait for known names
  const wikiTitle = wikiTitleFromText(haystack);
  if (wikiTitle) {
    const wiki = await wikipediaPageImage(wikiTitle);
    if (wiki) return wiki;
  }

  // 5) Topic-matched stock (oil → refinery, migrants → border, etc.)
  if (preferStock) {
    const topicQ = topicStockQuery(title, category);
    const pexels = await pexelsSearch(topicQ);
    if (pexels) return pexels;

    const preferred = String(preferredQuery || "").trim();
    if (preferred && preferred !== topicQ) {
      const p2 = await pexelsSearch(preferred);
      if (p2) return p2;
    }

    const catQ = CATEGORY_QUERY[category] || CATEGORY_QUERY.World;
    if (catQ !== topicQ) {
      const p3 = await pexelsSearch(catQ);
      if (p3) return p3;
    }
  }

  return pack(PLACEHOLDER, "RockBrief", "Site asset", "");
}

export { PLACEHOLDER, CLUB_CRESTS, CATEGORY_QUERY, PERSON_IMAGES };
