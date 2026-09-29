import { GoogleGenAI, Type } from "@google/genai";

/**
 * POST /api/ask-article
 * Answers ONLY from provided article body — no web search, no invented facts.
 */
export async function handler(event: any) {
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
      },
      body: "",
    };
  }
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: JSON.stringify({ error: "POST only" }) };
  }

  try {
    const body = JSON.parse(event.body || "{}");
    const question = String(body.question || "").trim().slice(0, 280);
    const title = String(body.title || "").slice(0, 300);
    const articleBody = String(body.body || "").slice(0, 7000);
    const bullets = Array.isArray(body.bullets) ? body.bullets.map(String).slice(0, 6) : [];

    if (!question || question.length < 5) {
      return {
        statusCode: 400,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: "Ask a clearer question." }),
      };
    }
    if (!articleBody || articleBody.length < 80) {
      return {
        statusCode: 400,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: "This report does not have enough text to answer from." }),
      };
    }

    const key = process.env.GEMINI_API_KEY || "";
    if (!key) {
      // Offline fallback: simple extractive answer
      const hay = (title + " " + bullets.join(" ") + " " + articleBody).toLowerCase();
      const tokens = question.toLowerCase().split(/\s+/).filter((w) => w.length > 3);
      const sentences = articleBody.split(/(?<=[.!?])\s+/).filter((s) => s.length > 40);
      const scored = sentences
        .map((s) => ({
          s,
          n: tokens.filter((t) => s.toLowerCase().includes(t)).length,
        }))
        .sort((a, b) => b.n - a.n);
      const answer =
        scored[0]?.n > 0
          ? scored
              .slice(0, 2)
              .map((x) => x.s)
              .join(" ")
          : "This report does not clearly answer that. Open the full story or the original source for more detail.";
      return {
        statusCode: 200,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
        body: JSON.stringify({ answer: answer.slice(0, 600), mode: "extractive" }),
      };
    }

    const ai = new GoogleGenAI({ apiKey: key });
    const response = await Promise.race([
      ai.models.generateContent({
        model: "gemini-2.0-flash",
        contents:
          "You answer reader questions about ONE news report only. Use only the provided text. " +
          "If the answer is not in the text, say so clearly. Never invent numbers, quotes, or outcomes. " +
          "Keep answers under 90 words, plain English. " +
          "TITLE: " + title +
          " BULLETS: " + JSON.stringify(bullets) +
          " ARTICLE: " + articleBody +
          " QUESTION: " + question,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              answer: { type: Type.STRING },
              grounded: { type: Type.BOOLEAN },
            },
            required: ["answer", "grounded"],
          },
        },
      }),
      new Promise<null>((_, reject) => setTimeout(() => reject(new Error("timeout")), 10000)),
    ]);

    const parsed = JSON.parse((response as any)?.text || "{}");
    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({
        answer: String(parsed.answer || "Could not form an answer from this report.").slice(0, 700),
        grounded: Boolean(parsed.grounded),
        mode: "gemini",
      }),
    };
  } catch (e) {
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        error: e instanceof Error ? e.message : "Ask failed",
      }),
    };
  }
}
