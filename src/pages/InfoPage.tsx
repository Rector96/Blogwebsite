import { useEffect, useState, type FormEvent } from "react";
import { Helmet } from "react-helmet-async";
import { logRwdNewsEvent } from "../lib/analytics";

const content: Record<string, { title: string; intro: string; sections: Array<[string, string]> }> = {
  "/about": { title: "About RWDNEWS", intro: "RWDNEWS is a source-backed global news briefing platform built to help readers understand what is happening without drowning in noise.", sections: [
    ["What we do", "We discover current reports from publishers and open news sources, then present concise briefings with source attribution. RWDNEWS does not replace the original publisher."],
    ["AI-assisted, not AI-invented", "Automation may help classify, summarize, and organize reports. RWDNEWS uses supplied source material and does not intentionally invent facts. Readers can open the original report for full context."],
    ["Corrections", "If you spot an attribution, factual, image, or editorial problem, contact the RWDNEWS team so it can be reviewed and corrected."],
  ]},
  "/editorial": { title: "Editorial standards", intro: "RWDNEWS is designed around a simple rule: source first, context second, automation third.", sections: [
    ["Source-backed coverage", "Stories are discovered from publisher feeds and open news indexes. A developing item can be labeled as developing rather than presented as established fact."],
    ["Attribution", "Publisher names and original links are kept visible. RWDNEWS briefings are summaries, not a substitute for the source report."],
    ["No fabricated breaking news", "When the live wire is unavailable, the site does not quietly fill the feed with made-up headlines."],
    ["Images", "RWDNEWS uses real/source-backed images and keeps image credit information when available."],
  ]},
  "/privacy": { title: "Privacy", intro: "RWDNEWS collects only the information needed to operate the service, understand aggregate engagement, receive newsletter signups, and respond to advertising inquiries.", sections: [
    ["Analytics", "RWDNEWS records aggregate events such as page views, article opens, shares, saves and traffic-source information. The analytics system is designed to avoid storing visitor names or email addresses."],
    ["Newsletter", "If you subscribe, your email is stored for newsletter purposes. Do not submit sensitive personal information through newsletter or advertising forms."],
    ["Advertising", "Paid placements are disclosed. Third-party advertising may use cookies or similar technologies according to the provider's policies."],
    ["Your choices", "You may unsubscribe from newsletters and use browser privacy controls. For privacy questions or deletion requests, contact the RWDNEWS operator."],
  ]},
  "/terms": { title: "Terms", intro: "By using RWDNEWS, you agree to use the service lawfully and understand that briefings are provided for general information.", sections: [
    ["Content", "RWDNEWS aggregates and summarizes reports from third-party sources. Original publishers retain their rights in their material."],
    ["No guarantee", "We work to keep information accurate and current, but news can change quickly and automated systems can make mistakes. Verify consequential information with primary sources."],
    ["Third-party links", "Links to publisher, sponsor, affiliate, or advertiser sites lead to third-party services governed by their own terms and policies."],
  ]},
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
  const [form, setForm] = useState({ email: "", name: "", company: "", headline: "", cta_url: "" });
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const selectedPackage = packages.find(p => p.code === selected) || packages[0];
  const price = currency === "USD" ? selectedPackage.usd : selectedPackage.ngn;

  useEffect(() => {
    void logRwdNewsEvent({ event: "page_view", placement: "advertise_page" });
    const params = new URLSearchParams(window.location.search);
    const reference = params.get("reference");
    if (!reference || params.get("payment") !== "callback") return;
    setBusy(true);
    fetch("/api/paystack/verify?reference=" + encodeURIComponent(reference))
      .then(r => r.json())
      .then(result => setMessage(result.ok ? "Payment received. Your campaign is now awaiting admin approval." : "We could not confirm this payment yet. Please contact RWDNEWS with your payment reference."))
      .catch(() => setMessage("We could not confirm the payment yet. Please contact RWDNEWS with your payment reference."))
      .finally(() => setBusy(false));
  }, []);

  const submit = async (e: FormEvent) => {
    e.preventDefault(); setBusy(true); setMessage("");
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

  return <div className="min-h-dvh bg-white text-neutral-950">
    <Helmet><title>Advertise with RWDNEWS</title><meta name="description" content="Global sponsorship opportunities on RWDNEWS with USD and NGN payment options." /></Helmet>
    <header className="border-b border-neutral-200"><div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-5 sm:px-6"><a href="/" className="font-display text-2xl font-bold">RWDNEWS</a><a href="/" className="text-sm font-semibold text-teal-800">Back to news</a></div></header>
    <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
      <div className="max-w-3xl">
        <p className="text-[10px] font-bold tracking-[0.18em] text-amber-800 uppercase">For brands worldwide</p>
        <h1 className="font-display mt-2 text-4xl font-semibold sm:text-5xl">Advertise on RWDNEWS</h1>
        <p className="mt-4 text-lg leading-relaxed text-neutral-600">Reach a global news audience with clearly labeled sponsorships. NGN payments are available now; the USD global rate card is ready for international payment support.</p>
      </div>
      {message ? <div className="mt-6 border border-teal-200 bg-teal-50 p-4 text-sm text-teal-900">{message}</div> : null}
      <div className="mt-8 flex flex-wrap items-center gap-2">
        <span className="text-xs font-bold uppercase tracking-wider text-neutral-500">Display currency</span>
        <button type="button" disabled className="border border-dashed px-4 py-2 text-xs font-bold text-neutral-400">USD — Global (coming soon)</button>
        <button type="button" onClick={()=>setCurrency("NGN")} className={currency==="NGN" ? "bg-neutral-950 px-4 py-2 text-xs font-bold text-white" : "border px-4 py-2 text-xs font-bold"}>NGN — Nigeria</button>
      </div>
      <section className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {packages.map(p => <button type="button" key={p.code} onClick={()=>setSelected(p.code)} className={selected===p.code?"border-2 border-neutral-950 bg-neutral-950 p-5 text-left text-white":"border border-neutral-200 bg-white p-5 text-left hover:border-neutral-400"}>
          <p className="text-xs font-bold uppercase tracking-wider">{p.name}</p>
          <p className="font-display mt-2 text-3xl font-semibold">{money(currency === "USD" ? p.usd : p.ngn, currency)}</p>
          <p className={selected===p.code?"mt-1 text-sm text-neutral-300":"mt-1 text-sm text-neutral-500"}>{p.detail}</p>
        </button>)}
      </section>
      <div className="mt-10 grid gap-8 lg:grid-cols-[1fr_360px]">
        <section className="border border-neutral-200 p-5 sm:p-7">
          <p className="text-xs font-bold uppercase tracking-wider text-neutral-500">Selected package</p>
          <h2 className="font-display mt-1 text-2xl font-semibold">{selectedPackage.name}</h2>
          <p className="mt-1 text-sm text-neutral-500">{money(price, currency)} · 30 days</p>
          <form onSubmit={submit} className="mt-6 space-y-3">
            <input required type="email" placeholder="Business email" value={form.email} onChange={e=>setForm(v=>({...v,email:e.target.value}))} className="h-11 w-full border px-3 text-sm" />
            <input placeholder="Your name" value={form.name} onChange={e=>setForm(v=>({...v,name:e.target.value}))} className="h-11 w-full border px-3 text-sm" />
            <input required placeholder="Company / brand" value={form.company} onChange={e=>setForm(v=>({...v,company:e.target.value}))} className="h-11 w-full border px-3 text-sm" />
            <input required placeholder="Campaign headline" value={form.headline} onChange={e=>setForm(v=>({...v,headline:e.target.value}))} className="h-11 w-full border px-3 text-sm" />
            <input type="url" placeholder="Website URL" value={form.cta_url} onChange={e=>setForm(v=>({...v,cta_url:e.target.value}))} className="h-11 w-full border px-3 text-sm" />
            <button disabled={busy} className="h-12 w-full bg-neutral-950 text-sm font-bold text-white disabled:opacity-50">Pay {money(price, currency)} with Paystack</button>
          </form>
          <p className="mt-3 text-xs leading-relaxed text-neutral-500">Payment confirms the transaction. RWDNEWS still reviews and approves the campaign before it appears publicly.</p>
        </section>
        <aside className="space-y-4">
          <div className="border border-neutral-200 bg-neutral-50 p-5">
            <h3 className="font-display text-xl font-semibold">Payment notes</h3>
            <p className="mt-2 text-sm leading-relaxed text-neutral-600">Paystack supports USD for eligible Nigeria-based businesses, but USD/international payments must be enabled on your Paystack account. If USD is not enabled yet, use NGN or enable USD in Paystack before launching international campaigns.</p>
            <p className="mt-3 text-sm leading-relaxed text-neutral-600">USD prices are the global RWDNEWS rate card and will be enabled for Paystack international payments later. NGN prices are the local Nigerian rate card; they are not an automatic exchange-rate conversion.</p>
          </div>
          <div className="border border-neutral-200 p-5">
            <p className="text-xs font-bold uppercase tracking-wider text-neutral-500">Editorial separation</p>
            <p className="mt-2 text-sm leading-relaxed text-neutral-600">Paid placements are clearly labeled and do not purchase editorial treatment.</p>
          </div>
        </aside>
      </div>
    </main>
  </div>;
}

export function InfoPage({ path }: { path: string }) {
  if (path === "/advertise") return <AdvertisePage />;
  const page = content[path] || content["/about"];
  return <div className="min-h-dvh bg-white text-neutral-950"><Helmet><title>{page.title} — RWDNEWS</title><meta name="description" content={page.intro} /></Helmet>
    <header className="border-b border-neutral-200"><div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-5 sm:px-6"><a href="/" className="font-display text-2xl font-bold">RWDNEWS</a><a href="/" className="text-sm font-semibold text-teal-800">Back to news</a></div></header>
    <main className="mx-auto max-w-3xl px-4 py-12 sm:px-6"><p className="text-[10px] font-bold tracking-[0.18em] text-amber-800 uppercase">RWDNEWS</p><h1 className="font-display mt-2 text-4xl font-semibold">{page.title}</h1><p className="mt-4 text-lg leading-relaxed text-neutral-600">{page.intro}</p><div className="mt-10 space-y-8">{page.sections.map(([heading, body])=><section key={heading}><h2 className="font-display text-xl font-semibold">{heading}</h2><p className="mt-2 leading-relaxed text-neutral-700">{body}</p></section>)}</div>
    </main>
  </div>;
}
