/** Client-side "For you" ranking — no account required. */

const KEY = "rockbrief_prefs_v1";
const READ_KEY = "rwdnews_read_story_ids";

export type UserPrefs = {
  categories: string[];
  tags: string[];
  sportsBoost: boolean;
  africaBoost: boolean;
};

const DEFAULT: UserPrefs = {
  categories: [],
  tags: [],
  sportsBoost: true,
  africaBoost: true,
};

export function loadPrefs(): UserPrefs {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULT };
    const p = JSON.parse(raw) as Partial<UserPrefs>;
    return {
      categories: Array.isArray(p.categories) ? p.categories.map(String) : [],
      tags: Array.isArray(p.tags) ? p.tags.map(String) : [],
      sportsBoost: p.sportsBoost !== false,
      africaBoost: p.africaBoost !== false,
    };
  } catch {
    return { ...DEFAULT };
  }
}

export function savePrefs(prefs: UserPrefs) {
  try {
    localStorage.setItem(KEY, JSON.stringify(prefs));
  } catch {
    /* ignore */
  }
}

/** Learn from opens: boost category of opened stories. */
export function noteArticleOpen(category?: string, tags?: string[]) {
  const prefs = loadPrefs();
  if (category) {
    const cats = [category, ...prefs.categories.filter((c) => c !== category)].slice(0, 6);
    prefs.categories = cats;
  }
  if (Array.isArray(tags)) {
    const merged = [...tags.map(String), ...prefs.tags];
    prefs.tags = [...new Set(merged)].slice(0, 12);
  }
  savePrefs(prefs);
}

export function rankForYou<T extends {
  id: string;
  category?: string;
  region?: string;
  tags?: string[];
  timestamp?: string;
  trend_score?: number;
  ai_hook_title?: string;
  original_title?: string;
}>(articles: T[], prefs?: UserPrefs): T[] {
  const p = prefs || loadPrefs();
  const cats = new Set(p.categories);
  const tagSet = new Set(p.tags.map((t) => t.toLowerCase()));
  const now = Date.now();
  return [...articles]
    .map((a) => {
      let score = Number(a.trend_score || 0);
      const ageH = Math.max(0, (now - Date.parse(a.timestamp || "") || 0) / 3600000);
      score += Math.max(0, 28 - ageH * 0.9);
      if (cats.has(String(a.category || ""))) score += 35;
      const atags = Array.isArray(a.tags) ? a.tags.map((t) => String(t).toLowerCase()) : [];
      if (atags.some((t) => [...tagSet].some((x) => t.includes(x.replace(/^#/, ""))))) score += 18;
      const blob = `${a.category} ${a.region} ${a.ai_hook_title} ${a.original_title}`;
      if (p.sportsBoost && /sport|football|soccer|nba|epl/i.test(blob)) score += 22;
      if (p.africaBoost && /africa|nigeria|ghana|kenya|senegal/i.test(blob)) score += 22;
      return { a, score };
    })
    .sort((x, y) => y.score - x.score)
    .map((x) => x.a);
}
