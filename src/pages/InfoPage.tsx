import { useEffect, useState, type FormEvent } from "react";
import { Helmet } from "react-helmet-async";
import { logRwdNewsEvent } from "../lib/analytics";
import { SiteFooter } from "../components/SiteFooter";

const content: Record<string, { title: string; intro: string; sections: Array<[string, string]> }> = {
  "/about": {
    title: "About RockBrief",
    intro:
      "RockBrief is a global news briefing platform. We bring the world’s wire into one place — short, clear summaries so you understand the story fast, with original sources always credited. We are building a brand people trust on every continent, not a copy of any single publisher.",
    sections: [
      [
        "Our promise",
        "Come to RockBrief when you want the essentials without the noise. Every briefing is meant to be honest, readable on mobile, and linked back to the publishers who did the primary reporting.",
      ],
      [
        "What we do",
        "We discover current reports from publishers and open news sources worldwide, then present concise briefings with source attribution. RockBrief does not replace the original publisher. If you need quotes, full context or legal detail, open the source link we provide.",
      ],
      [
        "Global by design",
        "Our desk covers world affairs, sports, technology, business and regional stories — including Africa, Europe, Asia and the Americas. Language support is expanding so more readers can use the same trusted briefings in their language.",
      ],
      [
        "AI-assisted, not AI-invented",
        "Automation may help classify, summarize and organize reports. We use the supplied source material and do not intentionally invent facts, injuries, scores or quotes. Sports scores come from data providers; predictions are labeled as outlooks, not guarantees.",
      ],
      [
        "Trust & corrections",
        "If you spot a wrong attribution, image issue or factual problem in a briefing, contact the RockBrief team. We review and correct. Trust is earned by fixing mistakes in public, not by hiding them.",
      ],
    ],
  },
  "/editorial": {
    title: "Editorial standards",
    intro:
      "RockBrief follows one rule: source first, context second, automation third. Readers should feel safe relying on our briefings as a starting point — never as a substitute for the original report when stakes are high.",
    sections: [
      [
        "Source-backed coverage",
        "Stories are discovered from publisher feeds and open news indexes. A developing item can be labeled as developing rather than presented as settled fact.",
      ],
      [
        "Attribution",
        "Publisher names and original links stay visible. Briefings are summaries. We do not claim ownership of other outlets’ reporting.",
      ],
      [
        "No fabricated breaking news",
        "When the live wire is unavailable, the site does not invent headlines to fill empty space.",
      ],
      [
        "Images",
        "We prefer feed thumbnails and licensed stock (for example Pexels/Unsplash). We do not present other publishers’ photos as our own exclusive photography.",
      ],
      [
        "Sports & predictions",
        "Live scores and fixtures come from data APIs. Match outlooks are informational analysis only — not betting advice. Affiliates, when shown, are labeled and optional.",
      ],
      [
        "Advertising",
        "Paid placements are disclosed. Money does not buy a fake news story or hide a correction.",
      ],
    ],
  },
  "/privacy": {
    title: "Privacy",
    intro:
      "RockBrief collects only what is needed to run the service, understand aggregate engagement, handle newsletters and respond to advertising inquiries.",
    sections: [
      [
        "Analytics",
        "We may record aggregate events such as page views, article opens and traffic sources. Analytics are designed to avoid storing your name or email as a default visitor identifier.",
      ],
      [
        "Newsletter",
        "If you subscribe, your email is stored for that purpose. Do not submit sensitive personal data through public forms.",
      ],
      [
        "Advertising",
        "Paid placements are disclosed. Third-party ads may use cookies under the provider’s policies.",
      ],
      [
        "Your choices",
        "You may unsubscribe and use browser privacy controls. For privacy questions or deletion requests, contact the RockBrief operator.",
      ],
    ],
  },
  "/terms": {
    title: "Terms of use",
    intro:
      "By using RockBrief you agree to use the service lawfully and understand that briefings are general information, not professional advice.",
    sections: [
      [
        "Content",
        "RockBrief aggregates and summarizes third-party reports. Original publishers retain rights in their material.",
      ],
      [
        "No guarantee",
        "News moves quickly and automated systems can err. Verify important decisions with primary sources.",
      ],
      [
        "Third-party links",
        "Links to publishers, sponsors or affiliates lead to third-party sites with their own terms.",
      ],
    ],
  },
};

const packages = [
  { code: "sidebar", name: "Sidebar Sponsor", usd: 75, placement: "sidebar", detail: "Premium sidebar visibility" },
  { code: "in_feed", name: "In-feed Sponsor", usd: 100, placement: "in_feed", detail: "Native placement within the news experience" },
  { code: "homepage", name: "Homepage Featured", usd: 150, placement: "both", detail: "High-visibility homepage placement" },
  { code: "homepage_sidebar", name: "Homepage + Sidebar", usd: 200, placement: "both", detail: "Homepage visibility plus sidebar presence" },
  { code: "newsletter", name: "Newsletter Sponsor", usd: 75, placement: "newsletter", detail: "One featured sponsor placement per month" },
  { code: "sponsored_story", name: "Sponsored Article / Briefing", usd: 150, placement: "in_feed", detail: "One clearly labeled sponsored briefing per month" },
  { code: "premium", name: "Premium Campaign", usd: 300, placement: "both", detail: "Homepage + sidebar + in-feed priority" },
] as const;

function money(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);
}

function addMonths(date: Date, months: number) {
  const next = new Date(date);
  next.setMonth(next.getMonth() + months);
  return next;
}

function AdvertisePage() {
  const [selected, setSelected] = useState(packages[0].code);
  const [months, setMonths] = useState(1);
  const [form, setForm] = useState({
    email: "", name: "", company: "", headline: "", cta_url: "",
    creative_mode: "upload", creative_url: "", creative_notes: "",
  });
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const selectedPackage = packages.find((p) => p.code === selected) || packages[0];
  const total = selectedPackage.usd * months;
  const startDate = new Date();
  const endDate = addMonths(startDate, months);
  const creativeSpec = selected === "sidebar"
    ? "Vertical or square creative · mobile-safe"
    : selected === "newsletter"
      ? "Landscape email banner · mobile-safe"
      : "Responsive landscape creative · desktop + mobile";

  useEffect(() => {
    void logRwdNewsEvent({ event: "page_view", placement: "advertise_page" });
    const params = new URLSearchParams(window.location.search);
    const reference = params.get("reference");
    if (!reference || params.get("payment") !== "callback") return;
    setBusy(true);
    fetch("/api/kora/verify?reference=" + encodeURIComponent(reference))
      .then((r) => r.json())
      .then((result) =>
        setMessage(
          result.ok
            ? "Payment received. Your campaign is now awaiting review."
            : "We could not confirm this payment yet. Please contact RockBrief with your payment reference.",
        ),
      )
      .catch(() => setMessage("We could not confirm the payment yet. Please contact RockBrief with your payment reference."))
      .finally(() => setBusy(false));
  }, []);

  const uploadCreative = async (file: File) => {
    if (!["image/jpeg","image/png","image/webp","image/avif"].includes(file.type)) throw new Error("Use JPG, PNG, WebP or AVIF.");
    if (file.size > 4 * 1024 * 1024) throw new Error("Creative must be 4 MB or smaller.");
    const data = await new Promise<string>((resolve,reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = () => reject(new Error("Could not read creative."));
      reader.readAsDataURL(file);
    });
    const response = await fetch("/api/advertiser/creative-upload", {
      method: "POST",
      headers: {"content-type":"application/json"},
      body: JSON.stringify({data,mime_type:file.type}),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || "Creative upload failed.");
    setForm(v => ({...v, creative_url: String(payload.url || "")}));
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      const result = await fetch("/api/kora/init", {
        method: "POST",
        headers: {"content-type":"application/json"},
        body: JSON.stringify({ package_code: selected, months, currency: "USD", ...form }),
      });
      const payload = await result.json().catch(() => ({}));
      if (!result.ok) throw new Error(payload.error || "Could not start payment.");
      if (!payload.authorization_url) throw new Error("Payment checkout URL was not returned.");
      window.location.assign(payload.authorization_url);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not start payment.");
      setBusy(false);
    }
  };

  return (
    <div className="min-h-dvh bg-white text-neutral-950">
      <Helmet>
        <title>Advertise with RockBrief</title>
        <meta name="description" content="Global advertising opportunities on RockBrief with flexible monthly campaigns and secure USD checkout." />
      </Helmet>
      <header className="sticky top-0 z-30 border-b border-neutral-200/80 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
          <a href="/" className="font-display text-2xl font-bold tracking-tight">RockBrief</a>
          <a href="/" className="rounded-full px-3 py-2 text-sm font-semibold text-teal-800 hover:bg-teal-50">Back to news</a>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
        <div className="max-w-3xl">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-amber-800">Global advertising</p>
          <h1 className="font-display mt-2 text-4xl font-semibold tracking-tight sm:text-5xl">Put your brand in the story.</h1>
          <p className="mt-4 text-base leading-relaxed text-neutral-600 sm:text-lg">
            Choose a placement, select how long you want to run it, and review your exact campaign total before checkout.
          </p>
        </div>

        {message ? <div role="status" className="mt-6 rounded-2xl border border-teal-200 bg-teal-50 p-4 text-sm text-teal-900">{message}</div> : null}

        <section className="mt-8">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-neutral-500">1. Choose placement</p>
              <h2 className="font-display mt-1 text-2xl font-semibold">Build your campaign</h2>
            </div>
            <span className="hidden rounded-full bg-neutral-100 px-3 py-1 text-xs font-semibold text-neutral-600 sm:inline-flex">Prices in USD</span>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {packages.map((p) => (
              <button
                type="button"
                key={p.code}
                aria-pressed={selected === p.code}
                onClick={() => setSelected(p.code)}
                className={selected === p.code
                  ? "rounded-2xl border-2 border-neutral-950 bg-neutral-950 p-5 text-left text-white shadow-lg"
                  : "rounded-2xl border border-neutral-200 bg-white p-5 text-left transition hover:-translate-y-0.5 hover:border-neutral-400 hover:shadow-md"}
              >
                <div className="flex items-start justify-between gap-3">
                  <p className="text-xs font-bold uppercase tracking-wider">{p.name}</p>
                  {selected === p.code ? <span className="rounded-full bg-white/15 px-2 py-1 text-[10px] font-bold">Selected</span> : null}
                </div>
                <p className="font-display mt-3 text-3xl font-semibold">{money(p.usd)}<span className={selected === p.code ? "text-sm font-medium text-neutral-300" : "text-sm font-medium text-neutral-500"}>/month</span></p>
                <p className={selected === p.code ? "mt-2 text-sm leading-relaxed text-neutral-300" : "mt-2 text-sm leading-relaxed text-neutral-500"}>{p.detail}</p>
              </button>
            ))}
          </div>
        </section>

        <div className="mt-10 grid gap-8 lg:grid-cols-[minmax(0,1fr)_360px]">
          <section className="rounded-3xl border border-neutral-200 bg-white p-5 shadow-sm sm:p-7">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-neutral-500">2. Choose duration</p>
                <h2 className="font-display mt-1 text-2xl font-semibold">{selectedPackage.name}</h2>
              </div>
              <span className="rounded-full bg-neutral-100 px-3 py-1 text-xs font-bold text-neutral-700">USD</span>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {[1,2,3,4].map((value) => (
                <button key={value} type="button" onClick={() => setMonths(value)} aria-pressed={months === value}
                  className={months === value ? "rounded-xl bg-neutral-950 px-3 py-3 text-sm font-bold text-white" : "rounded-xl border border-neutral-200 px-3 py-3 text-sm font-bold text-neutral-700 hover:border-neutral-400"}>
                  {value} month{value > 1 ? "s" : ""}
                </button>
              ))}
            </div>
            <div className="mt-3">
              <label className="text-xs font-semibold text-neutral-600" htmlFor="campaign-months">Custom duration</label>
              <select id="campaign-months" value={months} onChange={(e) => setMonths(Math.max(1, Math.min(12, Number(e.target.value))))}
                className="mt-1 h-11 w-full rounded-xl border border-neutral-200 bg-white px-3 text-sm sm:max-w-xs">
                {Array.from({length:12},(_,i)=>i+1).map(value => <option key={value} value={value}>{value} month{value > 1 ? "s" : ""}</option>)}
              </select>
              <p className="mt-2 text-xs text-neutral-500">Run from checkout for 1–12 months. Your campaign end date is calculated automatically.</p>
            </div>

            <form onSubmit={submit} className="mt-7 space-y-4">
              <p className="text-xs font-bold uppercase tracking-wider text-neutral-500">3. Campaign details</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <input required type="email" placeholder="Business email" value={form.email} onChange={e=>setForm(v=>({...v,email:e.target.value}))} className="h-12 w-full rounded-xl border border-neutral-200 px-3 text-sm outline-none focus:border-neutral-950 focus:ring-2 focus:ring-neutral-950/10" />
                <input placeholder="Your name" value={form.name} onChange={e=>setForm(v=>({...v,name:e.target.value}))} className="h-12 w-full rounded-xl border border-neutral-200 px-3 text-sm outline-none focus:border-neutral-950 focus:ring-2 focus:ring-neutral-950/10" />
              </div>
              <input required placeholder="Company / brand" value={form.company} onChange={e=>setForm(v=>({...v,company:e.target.value}))} className="h-12 w-full rounded-xl border border-neutral-200 px-3 text-sm outline-none focus:border-neutral-950 focus:ring-2 focus:ring-neutral-950/10" />
              <input required placeholder="Campaign headline" value={form.headline} onChange={e=>setForm(v=>({...v,headline:e.target.value}))} className="h-12 w-full rounded-xl border border-neutral-200 px-3 text-sm outline-none focus:border-neutral-950 focus:ring-2 focus:ring-neutral-950/10" />
              <input type="url" placeholder="Website URL / destination" value={form.cta_url} onChange={e=>setForm(v=>({...v,cta_url:e.target.value}))} className="h-12 w-full rounded-xl border border-neutral-200 px-3 text-sm outline-none focus:border-neutral-950 focus:ring-2 focus:ring-neutral-950/10" />

              <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4 sm:p-5">
                <p className="text-xs font-bold uppercase tracking-wider text-neutral-500">4. Creative</p>
                <p className="mt-1 text-xs leading-relaxed text-neutral-600">{creativeSpec}. JPG, PNG, WebP or AVIF · max 4 MB.</p>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  <button type="button" onClick={()=>setForm(v=>({...v,creative_mode:"upload"}))} className={form.creative_mode==="upload"?"rounded-xl bg-neutral-950 px-3 py-3 text-xs font-bold text-white":"rounded-xl border border-neutral-200 bg-white px-3 py-3 text-xs font-bold"}>I have my advert</button>
                  <button type="button" onClick={()=>setForm(v=>({...v,creative_mode:"design"}))} className={form.creative_mode==="design"?"rounded-xl bg-neutral-950 px-3 py-3 text-xs font-bold text-white":"rounded-xl border border-neutral-200 bg-white px-3 py-3 text-xs font-bold"}>Have RockBrief design it</button>
                </div>
                {form.creative_mode==="upload" ? (
                  <div className="mt-3">
                    <label className="block cursor-pointer rounded-xl border border-dashed border-neutral-300 bg-white p-5 text-center text-xs font-semibold hover:border-neutral-500">
                      Upload advert creative
                      <input type="file" accept="image/jpeg,image/png,image/webp,image/avif" className="hidden" onChange={e=>{const f=e.target.files?.[0]; if(f) void uploadCreative(f).catch(err=>setMessage(err instanceof Error?err.message:"Creative upload failed."));}} />
                    </label>
                    {form.creative_url ? <img src={form.creative_url} alt="Advert creative preview" className="mt-3 max-h-56 w-full rounded-xl object-contain" /> : null}
                  </div>
                ) : (
                  <textarea required placeholder="Tell the RockBrief design team about your product, offer, CTA and preferred style…" value={form.creative_notes} onChange={e=>setForm(v=>({...v,creative_notes:e.target.value}))} className="mt-3 min-h-28 w-full rounded-xl border border-neutral-200 bg-white p-3 text-sm outline-none focus:border-neutral-950 focus:ring-2 focus:ring-neutral-950/10" />
                )}
              </div>

              <button disabled={busy} className="h-13 w-full rounded-xl bg-neutral-950 px-4 text-sm font-bold text-white shadow-lg transition hover:opacity-90 disabled:opacity-50">
                {busy ? "Preparing secure checkout…" : "Continue to secure checkout"}
              </button>
            </form>
          </section>

          <aside className="lg:sticky lg:top-24 lg:self-start">
            <div className="rounded-3xl border border-neutral-200 bg-neutral-950 p-6 text-white shadow-xl">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-neutral-400">Campaign summary</p>
              <h3 className="font-display mt-2 text-2xl font-semibold">{selectedPackage.name}</h3>
              <div className="mt-5 space-y-3 text-sm">
                <div className="flex justify-between gap-4"><span className="text-neutral-400">Monthly rate</span><strong>{money(selectedPackage.usd)}</strong></div>
                <div className="flex justify-between gap-4"><span className="text-neutral-400">Duration</span><strong>{months} month{months > 1 ? "s" : ""}</strong></div>
                <div className="border-t border-white/10 pt-3 flex justify-between gap-4"><span className="text-neutral-400">Campaign total</span><strong className="text-2xl">{money(total)}</strong></div>
              </div>
              <div className="mt-5 rounded-2xl bg-white/5 p-4 text-xs leading-relaxed text-neutral-300">
                Starts after payment and review. End date: {endDate.toLocaleDateString("en-US", {month:"short",day:"numeric",year:"numeric"})}.
              </div>
            </div>
            <div className="mt-4 rounded-2xl border border-neutral-200 p-5">
              <p className="text-xs font-bold uppercase tracking-wider text-neutral-500">How it works</p>
              <ol className="mt-3 space-y-3 text-sm text-neutral-600">
                <li><strong>1.</strong> Choose your placement and duration.</li>
                <li><strong>2.</strong> Submit your campaign and creative.</li>
                <li><strong>3.</strong> Complete secure USD payment.</li>
                <li><strong>4.</strong> Our team reviews and activates the campaign.</li>
              </ol>
            </div>
            <p className="mt-4 text-xs leading-relaxed text-neutral-500">Paid placements are clearly labeled and remain separate from editorial coverage.</p>
          </aside>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}

export function InfoPage({ path }: { path: string }) {
  if (path === "/advertise") return <AdvertisePage />;
  const page = content[path] || content["/about"];
  return (
    <div className="min-h-dvh bg-white text-neutral-950">
      <Helmet>
        <title>{page.title} — RockBrief</title>
        <meta name="description" content={page.intro} />
      </Helmet>
      <header className="sticky top-0 z-20 border-b border-neutral-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-4 sm:px-6">
          <a href="/" className="font-display text-xl font-bold sm:text-2xl">
            RockBrief
          </a>
          <a href="/" className="text-sm font-semibold text-teal-800">
            Back to news
          </a>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-12">
        <p className="text-[10px] font-bold tracking-[0.18em] text-amber-800 uppercase">RockBrief</p>
        <h1 className="font-display mt-2 text-3xl font-semibold sm:text-4xl">{page.title}</h1>
        <p className="mt-4 text-base leading-relaxed text-neutral-600 sm:text-lg">{page.intro}</p>
        <div className="mt-10 space-y-8">
          {page.sections.map(([heading, body]) => (
            <section key={heading}>
              <h2 className="font-display text-lg font-semibold sm:text-xl">{heading}</h2>
              <p className="mt-2 leading-relaxed text-neutral-700">{body}</p>
            </section>
          ))}
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
