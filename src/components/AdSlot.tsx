import { useEffect } from "react";

const ADSENSE_CLIENT = import.meta.env.VITE_ADSENSE_CLIENT_ID as string | undefined;

export function AdSlot({ slot, format = "auto", className = "" }: { slot?: string; format?: string; className?: string }) {
  useEffect(() => {
    if (!ADSENSE_CLIENT || !slot) return;
    const existing = document.querySelector('script[data-rwdnews-adsense="true"]');
    if (!existing) {
      const script = document.createElement("script");
      script.async = true;
      script.src = "https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=" + encodeURIComponent(ADSENSE_CLIENT);
      script.crossOrigin = "anonymous";
      script.dataset.rwdnewsAdsense = "true";
      document.head.appendChild(script);
    }
    try {
      ((window as unknown as { adsbygoogle?: unknown[] }).adsbygoogle ||= []).push({});
    } catch {}
  }, [slot]);

  if (!ADSENSE_CLIENT || !slot) {
    return <div className={"ad-slot " + className} aria-label="Advertisement">Advertisement</div>;
  }

  return (
    <ins
      className={"adsbygoogle " + className}
      style={{ display: "block" }}
      data-ad-client={ADSENSE_CLIENT}
      data-ad-slot={slot}
      data-ad-format={format}
      data-full-width-responsive="true"
    />
  );
}
