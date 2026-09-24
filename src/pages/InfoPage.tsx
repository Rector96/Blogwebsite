import { useEffect, useState, type FormEvent } from "react";
import { Helmet } from "react-helmet-async";
import { logRwdNewsEvent } from "../lib/analytics";
import { SiteFooter } from "../components/SiteFooter";

const content: Record<string, { title: string; intro: string; sections: Array<[string, string]> }> = {
  "/about": {
    title: "About RWDNEWS",
    intro:
      "RWDNEWS is a global news briefing platform. We bring the world’s wire into one place — short, clear summaries so you understand the story fast, with original sources always credited. We are building a brand people trust on every continent, not a copy of any single publisher.",
    sections: [
      [
        "Our promise",
        "Come to RWDNEWS when you want the essentials without the noise. Every briefing is meant to be honest, readable on mobile, and linked back to the publishers who did the primary reporting.",
      ],
      [
        "What we do",
        "We discover current reports from publishers and open news sources worldwide, then present concise briefings with source attribution. RWDNEWS does not replace the original publisher. If you need quotes, full context or legal detail, open the source link we provide.",
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
        "If you spot a wrong attribution, image issue or factual problem in a briefing, contact the RWDNEWS team. We review and correct. Trust is earned by fixing mistakes in public, not by hiding them.",
      ],
    ],
  },
  "/editorial": {
    title: "Editorial standards",
    intro:
      "RWDNEWS follows one rule: source first, context second, automation third. Readers should feel safe relying on our briefings as a starting point — never as a substitute for the original report when stakes are high.",
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
      "RWDNEWS collects only what is needed to run the service, understand aggregate engagement, handle newsletters and respond to advertising inquiries.",
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
        "You may unsubscribe and use browser privacy controls. For privacy questions or deletion requests, contact the RWDNEWS operator.",
      ],
    ],
  },
  "/terms": {
    title: "Terms of use",
    intro:
      "By using RWDNEWS you agree to use the service lawfully and understand that briefings are general information, not professional advice.",
    sections: [
      [
        "Content",
        "RWDNEWS aggregates and summarizes third-party reports. Original publishers retain rights in their material.",
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
  { code: "sidebar", name: "Sidebar Sponsor", usd: 75, ngn: 75000, detail: "30 days · sidebar placement" },
  { code: "in_feed", name: "In-feed Sponsor", usd: 100, ngn: 100000, detail: "30 days · inside the news feed" },
  { code: "newsletter", name: "Newsletter Sponsor", usd: 75, ngn: 75000, detail: "Per issue · newsletter placement" },
  { code: "homepage", name: "Homepage Featured", usd: 150, ngn: 150000, detail: "30 days · premium homepage placement" },
  { code: "homepage_sidebar", name: "Homepage + Sidebar", usd: 200, ngn: 200000, detail: "30 days · homepage + sidebar" },
  { code: "sponsored_story", name: "Sponsored Article / Briefing", usd: 150, ngn: 150000, detail: "Sponsored content · clearly labeled" },
  { code: "premium", name: "Premium Monthly", usd: 300, ngn: 300000, detail: "30 days · homepage + sidebar + in-feed priority" },
];

function money(value: number, currency: "USD" | "NGN") {
  return currency === "USD"
    ? "$" + value.toLocaleString("en-US")
    : "₦" + value.toLocaleString("en-NG");
}

function AdvertisePage() {
  const [selected, setSelected] = useState(packages[0].code);
  const [currency, setCurrency] = useState<"USD" | "NGN">("NGN");
  const [form, setForm] = useState({ email: "", name: "", company: "", headline: "", cta_url: "", creative_mode: "upload", creative_url: "", creative_notes: "" });
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const selectedPackage = packages.find((p) => p.code === selected) || packages[0];
  const creativeSpec = selected === "sidebar" ? "Vertical creative · mobile-safe" : selected === "newsletter" ? "Email banner · landscape" : "Landscape creative · responsive desktop + mobile";
  const price = currency === "USD" ? selectedPackage.usd : selectedPackage.ngn;

  useEffect(() => {
    void logRwdNewsEvent({ event: "page_view", placement: "advertise_page" });
    const params = new URLSearchParams(window.location.search);
    const reference = params.get("reference");
    if (!reference || params.get("payment") !== "callback") return;
    setBusy(true);
    fetch("/api/paystack/verify?reference=" + encodeURIComponent(reference))
      .then((r) => r.json())
      .then((result) =>
        setMessage(
          result.ok
            ? "Payment received. Your campaign is now awaiting admin approval."
            : "We could not confirm this payment yet. Please contact RWDNEWS with your payment reference.",
        ),
      )
      .catch(() =>
        setMessage("We could not confirm the payment yet. Please contact RWDNEWS with your payment reference."),
      )
      .finally(() => setBusy(false));
  }, []);

  const uploadCreative = async (file: File) => {
    if (!["image/jpeg","image/png","image/webp","image/avif"].includes(file.type)) throw new Error("Use JPG, PNG, WebP or AVIF.");
    if (file.size > 5 * 1024 * 1024) throw new Error("Creative must be 5 MB or smaller.");
    const data = await new Promise<string>((resolve,reject)=>{const reader=new FileReader(); reader.onload=()=>resolve(String(reader.result||"")); reader.onerror=()=>reject(new Error("Could not read creative.")); reader.readAsDataURL(file);});
    const response=await fetch("/api/advertiser/creative-upload",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({data,mime_type:file.type})});
    const payload=await response.json().catch(()=>({})); if(!response.ok) throw new Error(payload.error||"Creative upload failed.");
    setForm(v=>({...v,creative_url:String(payload.url||"")}));
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      const result = await fetch("/api/paystack/init", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ package_code: selected, currency, ...form }),
      });
      const payload = await result.json();
      if (!result.ok) throw new Error(payload.error || "Could not start payment.");
      window.location.assign(payload.authorization_url);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not start payment.");
      setBusy(false);
    }
  };

  return (
    <div className="min-h-dvh bg-white text-neutral-950">
      <Helmet>
        <title>Advertise with RWDNEWS</title>
        <meta
          name="description"
          content="Global sponsorship opportunities on RWDNEWS with USD and NGN payment options."
        />
      </Helmet>
      <header className="border-b border-neutral-200">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-5 sm:px-6">
          <a href="/" className="font-display text-2xl font-bold">
            RWDNEWS
          </a>
          <a href="/" className="text-sm font-semibold text-teal-800">
            Back to news
          </a>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
        <div className="max-w-3xl">
          <p className="text-[10px] font-bold tracking-[0.18em] text-amber-800 uppercase">
            For brands worldwide
          </p>
          <h1 className="font-display mt-2 text-4xl font-semibold sm:text-5xl">Advertise on RWDNEWS</h1>
          <p className="mt-4 text-lg leading-relaxed text-neutral-600">
            Reach a global news audience with clearly labeled sponsorships. Editorial and advertising stay
            separate.
          </p>
        </div>
        {message ? (
          <div className="mt-6 border border-teal-200 bg-teal-50 p-4 text-sm text-teal-900">{message}</div>
        ) : null}
        <div className="mt-8 flex flex-wrap items-center gap-2">
          <span className="text-xs font-bold uppercase tracking-wider text-neutral-500">Display currency</span>
          <button
            type="button"
            disabled
            className="border border-dashed px-4 py-2 text-xs font-bold text-neutral-400"
          >
            USD — Global (coming soon)
          </button>
          <button
            type="button"
            onClick={() => setCurrency("NGN")}
            className={
              currency === "NGN"
                ? "bg-neutral-950 px-4 py-2 text-xs font-bold text-white"
                : "border px-4 py-2 text-xs font-bold"
            }
          >
            NGN — Nigeria
          </button>
        </div>
        <section className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {packages.map((p) => (
            <button
              type="button"
              key={p.code}
              onClick={() => setSelected(p.code)}
              className={
                selected === p.code
                  ? "border-2 border-neutral-950 bg-neutral-950 p-5 text-left text-white"
                  : "border border-neutral-200 bg-white p-5 text-left hover:border-neutral-400"
              }
            >
              <p className="text-xs font-bold uppercase tracking-wider">{p.name}</p>
              <p className="font-display mt-2 text-3xl font-semibold">
                {money(currency === "USD" ? p.usd : p.ngn, currency)}
              </p>
              <p className={selected === p.code ? "mt-1 text-sm text-neutral-300" : "mt-1 text-sm text-neutral-500"}>
                {p.detail}
              </p>
            </button>
          ))}
        </section>
        <div className="mt-10 grid gap-8 lg:grid-cols-[1fr_360px]">
          <section className="border border-neutral-200 p-5 sm:p-7">
            <p className="text-xs font-bold uppercase tracking-wider text-neutral-500">Selected package</p>
            <h2 className="font-display mt-1 text-2xl font-semibold">{selectedPackage.name}</h2>
            <p className="mt-1 text-sm text-neutral-500">
              {money(price, currency)} · 30 days
            </p>
            <form onSubmit={submit} className="mt-6 space-y-3">
              <input
                required
                type="email"
                placeholder="Business email"
                value={form.email}
                onChange={(e) => setForm((v) => ({ ...v, email: e.target.value }))}
                className="h-11 w-full border px-3 text-sm"
              />
              <input
                placeholder="Your name"
                value={form.name}
                onChange={(e) => setForm((v) => ({ ...v, name: e.target.value }))}
                className="h-11 w-full border px-3 text-sm"
              />
              <input
                required
                placeholder="Company / brand"
                value={form.company}
                onChange={(e) => setForm((v) => ({ ...v, company: e.target.value }))}
                className="h-11 w-full border px-3 text-sm"
              />
              <input
                required
                placeholder="Campaign headline"
                value={form.headline}
                onChange={(e) => setForm((v) => ({ ...v, headline: e.target.value }))}
                className="h-11 w-full border px-3 text-sm"
              />
              <input
                type="url"
                placeholder="Website URL / destination"
                value={form.cta_url}
                onChange={(e) => setForm((v) => ({ ...v, cta_url: e.target.value }))}
                className="h-11 w-full border px-3 text-sm"
              />
              <div className="border bg-neutral-50 p-4">
                <p className="text-xs font-bold uppercase tracking-wider text-neutral-500">Creative</p>
                <p className="mt-1 text-xs text-neutral-600">{creativeSpec}. JPG, PNG, WebP or AVIF · max 5 MB.</p>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  <button type="button" onClick={()=>setForm(v=>({...v,creative_mode:"upload"}))} className={form.creative_mode==="upload"?"bg-neutral-950 px-3 py-2 text-xs font-bold text-white":"border px-3 py-2 text-xs font-bold"}>I have my advert</button>
                  <button type="button" onClick={()=>setForm(v=>({...v,creative_mode:"design"}))} className={form.creative_mode==="design"?"bg-neutral-950 px-3 py-2 text-xs font-bold text-white":"border px-3 py-2 text-xs font-bold"}>RWDNEWS design it</button>
                </div>
                {form.creative_mode==="upload" ? <div className="mt-3"><label className="block cursor-pointer border border-dashed bg-white p-4 text-center text-xs font-semibold">Upload advert creative<input type="file" accept="image/jpeg,image/png,image/webp,image/avif" className="hidden" onChange={e=>{const f=e.target.files?.[0]; if(f) void uploadCreative(f).catch(err=>setMessage(err instanceof Error?err.message:"Creative upload failed."));}} /></label>{form.creative_url ? <img src={form.creative_url} alt="Advert creative preview" className="mt-3 max-h-48 w-full rounded object-contain" /> : null}</div> : <textarea placeholder="Tell our design team what you want: product, offer, colors, CTA, preferred style…" value={form.creative_notes} onChange={e=>setForm(v=>({...v,creative_notes:e.target.value}))} className="mt-3 min-h-24 w-full border bg-white p-3 text-sm" />}
              </div>
              <button
                disabled={busy}
                className="h-12 w-full bg-neutral-950 text-sm font-bold text-white disabled:opacity-50"
              >
                Pay {money(price, currency)} with Paystack
              </button>
            </form>
          </section>
          <aside className="space-y-4">
            <div className="border border-neutral-200 bg-neutral-50 p-5">
              <h3 className="font-display text-xl font-semibold">Payment notes</h3>
              <p className="mt-2 text-sm leading-relaxed text-neutral-600">
                NGN is available now. USD/global card payments depend on Paystack configuration for your
                business.
              </p>
            </div>
            <div className="border border-neutral-200 p-5">
              <p className="text-xs font-bold uppercase tracking-wider text-neutral-500">Editorial separation</p>
              <p className="mt-2 text-sm leading-relaxed text-neutral-600">
                Paid placements are clearly labeled and do not purchase editorial treatment.
              </p>
            </div>
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
        <title>{page.title} — RWDNEWS</title>
        <meta name="description" content={page.intro} />
      </Helmet>
      <header className="sticky top-0 z-20 border-b border-neutral-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-4 sm:px-6">
          <a href="/" className="font-display text-xl font-bold sm:text-2xl">
            RWDNEWS
          </a>
          <a href="/" className="text-sm font-semibold text-teal-800">
            Back to news
          </a>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-12">
        <p className="text-[10px] font-bold tracking-[0.18em] text-amber-800 uppercase">RWDNEWS</p>
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
