import { useEffect, useState } from "react";
import { getStoredLocale, setStoredLocale, LOCALES, type LocaleCode } from "../lib/i18n";

export function LanguageSwitcher({ className = "" }: { className?: string }) {
  const [locale, setLocale] = useState<LocaleCode>("en");
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setLocale(getStoredLocale());
  }, []);

  const pick = (code: LocaleCode) => {
    setStoredLocale(code);
    setLocale(code);
    setOpen(false);
    // Notify app chrome; full story translation ships in a later pass
    window.dispatchEvent(new CustomEvent("rwdnews-locale", { detail: code }));
  };

  const current = LOCALES.find((l) => l.code === locale) || LOCALES[0];

  return (
    <div className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 rounded-full border border-neutral-200 bg-white px-2.5 py-1.5 text-[11px] font-bold text-neutral-700"
        aria-label="Language"
        aria-expanded={open}
      >
        <span className="uppercase tracking-wide">{current.code}</span>
        <span className="hidden text-neutral-400 sm:inline">▾</span>
      </button>
      {open ? (
        <>
          <button
            type="button"
            className="fixed inset-0 z-40"
            aria-label="Close language menu"
            onClick={() => setOpen(false)}
          />
          <ul className="absolute right-0 z-50 mt-1 min-w-[160px] overflow-hidden rounded-xl border border-neutral-200 bg-white py-1 shadow-lg">
            {LOCALES.map((l) => (
              <li key={l.code}>
                <button
                  type="button"
                  onClick={() => pick(l.code)}
                  className={`flex w-full items-center justify-between px-3 py-2.5 text-left text-sm ${
                    locale === l.code ? "bg-neutral-100 font-bold" : "hover:bg-neutral-50"
                  }`}
                >
                  <span>{l.native}</span>
                  {!l.ready ? (
                    <span className="text-[10px] font-semibold text-amber-700">Soon</span>
                  ) : null}
                </button>
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </div>
  );
}
