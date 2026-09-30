/**
 * RockBrief AI brief — short, readable, no filler.
 * Goal: user understands the story in 1–2 minutes, then can open the source.
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

  // Last resort: short factual lines from title + desc chunks (never meta)
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

/** Compact source-bound brief — no padding loops. */
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
    image_query: cleanTitle,
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
          "You are RockBrief. Write a SHORT news briefing a mobile reader can finish in under 2 minutes. JSON only. " +
          "Rules: " +
          "(1) ai_hook_title: clean factual headline. Strip podcast/show labels. No clickbait. " +
          "(2) body: 150-280 words MAX. Plain English. Structure: " +
          "paragraph 1 = what happened; paragraph 2 = who/where/numbers; paragraph 3 = why it matters. " +
          "ONLY facts from the source. No invented quotes. No filler. Never write phrases like " +
          "'RockBrief summary is based on', 'attributed source material', 'open the original publisher', or 'continue reading'. " +
          "(3) ai_summary: exactly 4 bullets. Each bullet is a DIFFERENT fact (25-40 words). Never repeat the same sentence. Never meta text. " +
          "(4) tags: 2-4 hashtags. " +
          "(5) image_query: the main PERSON or SUBJECT for a photo (e.g. 'Donald Trump', 'Lagos Nigeria'). Never insects, stock abstract, or random animals. " +
          "(6) africa_lens: 40-90 words only if Africa is genuinely relevant; else one honest sentence. " +
          "TITLE: " +
          cleanTitle +
          " DESCRIPTION: " +
          desc +
          " RELATED: " +
          JSON.stringify((related || []).slice(0, 4)),
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
    // Cap runaway long bodies — readers want a brief
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
    const imageQuery = clean(parsed.image_query) || cleanTitle;

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

export { MIN_BODY_WORDS, MIN_BULLET_WORDS, BULLET_COUNT, wordCount, normalizeBullets };
