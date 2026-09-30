/**
 * RockBrief AI brief — short, readable, no filler.
 * Also emits a precise image_query for stock/Wikimedia search.
 */
import { GoogleGenAI, Type } from "@google/genai";
import { mergeAfricaLensIntoBody } from "./rockbrief-intelligence.mjs";

const MIN_BODY_WORDS = 120;
const MAX_BODY_WORDS = 320;
const MIN_BULLET_WORDS = 12;
const BULLET_COUNT = 4;

const META_RE =
  /rockbrief summary|attributed source material|reported under the headline|open the original publisher|full quotes and any updates|readers who need the full|continue reading|without leaving the desk|meant to be read on rockbrief|source-bound|this rockbrief report is an original synthesis/i;

function clean(value) {
  return String(value || "")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function stripJunk(value) {
  let x = clean(value);
  x = x.replace(/\s*Read\s*More\s*:?\s*https?:\/\/\S+/gi, "");
  x = x.replace(/\s*Continue reading\.?/gi, "");
  return x.replace(/\s+/g, " ").trim();
}

function wordCount(text) {
  return String(text || "")
    .split(/\s+/)
    .filter(Boolean).length;
}

function isMeta(text) {
  return META_RE.test(String(text || ""));
}

function splitIntoSentences(text) {
  return String(text || "")
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 25 && !isMeta(s));
}

/** Fallback visual query from title alone — never abstract junk */
function fallbackImageQuery(title) {
  const t = clean(title).replace(/\s*-\s*Full Story podcast.*/i, "");
  if (/\btrump\b/i.test(t)) return "Donald Trump portrait";
  if (/\btinubu\b/i.test(t)) return "Bola Tinubu";
  if (/\bman\s*city|manchester\s*city\b/i.test(t)) return "Manchester City football";
  if (/\bfifa\b/i.test(t)) return "FIFA football";
  if (/\boil|crude|refiner|petroleum|petrol\b/i.test(t)) return "oil refinery industry";
  if (/\bhelicopter|military|army\b/i.test(t)) return "military helicopter";
  if (/\bmigrant|deport|asylum|immigration\b/i.test(t)) return "immigration border checkpoint";
  if (/\bfootball|soccer|premier|match|goal\b/i.test(t)) return "football match stadium";
  if (/\bnigeria|lagos|abuja\b/i.test(t)) return "Lagos Nigeria city";
  const words = t
    .replace(/[^a-zA-Z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 3)
    .slice(0, 4);
  return words.join(" ") || "world news skyline";
}

function normalizeBullets(raw, title, desc) {
  const fromModel = (Array.isArray(raw) ? raw : [])
    .map((x) => stripJunk(x))
    .filter((x) => x.length > 20 && !isMeta(x));

  const fromDesc = splitIntoSentences(desc);
  let bullets = [];
  for (const b of fromModel) {
    if (bullets.length >= BULLET_COUNT) break;
    if (bullets.some((x) => x.slice(0, 40) === b.slice(0, 40))) continue;
    bullets.push(b);
  }
  for (const s of fromDesc) {
    if (bullets.length >= BULLET_COUNT) break;
    if (bullets.some((x) => x.slice(0, 40) === s.slice(0, 40))) continue;
    bullets.push(s.slice(0, 220));
  }

  const seed = stripJunk(desc) || clean(title);
  if (bullets.length < BULLET_COUNT && seed) {
    const chunks = seed.match(/.{1,160}(?:\s|$)/g) || [seed];
    for (const c of chunks) {
      if (bullets.length >= BULLET_COUNT) break;
      const t = c.trim();
      if (t.length > 30) bullets.push(t);
    }
  }

  while (bullets.length < BULLET_COUNT) {
    bullets.push(clean(title).slice(0, 120) || "See the full report from the original publisher.");
  }

  return bullets.slice(0, BULLET_COUNT).map((b) => {
    const w = wordCount(b);
    if (w >= MIN_BULLET_WORDS) return b;
    return (b + " " + (seed || "")).trim().slice(0, 220);
  });
}

function synthesizeFallbackBody(title, desc) {
  const t = clean(title).replace(/\s*-\s*Full Story podcast.*/i, "").trim();
  const d = stripJunk(desc) || t;
  const sentences = splitIntoSentences(d);
  const lead = sentences.slice(0, 4).join(" ") || d.slice(0, 500);

  const body =
    t +
    ". " +
    lead +
    (sentences.length > 4 ? " " + sentences.slice(4, 7).join(" ") : "") +
    "\n\n" +
    "Why it matters: this is the core of what the original outlet reported. Open the source link for the full investigation, quotes, and any updates.";

  return stripJunk(body);
}

export async function enhancedAiBrief(title, desc, related = [], useGrounding = false) {
  const cleanTitle = clean(title).replace(/\s*-\s*Full Story podcast.*/i, "").trim() || clean(title);
  const fallbackBody = synthesizeFallbackBody(cleanTitle, desc);
  const fallbackBullets = normalizeBullets([], cleanTitle, desc);

  const fallback = {
    ai_hook_title: cleanTitle.replace(/^(\[.*?\]|BREAKING:?)/i, "").trim() || cleanTitle,
    body: fallbackBody,
    ai_summary: fallbackBullets,
    tags: ["#World"],
    image_query: fallbackImageQuery(cleanTitle),
    africa_lens: "",
  };

  const key = process.env.GEMINI_API_KEY || "";
  if (!key || !desc || String(desc).length < 40) return fallback;

  try {
    const ai = new GoogleGenAI({ apiKey: key });
    const response = await Promise.race([
      ai.models.generateContent({
        model: "gemini-2.0-flash",
        contents:
          "You are an advanced News Automation Engine. Analyze the headline and body. JSON only.\n" +
          "TASKS:\n" +
          "1) ai_hook_title: clean factual headline. Strip podcast labels.\n" +
          "2) body: 150-280 words. What happened; who/where; why it matters. Facts only. No meta filler.\n" +
          "3) ai_summary: exactly 4 different factual bullets (25-40 words each).\n" +
          "4) tags: 2-4 hashtags.\n" +
          "5) image_query: CRITICAL — a highly specific realistic visual search query, MAXIMUM 4-5 words, " +
          "for Pexels/Unsplash/Wikimedia. Rules:\n" +
          "- Named person or celebrity → use full public name only e.g. Donald Trump, Bola Tinubu\n" +
          "- Sports team → team + football e.g. Manchester City football\n" +
          "- Plane crash / fire / disaster → concrete objects e.g. plane crash wreckage\n" +
          "- Oil/petrol → oil refinery industry\n" +
          "- Never abstract art, insects, animals, metaphors, punctuation, or filler words\n" +
          "6) africa_lens: 40-90 words only if Africa-relevant; else one short sentence.\n" +
          "HEADLINE: " +
          cleanTitle +
          "\nBODY: " +
          String(desc).slice(0, 2500) +
          "\nRELATED: " +
          JSON.stringify((related || []).slice(0, 3)),
        config: {
          ...(useGrounding ? { tools: [{ googleSearch: {} }] } : {}),
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              ai_hook_title: { type: Type.STRING },
              body: { type: Type.STRING },
              ai_summary: { type: Type.ARRAY, items: { type: Type.STRING } },
              tags: { type: Type.ARRAY, items: { type: Type.STRING } },
              image_query: { type: Type.STRING },
              africa_lens: { type: Type.STRING },
            },
            required: ["ai_hook_title", "body", "ai_summary", "tags", "image_query", "africa_lens"],
          },
        },
      }),
      new Promise(function (_, reject) {
        setTimeout(function () {
          reject(new Error("timeout"));
        }, 22000);
      }),
    ]);

    const textOut = response && response.text;
    if (!textOut) return fallback;
    const parsed = JSON.parse(textOut);

    let body = stripJunk(String(parsed.body || ""));
    body = body
      .split(/\n+/)
      .map((p) => p.trim())
      .filter((p) => p && !isMeta(p))
      .join("\n\n");

    const africa = stripJunk(String(parsed.africa_lens || ""));
    if (africa && !isMeta(africa) && africa.length > 40) {
      body = mergeAfricaLensIntoBody(body, africa);
    }

    let bodyWords = wordCount(body);
    if (bodyWords < MIN_BODY_WORDS) {
      body = synthesizeFallbackBody(cleanTitle, desc);
      bodyWords = wordCount(body);
    }
    if (bodyWords > MAX_BODY_WORDS) {
      const sentences = splitIntoSentences(body);
      let trimmed = "";
      for (const s of sentences) {
        if (wordCount(trimmed + " " + s) > MAX_BODY_WORDS) break;
        trimmed = (trimmed ? trimmed + " " : "") + s;
      }
      body = trimmed || body;
    }

    const bullets = normalizeBullets(parsed.ai_summary, cleanTitle, desc);
    let imageQuery = clean(parsed.image_query)
      .replace(/[^a-zA-Z0-9\s]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    // Cap to ~5 words for stock APIs
    const iqWords = imageQuery.split(/\s+/).filter(Boolean).slice(0, 5);
    imageQuery = iqWords.join(" ") || fallbackImageQuery(cleanTitle);

    return {
      ai_hook_title: clean(parsed.ai_hook_title) || fallback.ai_hook_title,
      body: body.slice(0, 8000),
      ai_summary: bullets,
      tags: (Array.isArray(parsed.tags) ? parsed.tags : ["#World"])
        .map(function (x) {
          return String(x).startsWith("#") ? String(x) : "#" + x;
        })
        .slice(0, 4),
      image_query: imageQuery,
      africa_lens: africa,
    };
  } catch (err) {
    console.error("[RockBrief] enhancedAiBrief failed", err && err.message ? err.message : err);
    return fallback;
  }
}

export { MIN_BODY_WORDS, MIN_BULLET_WORDS, BULLET_COUNT, wordCount, normalizeBullets, fallbackImageQuery };
