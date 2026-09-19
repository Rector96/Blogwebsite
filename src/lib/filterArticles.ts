import { matchesCategory, inferCategory } from "./categories";

export type FilterableArticle = {
  category?: string;
  tags?: string[];
  ai_hook_title?: string;
  original_title?: string;
  original_description?: string;
  source?: string;
  trend_label?: string;
  ai_summary?: string[];
};

/** All = everything. Other tabs = only that category (Sports, Business, Tech, ...). */
export function filterArticlesByTab<
  T extends FilterableArticle,
>(articles: T[], selectedTag: string, searchQuery = ""): T[] {
  const q = searchQuery.trim().toLowerCase();
  return articles.filter((a) => {
    if (!matchesCategory(a, selectedTag)) return false;
    if (!q) return true;
    const tags = (a.tags || []).map((t) => String(t).replace(/^#/, ""));
    const blob = [
      a.ai_hook_title,
      a.original_title,
      a.source,
      a.category,
      ...(a.ai_summary || []),
      ...tags,
    ]
      .join(" ")
      .toLowerCase();
    return blob.includes(q);
  });
}

export function withInferredCategory<
  T extends FilterableArticle,
>(articles: T[]): (T & { category: string })[] {
  return articles.map((a) => ({ ...a, category: inferCategory(a) }));
}

export { matchesCategory, inferCategory };
