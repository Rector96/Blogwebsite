/**
 * Enhanced RockBrief AI brief — Africa lens + Google-ready depth.
 * Targets: body 650–900 words, 4 bullets × 35–50 words each.
 */
import { GoogleGenAI, Type } from "@google/genai";
import { mergeAfricaLensIntoBody } from "./rockbrief-intelligence.mjs";

const MIN_BODY_WORDS = 500;
const TARGET_BODY_WORDS = 700;
const MIN_BULLET_WORDS = 35;
const BULLET_COUNT = 4;

function clean(value) {
  return String(value || "")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function stripJunk(value) {
  let x = clean(value);
  // Remove trailing "Read more" link lines only — keep cited domains in prose
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

  // Pad from description if model returned fewer than 4
  const seed = stripJunk(desc) || stripJunk(title);
  while (bullets.length < BULLET_COUNT && seed) {
    const piece = seed.slice(0, 220);
    if (!piece || bullets.includes(piece)) break;
    bullets.push(piece);
  }

  // Ensure each bullet has enough substance (pad carefully without inventing facts)
  bullets = bullets.map((b, i) => {
    if (wordCount(b) >= MIN_BULLET_WORDS) return b;
    const extra = seed && !b.includes(seed.slice(0, 40)) ? ` ${seed.slice(0, 120)}` : "";
    const filled = stripJunk(b + extra);
    return filled || b;
  });

  return bullets.slice(0, BULLET_COUNT);
}

/** Deterministic expansion when Gemini fails — still multi-paragraph, source-bound. */
function synthesizeFallbackBody(title, desc, related = []) {
  const t = clean(title);
  const d = stripJunk(desc) || t;
  const relatedLines = (Array.isArray(related) ? related : [])
    .slice(0, 4)
    .map((r) => clean(r?.title || r?.desc || r))
    .filter(Boolean);

  const paras = [
    `${t}. ${d}`,
    `What is known so far is drawn from the attributed wire material above. RockBrief summarizes the reported facts for readers who need a clear briefing without leaving the desk.`,
    relatedLines.length
      ? `Related reporting on this topic includes: ${relatedLines.join("; ")}. Those accounts should be read alongside the primary source for full detail.`
      : `Readers should consult the original publisher linked on RockBrief for the complete report, quotes, and any updates issued after this briefing was prepared.`,
    `Context matters: similar stories often affect markets, policy debates, sport governance, or household costs depending on the sector. RockBrief flags the core development first, then points to the primary source.`,
    `This RockBrief report is an original synthesis based only on the supplied source material. It does not invent figures, quotes, or outcomes. When details are contested, the underlying publisher remains the authority.`,
    `## Why this matters in Africa\n\nGlobal wires can still shape African economies through commodity prices, exchange rates, trade routes, sport competitions, and diaspora attention. Where a direct local impact is not yet clear from the source, readers should treat links as provisional and follow official and regional reporting for confirmation.`,
  ];

  // Repeat structured expansion to reach ~500+ words without inventing facts
  let body = paras.join("\n\n");
  const filler = [
    `The development was reported by the original outlet credited on this page. RockBrief does not replace that reporting; it compresses it into a readable desk briefing.`,
    `For search and clarity, the key points appear as four bullets above the full report. Those bullets are meant to be skimmed; the paragraphs here carry the fuller narrative arc.`,
    `If later updates change the facts materially, RockBrief aims to refresh the developing story rather than leave a stale briefing in place.`,
  ];
  for (const f of filler) {
    if (wordCount(body) >= TARGET_BODY_WORDS) break;
    body += "\n\n" + f;
  }
  while (wordCount(body) < MIN_BODY_WORDS) {
    body +=
      "\n\n" +
      `Additional reading: open the original source linked on RockBrief for complete context, data tables, and any corrections the publisher may issue. ${d}`;
    if (wordCount(body) > 1200) break;
  }
  return body;
}

export async function enhancedAiBrief(title, desc, related = [], useGrounding = false) {
  const fallbackBody = synthesizeFallbackBody(title, desc, related);
  const fallbackBullets = normalizeBullets(
    [
      stripJunk(desc).slice(0, 280),
      `The story was reported under the headline: ${clean(title)}.`,
      `RockBrief briefing is based on the attributed source material only.`,
      `See the full analysis below and the original publisher for complete detail.`,
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
          "You are RockBrief, a global news desk writing for Google News–quality depth. JSON only. " +
          "(1) ai_hook_title: factual headline, no clickbait. " +
          "(2) body: MUST be 650-900 words of clear natural English. Use ONLY supported facts from the source material. " +
          "Structure: opening summary; what happened; who is involved; background; implications; what to watch next. " +
          "Do not invent quotes, scores, casualty counts, or election outcomes. Attribute contested claims. " +
          "(3) ai_summary: exactly 4 bullets; each bullet MUST be 35-50 words (not short slogans). " +
          "(4) tags: 2-4 hashtags. " +
          "(5) image_query: 3-8 words naming the real person, place, club, product or subject — never invent. " +
          "(6) africa_lens: 100-160 words on why this matters for Africa (fuel, FX, trade, jobs, football, policy, diaspora). " +
          "If limited relevance, say so honestly in 3-4 sentences — never invent African facts. " +
          "TITLE: " +
          title +
          " DESCRIPTION: " +
          desc +
          " RELATED REPORTS: " +
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
      new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), 28000)),
    ]);

    const textOut = response?.text;
    if (!textOut) return fallback;
    const parsed = JSON.parse(textOut);
    let body = stripJunk(String(parsed.body || ""));
    const africa = stripJunk(String(parsed.africa_lens || ""));
    body = mergeAfricaLensIntoBody(body, africa);
    let bodyWords = wordCount(body);

    // If model returned thin body, merge with structured fallback (still source-bound)
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
      body: bodyWords >= MIN_BODY_WORDS ? body.slice(0, 16000) : fallback.body,
      ai_summary: bullets.length === BULLET_COUNT ? bullets : fallback.ai_summary,
      tags: (Array.isArray(parsed.tags) ? parsed.tags : ["#World"])
        .map((x) => (String(x).startsWith("#") ? String(x) : "#" + x))
        .slice(0, 4),
      image_query: clean(parsed.image_query) || fallback.image_query,
      africa_lens: africa,
    };
  } catch (err) {
    console.error("[RockBrief] enhancedAiBrief failed", err?.message || err);
    return fallback;
  }
}

export { MIN_BODY_WORDS, MIN_BULLET_WORDS, BULLET_COUNT, wordCount, normalizeBullets };
