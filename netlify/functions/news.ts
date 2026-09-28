import Parser from "rss-parser";
import { GLOBAL_NEWS_SOURCES } from "./news-sources";
import { GoogleGenAI, Type } from "@google/genai";
import { createClient } from "@supabase/supabase-js";

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

const PLACEHOLDER_IMAGE = "/rwdnews-logo.svg";

/** Temporary restore stub — full module restored in follow-up if this deploys broken.
 *  This file must not stay as PLACEHOLDER.
 */
export async function runIngest() {
  return { articles: [] as NewsArticle[], saved: 0, generatedAt: new Date().toISOString() };
}

export async function handler() {
  const url = process.env["SUPABASE_URL"] || process.env["VITE_SUPABASE_URL"] || "";
  const key = process.env["SUPABASE_SERVICE_ROLE_KEY"] || "";
  let articles: NewsArticle[] = [];
  if (url && key) {
    try {
      const db = createClient(url, key);
      const weekAgo = new Date(Date.now() - 7 * 24 * 3600000).toISOString();
      const { data } = await db
        .from("articles")
        .select("*")
        .eq("editorial_status", "published")
        .gte("timestamp", weekAgo)
        .order("timestamp", { ascending: false })
        .limit(60);
      articles = (data || []).map((a: any) => ({
        id: String(a.id),
        original_url: String(a.original_url || ""),
        image: String(a.image || PLACEHOLDER_IMAGE),
        timestamp: a.timestamp || new Date().toISOString(),
        source: String(a.source || "RockBrief"),
        original_title: String(a.original_title || a.ai_hook_title || ""),
        original_description: String(a.original_description || ""),
        ai_hook_title: String(a.ai_hook_title || a.original_title || ""),
        ai_summary: Array.isArray(a.ai_summary) ? a.ai_summary : [],
        tags: Array.isArray(a.tags) ? a.tags : [],
        read_time: String(a.read_time || "3 min read"),
        category: String(a.category || "World"),
        region: String(a.region || "Global"),
        trend_score: 0,
        trend_label: "Fresh" as const,
        image_credit: String(a.image_credit || ""),
        image_license: String(a.image_license || ""),
        image_source_url: String(a.image_source_url || ""),
        discovered_via: [String(a.source || "RockBrief")],
        body: String(a.body || ""),
        story_type: String(a.story_type || "WIRE"),
        author_name: String(a.author_name || ""),
        subject: String(a.subject || ""),
        editorial_status: String(a.editorial_status || "published"),
        featured: Boolean(a.featured),
        pinned: Boolean(a.pinned),
      }));
      articles.sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp));
    } catch {
      articles = [];
    }
  }
  if (!articles.length) {
    try {
      const result = await runIngest();
      articles = result.articles || [];
    } catch {
      /* ignore */
    }
  }
  return {
    statusCode: 200,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "public, max-age=60, stale-while-revalidate=300",
    },
    body: JSON.stringify({ articles: articles.slice(0, 60), generatedAt: new Date().toISOString() }),
  };
}
