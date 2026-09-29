/**
 * Conservative cover-image resolver for RockBrief.
 *
 * Order:
 * 1) Wikimedia Commons: reusable image + machine-readable license/credit + strong metadata match.
 * 2) Pexels: only when the returned photo metadata strongly matches the AI-selected subject.
 * 3) Gemini vision verification: only a visually relevant candidate is accepted.
 * 4) No image: use the RockBrief logo placeholder.
 *
 * We intentionally do not use generic category images, RSS thumbnails, or Unsplash here.
 * A wrong image is worse than no image.
 * Verification is fail-closed: API errors, unsupported images, or uncertainty produce no image.
 */

const PLACEHOLDER = "https://rwdnews.netlify.app/rwdnews-logo.svg";

const STOP = new Set([
  "the","and","for","with","from","that","this","after","before","into","over","under",
  "about","will","would","could","should","says","said","have","has","been","are","was",
  "were","their","they","them","than","then","what","when","where","while","which","who",
  "how","why","new","latest","news","report","reports","according","amid","more","most",
  "just","only","also","being","very","much","many","some","such","like","event","events",
  "official","officials","attends","attend","attended","announces","announced","gets","got",
  "during",
]);

function normalize(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9\s-]/g, " ")
    .replace(/[-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function termsFor(query) {
  return [...new Set(
    normalize(query)
      .split(/\s+/)
      .filter((term) => term.length >= 4 && !STOP.has(term)),
  )].slice(0, 8);
}

function overlapScore(query, haystack) {
  const terms = termsFor(query);
  const text = normalize(haystack);
  if (!terms.length || !text) return { hits: 0, total: terms.length, ratio: 0 };

  const hits = terms.filter((term) => text.includes(term)).length;
  return { hits, total: terms.length, ratio: hits / terms.length };
}

function isStrongMatch(query, haystack) {
  const { hits, total, ratio } = overlapScore(query, haystack);
  if (!total) return false;
  if (total === 1) return hits === 1;
  return hits >= 2 && ratio >= 0.5;
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

async function verifyImageVisually(query, candidate) {
  const key = process.env.GEMINI_API_KEY || "";
  if (!key || !candidate?.image) return false;

  try {
    const response = await fetch(candidate.image, {
      headers: { Accept: "image/avif,image/webp,image/jpeg,image/png,image/*" },
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) return false;

    const contentType = String(response.headers.get("content-type") || "").split(";")[0].toLowerCase();
    if (!/^image\/(jpeg|png|webp|gif|avif)$/i.test(contentType)) return false;

    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.length < 10000 || buffer.length > 7000000) return false;

    const ai = new (await import("@google/genai")).GoogleGenAI({ apiKey: key });
    const result = await Promise.race([
      ai.models.generateContent({
        model: process.env.GEMINI_IMAGE_VERIFY_MODEL || "gemini-2.5-flash",
        contents: [{
          role: "user",
          parts: [
            {
              inlineData: {
                mimeType: contentType,
                data: buffer.toString("base64"),
              },
            },
            {
              text:
                "You are a strict image verification gate for a global news site. " +
                "The requested story subject is: " + query + ". " +
                "The candidate image metadata is: " + JSON.stringify({
                  credit: candidate.image_credit || "",
                  source: candidate.image_source_url || "",
                }) + ". " +
                "Decide whether the visible image itself is clearly relevant to that exact subject. " +
                "PASS only when the image visibly depicts the named person, event, place, product, object, or other specific subject. " +
                "Do not use generic thematic similarity. Do not guess identity or context from weak clues. " +
                "If the subject is a named person, PASS only if the person is visibly the same person. " +
                "If uncertain, return FAIL. Return JSON only with verdict PASS or FAIL and a short reason.",
            },
          ],
        }],
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: "OBJECT",
            properties: {
              verdict: { type: "STRING", enum: ["PASS", "FAIL"] },
              reason: { type: "STRING" },
            },
            required: ["verdict", "reason"],
          },
        },
      }),
      new Promise((_, reject) => setTimeout(() => reject(new Error("image verification timeout")), 9000)),
    ]);

    const text = String(result?.text || "").trim();
    if (!text) return false;
    const parsed = JSON.parse(text);
    return parsed?.verdict === "PASS";
  } catch {
    return false;
  }
}

async function commonsSearch(query) {
  const terms = termsFor(query);
  if (!terms.length) return null;

  try {
    const u = new URL("https://commons.wikimedia.org/w/api.php");
    u.searchParams.set("action", "query");
    u.searchParams.set("format", "json");
    u.searchParams.set("generator", "search");
    u.searchParams.set("gsrsearch", query);
    u.searchParams.set("gsrnamespace", "6");
    u.searchParams.set("gsrlimit", "10");
    u.searchParams.set("prop", "imageinfo");
    u.searchParams.set("iiprop", "url|size|mime|extmetadata");
    u.searchParams.set("iiurlwidth", "1200");
    u.searchParams.set("iiextmetadatafilter", "Artist|Credit|ImageDescription|LicenseShortName|UsageTerms|Categories|LicenseUrl");

    const r = await fetch(u.toString(), {
      headers: {
        Accept: "application/json",
        "Api-User-Agent": "RockBrief/1.0 (https://rwdnews.netlify.app/)",
      },
      signal: AbortSignal.timeout(5000),
    });
    if (!r.ok) return null;

    const data = await r.json();
    const pages = Object.values(data?.query?.pages || {});
    const allowed = /^(CC0(?:\s|$)|CC BY-SA(?:\s|$)|CC BY(?:\s|$)|Public domain(?:\s|$)|PD(?:\s|$)|PDM(?:\s|$)|GFDL)/i;

    const candidates = pages.map((page) => {
      const info = page?.imageinfo?.[0];
      const meta = info?.extmetadata || {};
      const license = metaValue(meta, ["LicenseShortName", "UsageTerms"]);
      const artist = metaValue(meta, ["Artist", "Credit"]) || "Wikimedia Commons contributor";
      const description = metaValue(meta, ["ImageDescription"]);
      const categories = metaValue(meta, ["Categories"]);
      const image = info?.thumburl || info?.url || "";
      const source = info?.descriptionurl || "";

      if (!image || !/^https?:\/\//i.test(image)) return null;
      if (!/^image\//i.test(String(info?.mime || ""))) return null;
      if (Number(info?.width || 0) < 500 || Number(info?.height || 0) < 300) return null;
      if (!license || !allowed.test(license)) return null;

      const searchable = [String(page?.title || ""), description, categories].join(" ");
      const match = overlapScore(query, searchable);
      if (!isStrongMatch(query, searchable)) return null;

      return {
        image: String(image),
        image_credit: "Photo: " + artist + " / Wikimedia Commons",
        image_license: license,
        image_source_url: String(source),
        matchHits: match.hits,
        matchRatio: match.ratio,
      };
    }).filter(Boolean);

    if (!candidates.length) return null;

    candidates.sort((a, b) =>
      (b.matchHits - a.matchHits) ||
      (b.matchRatio - a.matchRatio),
    );

    for (const candidate of candidates.slice(0, 3)) {
      if (await verifyImageVisually(query, candidate)) {
        return {
          image: candidate.image,
          image_credit: candidate.image_credit,
          image_license: candidate.image_license,
          image_source_url: candidate.image_source_url,
        };
      }
    }
    return null;
  } catch {
    return null;
  }
}

async function pexelsSearch(query) {
  const key = process.env.PEXELS_API_KEY || process.env.PEXELS_KEY || process.env.PEXELS_API || "";
  const terms = termsFor(query);
  if (!key || !terms.length) return null;

  try {
    const u = new URL("https://api.pexels.com/v1/search");
    u.searchParams.set("query", query);
    u.searchParams.set("per_page", "8");
    u.searchParams.set("orientation", "landscape");

    const r = await fetch(u.toString(), {
      headers: { Authorization: key, Accept: "application/json" },
      signal: AbortSignal.timeout(4500),
    });
    if (!r.ok) return null;

    const data = await r.json();
    const photos = Array.isArray(data?.photos) ? data.photos : [];

    const candidates = photos.map((photo) => {
      const searchable = [
        photo?.alt || "",
        photo?.url || "",
        photo?.photographer || "",
      ].join(" ");
      const match = overlapScore(query, searchable);
      const image = photo?.src?.large || photo?.src?.medium || "";

      if (!image || !isStrongMatch(query, searchable)) return null;

      return {
        image: String(image),
        image_credit: photo?.photographer
          ? "Photo: " + photo.photographer + " / Pexels"
          : "Pexels",
        image_license: "Pexels License",
        image_source_url: String(photo?.url || "https://www.pexels.com/"),
        matchHits: match.hits,
        matchRatio: match.ratio,
      };
    }).filter(Boolean);

    if (!candidates.length) return null;

    candidates.sort((a, b) =>
      (b.matchHits - a.matchHits) ||
      (b.matchRatio - a.matchRatio),
    );

    for (const candidate of candidates.slice(0, 3)) {
      if (await verifyImageVisually(query, candidate)) {
        return {
          image: candidate.image,
          image_credit: candidate.image_credit,
          image_license: candidate.image_license,
          image_source_url: candidate.image_source_url,
        };
      }
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * @param {{
 *   title?: string,
 *   category?: string,
 *   preferredQuery?: string,
 *   preferStock?: boolean
 * }} options
 */
export async function resolveSafeCover({
  title = "",
  category = "World",
  preferredQuery = "",
  preferStock = true,
} = {}) {
  void category;
  const query = String(preferredQuery || "").trim() || String(title || "").trim();

  if (!query) {
    return {
      image: PLACEHOLDER,
      image_credit: "RockBrief",
      image_license: "Site asset",
      image_source_url: "",
    };
  }

  const commons = await commonsSearch(query);
  if (commons) return commons;

  if (preferStock) {
    const pexels = await pexelsSearch(query);
    if (pexels) return pexels;
  }

  return {
    image: PLACEHOLDER,
    image_credit: "RockBrief",
    image_license: "Site asset",
    image_source_url: "",
  };
}

export { PLACEHOLDER };
