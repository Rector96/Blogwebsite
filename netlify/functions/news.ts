import Parser from "rss-parser";
import { GLOBAL_NEWS_SOURCES } from "./news-sources";
import { GoogleGenAI, Type } from "@google/genai";
import { createClient } from "@supabase/supabase-js";
import { resolveSafeCover, isBadCover } from "./safe-image.mjs";
import { enhancedAiBrief, MIN_BODY_WORDS, MIN_BULLET_WORDS, BULLET_COUNT } from "./ai-brief-enhanced.mjs";

export type NewsArticle = {
  id: string;
  original_url: string;
  image: string;
  timestamp: string;
  source: string;
  original_title: string;
  original_description: string;
  ai_hook_title: string;
  ai_summary: string[];
  tags: string[];
  read_time: string;
  category: string;
  region: string;
  trend_score: number;
  trend_label: "Breaking" | "Trending" | "Developing" | "Fresh";
  image_credit: string;
  image_license: string;
  image_source_url: string;
  discovered_via: string[];
  body?: string;
  story_type?: string;
  author_name?: string;
  subject?: string;
  editorial_status?: string;
  featured?: boolean;
  pinned?: boolean;
};

const PLACEHOLDER_IMAGE = "https://rwdnews.netlify.app/rwdnews-logo.svg";

function validatePublishableArticle(article: NewsArticle) {
  const bodyWords = String(article.body || "").split(/\s+/).filter(Boolean).length;
  const title = clean(article.ai_hook_title || article.original_title);
  const sourceUrl = String(article.original_url || "");
  const summary = Array.isArray(article.ai_summary)
    ? article.ai_summary.map((x) => clean(x)).filter(Boolean)
    : [];
  const validUrl = sourceUrl.startsWith("http://") || sourceUrl.startsWith("https://");
  const minBody = typeof MIN_BODY_WORDS === "number" ? MIN_BODY_WORDS : 120;
  const hasBrief = bodyWords >= Math.min(80, minBody) || summary.length >= 2;
  return Boolean(title && title.length >= 12 && validUrl && hasBrief);
}
