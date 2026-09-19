import { GoogleGenAI, Type } from "@google/genai";
import { createHmac, timingSafeEqual } from "node:crypto";
import { env, json } from "../../src/lib/paystack-server";

function signature(payload: string) {
  const secret = env("ADMIN_SESSION_SECRET");
  if (!secret) throw new Error("ADMIN_SESSION_SECRET is not configured.");
  return createHmac("sha256", secret).update(payload).digest("hex");
}
function authorized(req: Request) {
  const cookie = req.headers.get("cookie") || "";
  const match = cookie.match(/(?:^|;\s*)rwdnews_admin=([^;]+)/);
  if (!match) return false;
  const parts = match[1].split(".");
  if (parts.length !== 2) return false;
  const [payload, sig] = parts;
  const expected = signature(payload);
  if (sig.length !== expected.length) return false;
  try {
    if (!timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return false;
    return Number(JSON.parse(Buffer.from(payload, "base64url").toString("utf8")).exp) > Date.now();
  } catch { return false; }
}

const clean = (value: unknown, max = 800) => String(value || "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim().slice(0, max);

async function searchGdelt(query: string) {
  const u = new URL("https://api.gdeltproject.org/api/v2/doc/doc");
  u.searchParams.set("query", query);
  u.searchParams.set("mode", "artlist");
  u.searchParams.set("maxrecords", "30");
  u.searchParams.set("timespan", "7d");
  u.searchParams.set("sort", "datedesc");
  u.searchParams.set("format", "json");
  const r = await fetch(u, { headers: { "User-Agent": "RWDNEWS/1.0 research-desk" }, signal: AbortSignal.timeout(7000) });
  if (!r.ok) throw new Error("Research search temporarily unavailable.");
  const data = await r.json() as any;
  return (Array.isArray(data?.articles) ? data.articles : []).map((a: any) => ({
    title: clean(a.title, 300),
    url: String(a.url || ""),
    source: clean(a.domain || "Unknown", 120),
    date: a.seendate || "",
  })).filter((x: any) => x.title && x.url);
}

async function generateReport(topic: string, sources: any[]) {
  const key = env("GEMINI_API_KEY");
  if (!key) return {
    headline: topic,
    summary: "Research results are ready. Add GEMINI_API_KEY to generate the RWDNEWS research draft.",
    sections: [],
    confidence: "Source collection only",
  };
  const ai = new GoogleGenAI({ apiKey: key });
  const evidence = sources.slice(0, 20).map((s, i) => `${i + 1}. ${s.title} | ${s.source} | ${s.date} | ${s.url}`).join("\n");
  const response = await ai.models.generateContent({
    model: "gemini-3.5-flash",
    contents:
      "You are the RWDNEWS research editor. Produce an ORIGINAL research draft from ONLY the supplied source list. Do not invent facts, numbers, quotes, dates, motives, identities, causal explanations or outcomes. Do not present a source headline as proof of a claim. Distinguish confirmed/documented information from claims or unresolved points. If the source list is insufficient, explicitly say what cannot be established. Do not write propaganda or sensationalize intelligence, war or crime topics. For a documentary/explainer topic, provide historical context only where supported by the supplied sources. Return JSON with headline, summary, sections (title + 2-4 factual paragraphs), and confidence. Include source numbers in each section's source_refs array.\nTOPIC: " + topic + "\nSOURCES:\n" + evidence,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          headline: { type: Type.STRING },
          summary: { type: Type.STRING },
          sections: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { title:{type:Type.STRING}, body:{type:Type.STRING}, source_refs:{type:Type.ARRAY,items:{type:Type.INTEGER}} }, required:["title","body","source_refs"] } },
          confidence: { type: Type.STRING },
        },
        required:["headline","summary","sections","confidence"],
      },
    },
  });
  const text = (response as any)?.text;
  if (!text) throw new Error("Research draft could not be generated.");
  return JSON.parse(text);
}

export default async (req: Request) => {
  if (!authorized(req)) return json({ error: "Unauthorized" }, 401);
  const url = new URL(req.url);
  const topic = clean(url.searchParams.get("topic"), 220);
  const mode = url.searchParams.get("mode") === "documentary" ? "documentary" : "news";
  if (!topic || topic.length < 3) return json({ error: "A research topic is required." }, 400);
  try {
    const query = mode === "documentary"
      ? `("${topic}" OR "${topic}" documentary OR "${topic}" history OR "${topic}" investigation OR "${topic}" declassified)`
      : `("${topic}")`;
    const sources = await searchGdelt(query);
    const report = await generateReport(topic, sources);
    return json({
      ok: true,
      mode,
      topic,
      generatedAt: new Date().toISOString(),
      sourceCount: sources.length,
      sources,
      report,
    });
  } catch (error) {
    console.error("[RWDNEWS] research failed", error);
    return json({ error: error instanceof Error ? error.message : "Research failed." }, 502);
  }
};

export const config = { path: "/api/research" };
