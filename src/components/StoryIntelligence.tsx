import { useState } from "react";
import { ArticleComments } from "./ArticleComments";

function cleanText(value: string) {
  return String(value || "")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function storyIdFromPath() {
  if (typeof window === "undefined") return "";
  const path = window.location.pathname.replace(/^\/news\//, "");
  const marker = path.lastIndexOf("--");
  if (marker < 0) return "";
  try {
    return decodeURIComponent(path.slice(marker + 2)).trim();
  } catch {
    return "";
  }
}

export function extractAfricaLens(body: string) {
  const raw = String(body || "");
  const m = raw.match(/##\s*Why this matters in Africa\s*([\s\S]*?)(?=##\s|$)/i);
  if (!m) return "";
  return cleanText(m[1]).slice(0, 900);
}

export function StoryIntelligencePanel({
  title,
  body,
  bullets,
  articleId,
}: {
  title: string;
  body: string;
  bullets: string[];
  articleId?: string;
}) {
  const africaLens = extractAfricaLens(body);
  const [listening, setListening] = useState(false);
  const [askQ, setAskQ] = useState("");
  const [askA, setAskA] = useState("");
  const [askBusy, setAskBusy] = useState(false);
  const id = articleId || storyIdFromPath();

  const toggleListen = () => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    if (listening) {
      window.speechSynthesis.cancel();
      setListening(false);
      return;
    }
    const script = [
      title,
      ...bullets.slice(0, 3),
      africaLens ? "Why this matters in Africa. " + africaLens : "",
      "Full report on RockBrief.",
    ]
      .filter(Boolean)
      .join(". ");
    const u = new SpeechSynthesisUtterance(script.slice(0, 1200));
    u.rate = 1.02;
    u.onend = () => setListening(false);
    u.onerror = () => setListening(false);
    setListening(true);
    window.speechSynthesis.speak(u);
  };

  const askRockBrief = async () => {
    if (!askQ.trim() || askBusy) return;
    setAskBusy(true);
    setAskA("");
    try {
      const r = await fetch("/api/ask-article", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: askQ.trim().slice(0, 280),
          title,
          body: cleanText(body).slice(0, 6000),
          bullets,
        }),
      });
      const d = await r.json().catch(() => ({}));
      setAskA(String(d.answer || d.error || "Could not answer from this report."));
    } catch {
      setAskA("Ask is temporarily unavailable.");
    } finally {
      setAskBusy(false);
    }
  };

  return (
    <div className="mt-6 space-y-4">
      {africaLens ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50/90 p-5 sm:p-6">
          <p className="text-[10px] font-extrabold tracking-[0.16em] text-amber-900 uppercase">
            Why this matters in Africa
          </p>
          <p className="mt-2 text-[16px] leading-7 text-neutral-800 sm:text-[17px]">{africaLens}</p>
        </div>
      ) : null}

      <button
        type="button"
        onClick={toggleListen}
        className="rounded-full bg-neutral-950 px-4 py-2 text-xs font-bold text-white"
      >
        {listening ? "Stop audio" : "Listen · 60s brief"}
      </button>

      <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4 sm:p-5">
        <p className="text-[10px] font-extrabold tracking-[0.16em] text-neutral-500 uppercase">
          Ask RockBrief
        </p>
        <p className="mt-1 text-xs text-neutral-500">
          Answered only from this report — no invented facts.
        </p>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <input
            value={askQ}
            onChange={(e) => setAskQ(e.target.value)}
            placeholder="e.g. How does this affect fuel prices?"
            className="h-10 flex-1 rounded-xl border border-neutral-200 bg-white px-3 text-sm"
          />
          <button
            type="button"
            onClick={() => void askRockBrief()}
            disabled={askBusy}
            className="h-10 rounded-xl bg-teal-800 px-4 text-xs font-bold text-white disabled:opacity-60"
          >
            {askBusy ? "Thinking…" : "Ask"}
          </button>
        </div>
        {askA ? <p className="mt-3 text-sm leading-6 text-neutral-800">{askA}</p> : null}
      </div>

      {id ? <ArticleComments articleId={id} /> : null}
    </div>
  );
}
