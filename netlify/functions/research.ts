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
  } catch {
    return false;
  }
}

const clean = (value: unknown, max = 1200) =>
  String(value || "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim().slice(0, max);

type Source = {
  title: string;
  url: string;
  source: string;
  date: string;
  description: string;
  canonicalUrl: string;
};

function domainOf(value: string) {
  try {
    return new URL(value).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return "";
  }
}

async function sourceMetadata(url: string) {
  try {
    const r = await fetch(url, {
      headers: { "User-Agent": "RWDNEWS/1.0 research-desk" },
      redirect: "follow",
      signal: AbortSignal.timeout(5000),
    });
    if (!r.ok) return { description: "", canonicalUrl: url };
    const html = (await r.text()).slice(0, 500_000);
    const pick = (patterns: RegExp[]) => {
      for (const pattern of patterns) {
        const match = html.match(pattern);
        if (match?.[1]) return clean(match[1], 1400);
      }
      return "";
    };
    const description = pick([
      /<meta[^>]+(?:name|property)=["']description["'][^>]+content=["']([^"']+)["']/i,
      /<meta[^>]+content=["']([^"']+)["'][^>]+(?:name|property)=["']description["']/i,
      /<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i,
      /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:description["']/i,
    ]);
    const canonical = pick([
      /<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i,
      /<link[^>]+href=["']([^"']+)["'][^>]+rel=["']canonical["']/i,
    ]);
    return { description, canonicalUrl: canonical || url };
  } catch {
    return { description: "", canonicalUrl: url };
  }
}

async function searchGdelt(query: string): Promise<Source[]> {
  const u = new URL("https://api.gdeltproject.org/api/v2/doc/doc");
  u.searchParams.set("query", query);
  u.searchParams.set("mode", "artlist");
  u.searchParams.set("maxrecords", "30");
  u.searchParams.set("timespan", "7d");
  u.searchParams.set("sort", "datedesc");
  u.searchParams.set("format", "json");

  const r = await fetch(u, {
    headers: { "User-Agent": "RWDNEWS/1.0 research-desk" },
    signal: AbortSignal.timeout(7000),
  });
  if (!r.ok) throw new Error("Research search temporarily unavailable.");

  const data = await r.json() as any;
  const base = (Array.isArray(data?.articles) ? data.articles : [])
    .map((a: any) => ({
      title: clean(a.title, 300),
      url: String(a.url || ""),
      source: clean(a.domain || "Unknown", 120),
      date: String(a.seendate || ""),
    }))
    .filter((x: any) => x.title && x.url);

  const enriched = await Promise.all(
    base.slice(0, 18).map(async (item: Omit<Source, "description" | "canonicalUrl">) => {
      const meta = await sourceMetadata(item.url);
      return { ...item, ...meta };
    }),
  );

  const seen = new Set<string>();
  return enriched.filter((item) => {
    const key = item.canonicalUrl || item.url;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function sourceQuality(sources: Source[]) {
  const domains = [...new Set(sources.map((s) => domainOf(s.canonicalUrl || s.url)).filter(Boolean))];
  return {
    sourceCount: sources.length,
    independentDomains: domains.length,
    domains: domains.slice(0, 12),
    corroborated: domains.length >= 2,
  };
}

async function generateReport(topic: string, sources: Source[], mode: "news" | "documentary") {
  const key = env("GEMINI_API_KEY");
  const quality = sourceQuality(sources);

  if (!key) {
    return {
      headline: topic,
      summary: "The source collection is ready, but an AI research draft is not generated until GEMINI_API_KEY is configured.",
      sections: [],
      confidence: "Source collection only",
      verification: quality,
    };
  }

  const ai = new GoogleGenAI({ apiKey: key });
  const evidence = sources.slice(0, 18).map((s, i) =>
    [
      "SOURCE " + (i + 1),
      "Publisher: " + s.source,
      "Date: " + (s.date || "not supplied"),
      "Title: " + s.title,
      "Description: " + (s.description || "not supplied"),
      "URL: " + (s.canonicalUrl || s.url),
    ].join(" | "),
  ).join("\n");

  const response = await ai.models.generateContent({
    model: "gemini-3.5-flash",
    contents:
      "You are the RWDNEWS senior research editor. Write a source-backed editorial research report from ONLY the supplied source records.\n\n" +
      "NON-NEGOTIABLE ACCURACY RULES:\n" +
      "- Never invent a fact, number, quote, date, person, organization, event, cause, motive, outcome, location or statistic.\n" +
      "- A headline alone is not proof. Use a claim only when the supplied source record supports it.\n" +
      "- Do not silently merge unrelated reports.\n" +
      "- Clearly distinguish confirmed/documented information, attributed claims and unresolved points.\n" +
      "- If sources disagree, state the disagreement and attribute it.\n" +
      "- If evidence is insufficient, say exactly what cannot be established.\n" +
      "- Do not create a breaking event from an old report.\n" +
      "- Do not imply that multiple outlets independently verified something when they may be repeating the same report.\n" +
      "- Do not copy publisher wording. Produce original explanatory writing.\n" +
      "- Do not reproduce long passages, quotes or copyrighted article text.\n" +
      "- Do not sensationalize war, crime, intelligence, politics, disasters or other sensitive subjects.\n" +
      "- For current news, prioritize the supplied recent evidence and do not add historical facts unless supported by the sources.\n" +
      "- For documentary/explainer mode, historical context is allowed only when supported by the supplied source records.\n" +
      "- Do not give legal, medical or financial advice.\n" +
      "- Do not use confidence language such as '100% confirmed.' Use precise evidence language instead.\n\n" +
      "LENGTH AND STRUCTURE:\n" +
      "- The report should normally be substantial: about 500-800 words when the available evidence supports it.\n" +
      "- Do not pad the report. If there is not enough evidence, make it shorter and explicitly identify the evidence gap.\n" +
      "- Begin with a clear factual summary.\n" +
      "- Then use 3-5 sections with useful context.\n" +
      "- Include what is known, what is claimed, why the development matters only when supported, and what remains unknown/next.\n" +
      "- Every section must include source_refs pointing only to supplied source numbers.\n" +
      "- Return JSON only.\n\n" +
      "MODE: " + mode + "\n" +
      "TOPIC: " + topic + "\n" +
      "SOURCE VERIFICATION SIGNAL: " + quality.independentDomains + " independent domains found; " +
      (quality.corroborated
        ? "multiple domains are present, but do not assume independent confirmation."
        : "only one or no distinct domains are present; do not describe the story as independently corroborated.") +
      "\n\nSOURCES:\n" + evidence,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          headline: { type: Type.STRING },
          summary: { type: Type.STRING },
          sections: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                title: { type: Type.STRING },
                body: { type: Type.STRING },
                source_refs: { type: Type.ARRAY, items: { type: Type.INTEGER } },
              },
              required: ["title", "body", "source_refs"],
            },
          },
          confidence: { type: Type.STRING },
        },
        required: ["headline", "summary", "sections", "confidence"],
      },
    },
  });

  const text = (response as any)?.text;
  if (!text) throw new Error("Research draft could not be generated.");

  const report = JSON.parse(text);
  return { ...report, verification: quality };
}

export default async (req: Request) => {
  if (!authorized(req)) return json({ error: "Unauthorized" }, 401);

  const url = new URL(req.url);
  const topic = clean(url.searchParams.get("topic"), 220);
  const mode = url.searchParams.get("mode") === "documentary" ? "documentary" : "news";

  if (!topic || topic.length < 3) return json({ error: "A research topic is required." }, 400);

  try {
    const query = mode === "documentary"
      ? '("' + topic + '" OR "' + topic + '" documentary OR "' + topic + '" history OR "' + topic + '" investigation OR "' + topic + '" declassified)'
      : '("' + topic + '")';

    const sources = await searchGdelt(query);

    if (!sources.length) {
      return json({
        ok: true,
        mode,
        topic,
        generatedAt: new Date().toISOString(),
        sourceCount: 0,
        sources: [],
        report: {
          headline: topic,
          summary: "No current source reports were found in the research window. RWDNEWS will not manufacture a report.",
          sections: [],
          confidence: "Insufficient evidence",
          verification: { sourceCount: 0, independentDomains: 0, domains: [], corroborated: false },
        },
      });
    }

    const report = await generateReport(topic, sources, mode);
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
