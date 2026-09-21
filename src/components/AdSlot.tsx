import { useEffect } from "react";

const ADSENSE_CLIENT = import.meta.env.VITE_ADSENSE_CLIENT_ID as string | undefined;

type AdSlotProps = {
  /** AdSense slot id when approved; until then shows a labeled placeholder */
  slot?: string;
  format?: string;
  className?: string;
  /** Visual placement helper for layout */
  variant?: "inline" | "feed" | "sticky" | "article";
  label?: string;
};

export function AdSlot({
  slot,
  format = "auto",
  className = "",
  variant = "inline",
  label = "Advertisement",
}: AdSlotProps) {
  useEffect(() => {
    if (!ADSENSE_CLIENT || !slot) return;
    const existing = document.querySelector('script[data-rwdnews-adsense="true"]');
    if (!existing) {
      const script = document.createElement("script");
      script.async = true;
      script.src =
        "https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=" +
        encodeURIComponent(ADSENSE_CLIENT);
      script.crossOrigin = "anonymous";
      script.dataset.rwdnewsAdsense = "true";
      document.head.appendChild(script);
    }
    try {
      ((window as unknown as { adsbygoogle?: unknown[] }).adsbygoogle ||= []).push({});
    } catch {
      /* ignore */
    }
  }, [slot]);

  const shell =
    variant === "sticky"
      ? "w-full max-w-lg mx-auto"
      : variant === "feed"
        ? "col-span-full my-1"
        : "";

  if (!ADSENSE_CLIENT || !slot) {
    return (
      <div
        className={`ad-slot flex min-h-[90px] items-center justify-center rounded-xl border border-dashed border-neutral-300 bg-neutral-50 text-[11px] font-semibold tracking-wide text-neutral-400 uppercase ${shell} ${className}`}
        aria-label={label}
        data-ad-variant={variant}
      >
        {label}
      </div>
    );
  }

  return (
    <div className={`${shell} ${className}`} data-ad-variant={variant}>
      <ins
        className="adsbygoogle"
        style={{ display: "block" }}
        data-ad-client={ADSENSE_CLIENT}
        data-ad-slot={slot}
        data-ad-format={format}
        data-full-width-responsive="true"
      />
    </div>
  );
}

/** Sticky mobile anchor — place once at bottom of high-scroll pages (sports). */
export function StickyAdBanner({ slot }: { slot?: string }) {
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center p-2 sm:p-3">
      <div className="pointer-events-auto w-full max-w-md shadow-lg">
        <AdSlot slot={slot || "sticky_mobile"} variant="sticky" label="Sponsored" className="min-h-[56px] bg-white/95 backdrop-blur" />
      </div>
    </div>
  );
}
