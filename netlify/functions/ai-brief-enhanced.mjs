/**
 * RockBrief AI brief — useful length, not filler.
 * Target: body ~300–600 words of real context, 4 clear bullets.
 */
import { GoogleGenAI, Type } from "@google/genai";
import { mergeAfricaLensIntoBody } from "./rockbrief-intelligence.mjs";

const MIN_BODY_WORDS = 300;
const TARGET_BODY_WORDS = 450;
const MIN_BULLET_WORDS = 25;
const BULLET_COUNT = 4;

function clean(value) {
  return String(value || "")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function stripJunk(value) {
  let x = clean(value);
  x = x.replace(/\s*Read\s*More\s*:?\s*https?:\/\/\S+/gi, "");
  return x.replace(/\s+/g, " ").trim();
}

function wordCount(text) {
  return String(text || "")
    .split(/\s+/)
    .filter(Boolean).length;
}

function normalizeBullets(raw, title, desc) {
  let bullets = (Array.isArray(raw) ? raw : [])
    .map((x) => stripJunk(x))
    .filter((x) => x.length > 20)
    .slice(0, BULLET_COUNT);

  const seed = stripJunk(desc) || stripJunk(title);
  while (bullets.length < BULLET_COUNT && seed) {
    const piece = seed.slice(0, 220);
    if (!piece || bullets.includes(piece)) break;
    bullets.push(piece);
  }

  bullets = bullets.map((b) => {
    if (wordCount(b) >= MIN_BULLET_WORDS) return b;
    const extra = seed && !b.includes(seed.slice(0, 40)) ? " " + seed.slice(0, 100) : "";
    return stripJunk(b + extra) || b;
  });

  return bullets.slice(0, BULLET_COUNT);
}

/** Short source-bound briefing when Gemini is unavailable — no fluff loops. */
function synthesizeFallbackBody(title, desc, related = []) {
  const t = clean(title);
  const d = stripJunk(desc) || t;
  const relatedLines = (Array.isArray(related) ? related : [])
    .slice(0, 3)
    .map((r) => clean(r && (r.title || r.desc || r)))
    .filter(Boolean);

  const parts = [
    t + ". " + d,
    "What is reported: the details above come from the attributed source material. RockBrief restates the core facts so you can follow the story without leaving the desk.",
    relatedLines.length
      ? "Related coverage includes: " + relatedLines.join("; ") + "."
      : "For quotes, figures, and any later corrections, use the original publisher linked on this page.",
    "Context: this development may matter for policy, markets, sport, or households depending on the sector. Treat contested claims as reported, not proven, until primary sources confirm them.",
  ];
  let body = parts.join("\n\n");
  // Only pad once if still short — still from the same source text, not empty padding
  if (wordCount(body) < MIN_BODY_WORDS && d.length > 40) {
    body +=
      "\n\n" +
      "In plain terms: " +
      d +
      " Readers who need the full original report should open the source link below.";
  }
  return body;
}

export async function enhancedAiBrief(title, desc, related = [], useGrounding = false) {
  const fallbackBody = synthesizeFallbackBody(title, desc, related);
  const fallbackBullets = normalizeBullets(
    [
      stripJunk(desc).slice(0, 280),
      "Reported under the headline: " + clean(title) + ".",
      "RockBrief summary is based only on the attributed source material.",
      "Open the original publisher for full quotes and any updates after this briefing.",
    ],
    title,
    desc,
  );

  const fallback = {
    ai_hook_title: String(title).replace(/^(\[.*?\]|BREAKING:?)/i, "").trim() || title,
    body: fallbackBody,
    ai_summary: fallbackBullets,
    tags: ["#World"],
    image_query: title,
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
          "You are RockBrief, a news desk. JSON only. Write what the reader needs — not filler. " +
          "(1) ai_hook_title: factual headline, no clickbait. " +
          "(2) body: 300-550 words of clear English using ONLY supported facts from the source. " +
          "Structure: what happened; who is involved; why it matters; what to watch. " +
          "Do not invent quotes, scores, or numbers. Do not pad with generic advice. " +
          "(3) ai_summary: exactly 4 bullets; each 25-40 words with real detail. " +
          "(4) tags: 2-4 hashtags. " +
          "(5) image_query: 3-8 words naming the real subject. " +
          "(6) africa_lens: 60-120 words on Africa relevance only if honest; else 2 short sentences saying limited direct impact. " +
          "TITLE: " +
          title +
          " DESCRIPTION: " +
          desc +
          " RELATED: " +
          JSON.stringify((related || []).slice(0, 5)),
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
        }, 25000);
      }),
    ]);

    const textOut = response && response.text;
    if (!textOut) return fallback;
    const parsed = JSON.parse(textOut);
    let body = stripJunk(String(parsed.body || ""));
    const africa = stripJunk(String(parsed.africa_lens || ""));
    body = mergeAfricaLensIntoBody(body, africa);
    let bodyWords = wordCount(body);

    if (bodyWords < MIN_BODY_WORDS) {
      body = mergeAfricaLensIntoBody(
        stripJunk(body + "\n\n" + synthesizeFallbackBody(title, desc, related)),
        africa,
      );
      bodyWords = wordCount(body);
    }

    const bullets = normalizeBullets(parsed.ai_summary, title, desc);

    return {
      ai_hook_title: clean(parsed.ai_hook_title) || fallback.ai_hook_title,
      body: bodyWords >= MIN_BODY_WORDS ? body.slice(0, 12000) : fallback.body,
      ai_summary: bullets.length === BULLET_COUNT ? bullets : fallback.ai_summary,
      tags: (Array.isArray(parsed.tags) ? parsed.tags : ["#World"])
        .map(function (x) {
          return String(x).startsWith("#") ? String(x) : "#" + x;
        })
        .slice(0, 4),
      image_query: clean(parsed.image_query) || fallback.image_query,
      africa_lens: africa,
    };
  } catch (err) {
    console.error("[RockBrief] enhancedAiBrief failed", err && err.message ? err.message : err);
    return fallback;
  }
}

export { MIN_BODY_WORDS, MIN_BULLET_WORDS, BULLET_COUNT, wordCount, normalizeBullets };
