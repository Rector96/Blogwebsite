/**
 * Enhanced RockBrief AI brief — Africa lens built into every story.
 * Called from news.ts when available; falls back to inline aiBrief if import fails.
 */
import { GoogleGenAI, Type } from "@google/genai";
import { mergeAfricaLensIntoBody } from "./rockbrief-intelligence.mjs";

function clean(value) {
  return String(value || "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}
function stripJunk(value) {
  let x = clean(value);
  x = x.replace(/\s*Read\s*More\s*:?\s*https?:\/\/\S+/gi, "");
  x = x.replace(/https?:\/\/\S+/gi, "");
  return x.replace(/\s+/g, " ").trim();
}

export async function enhancedAiBrief(title, desc, related = [], useGrounding = false) {
  const fallback = {
    ai_hook_title: String(title).replace(/^(\[.*?\]|BREAKING:?)/i, "").trim() || title,
    body: "",
    ai_summary: [String(desc || "").slice(0, 280)].filter((x) => x.length > 20),
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
          "You are RockBrief, a global news desk with a sharp Africa + emerging-markets lens. JSON only. " +
          "(1) ai_hook_title: factual headline, no clickbait. " +
          "(2) body: 550-800 words, clear natural English, only supported facts; explain what happened, who is involved, and global context. " +
          "(3) ai_summary: exactly 4 bullets, 30-55 words each. " +
          "(4) tags: 2-4 hashtags. " +
          "(5) image_query: 3-8 words naming the real person, place, club, product or subject — never invent. " +
          "(6) africa_lens: 80-160 words on why this matters for Africa (fuel, FX, trade, jobs, football, policy, diaspora). " +
          "If limited relevance, say so honestly in 2 sentences — never invent African facts. " +
          "Do not invent quotes, scores, election outcomes, or casualty numbers. Attribute contested claims. " +
          "TITLE: " + title + " DESCRIPTION: " + desc + " RELATED REPORTS: " + JSON.stringify((related || []).slice(0, 5)),
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
      new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), 12000)),
    ]);

    const textOut = response?.text;
    if (!textOut) return fallback;
    const parsed = JSON.parse(textOut);
    let body = stripJunk(String(parsed.body || "")).slice(0, 12000);
    const africa = stripJunk(String(parsed.africa_lens || ""));
    body = mergeAfricaLensIntoBody(body, africa);
    const bodyWords = body.split(/\s+/).filter(Boolean).length;
    return {
      ai_hook_title: clean(parsed.ai_hook_title) || fallback.ai_hook_title,
      body: bodyWords >= 400 ? body : "",
      ai_summary: (Array.isArray(parsed.ai_summary) ? parsed.ai_summary : fallback.ai_summary)
        .map((x) => stripJunk(x))
        .filter((x) => x.length > 15)
        .slice(0, 4),
      tags: (Array.isArray(parsed.tags) ? parsed.tags : ["#World"])
        .map((x) => (String(x).startsWith("#") ? String(x) : "#" + x))
        .slice(0, 4),
      image_query: clean(parsed.image_query) || fallback.image_query,
      africa_lens: africa,
    };
  } catch {
    return fallback;
  }
}
