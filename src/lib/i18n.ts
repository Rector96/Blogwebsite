/** RWDNEWS language foundation — UI chrome first; story translation comes later. */

export type LocaleCode = "en" | "fr" | "es" | "pt";

export const LOCALES: { code: LocaleCode; label: string; native: string; ready: boolean }[] = [
  { code: "en", label: "English", native: "English", ready: true },
  { code: "fr", label: "French", native: "Français", ready: false },
  { code: "es", label: "Spanish", native: "Español", ready: false },
  { code: "pt", label: "Portuguese", native: "Português", ready: false },
];

const STORAGE_KEY = "rwdnews_locale";

const chrome: Record<LocaleCode, Record<string, string>> = {
  en: {
    tagline: "The world’s wire, briefed clearly",
    sports: "Sports desk",
    advertise: "Advertise",
    search: "Search",
    latest: "Latest",
    sourcesCredited: "Sources always credited",
    readBriefing: "Read briefing",
    language: "Language",
    comingSoon: "Coming soon",
    global: "Global",
  },
  fr: {
    tagline: "L’actualité mondiale, résumée clairement",
    sports: "Sport",
    advertise: "Publicité",
    search: "Rechercher",
    latest: "À la une",
    sourcesCredited: "Sources toujours citées",
    readBriefing: "Lire le briefing",
    language: "Langue",
    comingSoon: "Bientôt",
    global: "Monde",
  },
  es: {
    tagline: "El cable mundial, resumido con claridad",
    sports: "Deportes",
    advertise: "Publicidad",
    search: "Buscar",
    latest: "Últimas",
    sourcesCredited: "Fuentes siempre citadas",
    readBriefing: "Leer briefing",
    language: "Idioma",
    comingSoon: "Próximamente",
    global: "Global",
  },
  pt: {
    tagline: "O fio mundial, resumido com clareza",
    sports: "Desporto",
    advertise: "Publicidade",
    search: "Pesquisar",
    latest: "Últimas",
    sourcesCredited: "Fontes sempre creditadas",
    readBriefing: "Ler briefing",
    language: "Idioma",
    comingSoon: "Em breve",
    global: "Global",
  },
};

export function getStoredLocale(): LocaleCode {
  try {
    const v = localStorage.getItem(STORAGE_KEY) as LocaleCode | null;
    if (v && LOCALES.some((l) => l.code === v)) return v;
  } catch {
    /* ignore */
  }
  return "en";
}

export function setStoredLocale(code: LocaleCode) {
  try {
    localStorage.setItem(STORAGE_KEY, code);
  } catch {
    /* ignore */
  }
}

export function t(code: LocaleCode, key: string): string {
  return chrome[code]?.[key] || chrome.en[key] || key;
}
