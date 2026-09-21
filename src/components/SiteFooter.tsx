const SOCIALS = [
  { label: "X / Twitter", href: "https://x.com/rwdnews", handle: "@rwdnews" },
  { label: "Facebook", href: "https://facebook.com/rwdnews", handle: "RWDNEWS" },
  { label: "Instagram", href: "https://instagram.com/rwdnews", handle: "@rwdnews" },
  { label: "WhatsApp channel", href: "https://whatsapp.com/channel/rwdnews", handle: "Join channel" },
];

export function SiteFooter() {
  return (
    <footer className="mt-16 border-t border-neutral-200 bg-[#071a2d] text-white">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 sm:px-6 md:grid-cols-3">
        <div>
          <a href="/" className="inline-block">
            <img
              src="/rwdnews-logo.svg"
              alt="RWDNEWS"
              className="h-auto w-[160px] brightness-0 invert"
            />
          </a>
          <p className="mt-4 text-sm leading-relaxed text-white/70">
            The world’s wire, briefed clearly. RWDNEWS helps readers everywhere understand the story
            fast — original sources always credited. Building a global brand you can trust.
          </p>
          <p className="mt-3 text-xs text-white/45">
            Languages: English now · Français, Español, Português coming soon (use the language control
            in the header).
          </p>
        </div>

        <div>
          <p className="text-[10px] font-extrabold tracking-[0.16em] text-amber-300 uppercase">Explore</p>
          <ul className="mt-3 space-y-2 text-sm text-white/80">
            <li>
              <a href="/" className="hover:text-white">
                Latest news
              </a>
            </li>
            <li>
              <a href="/sport" className="hover:text-white">
                Sports desk
              </a>
            </li>
            <li>
              <a href="/submit" className="hover:text-white">
                Submit a story
              </a>
            </li>
            <li>
              <a href="/about" className="hover:text-white">
                About RWDNEWS
              </a>
            </li>
            <li>
              <a href="/editorial" className="hover:text-white">
                Editorial standards
              </a>
            </li>
            <li>
              <a href="/advertise" className="hover:text-white">
                Advertise
              </a>
            </li>
          </ul>
        </div>

        <div>
          <p className="text-[10px] font-extrabold tracking-[0.16em] text-amber-300 uppercase">Follow us</p>
          <ul className="mt-3 space-y-2 text-sm text-white/80">
            {SOCIALS.map((s) => (
              <li key={s.label}>
                <a href={s.href} target="_blank" rel="noopener noreferrer" className="hover:text-white">
                  {s.label} · {s.handle}
                </a>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-xs text-white/50">Update these to your real social pages when ready.</p>
        </div>
      </div>

      <div className="border-t border-white/10">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-4 text-xs text-white/50 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p>© {new Date().getFullYear()} RWDNEWS. Global briefings · sources credited.</p>
          <div className="flex flex-wrap gap-4">
            <a href="/privacy" className="hover:text-white/80">
              Privacy
            </a>
            <a href="/terms" className="hover:text-white/80">
              Terms
            </a>
            <a href="/editorial" className="hover:text-white/80">
              Editorial
            </a>
            <a href="/about" className="hover:text-white/80">
              About
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
