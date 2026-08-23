import Link from "next/link";
import site from "@/content/site.json";
import { footerLinks, programs } from "@/lib/nav";

export default function Footer() {
  return (
    <footer className="bg-slate-950 text-slate-300">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 sm:grid-cols-3">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-white">
            {site.name}
          </h2>
          <p className="mt-4 text-sm text-slate-400">
            A ministry of{" "}
            <a href={site.church.url} className="text-slate-300 underline-offset-2 hover:text-white hover:underline">
              {site.church.name}
            </a>{" "}
            in {site.church.city}, preparing believers for missionary work and
            Christian service.
          </p>
          <a
            href={site.church.url}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-5 inline-flex items-center gap-2 rounded-full border border-slate-700 bg-slate-900 px-4 py-2 text-sm font-semibold text-slate-200 transition-colors hover:border-brand-400 hover:text-white"
          >
            <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0 text-brand-400">
              <path d="M12 3l8 4.5v1.5H4V7.5L12 3z" />
              <path d="M5 9v11h14V9M9 20v-6h6v6" />
            </svg>
            Visit {site.church.name}
            <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0">
              <path d="M7 17L17 7M9 7h8v8" />
            </svg>
          </a>
          <p className="font-accent mt-4 text-sm italic text-slate-400">
            &ldquo;…that the man of God may be perfect, throughly furnished unto
            all good works.&rdquo;
            <span className="mt-1 block not-italic text-xs text-slate-500">
              {site.verseRef}
            </span>
          </p>
        </div>

        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-white">
            Programs
          </h2>
          <ul className="mt-4 space-y-2 text-sm">
            {programs.map((l) => (
              <li key={l.href}>
                <Link href={l.href} className="hover:text-white">
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-white">
            Quick Links
          </h2>
          <ul className="mt-4 space-y-2 text-sm">
            {footerLinks.map((l) => (
              <li key={l.href}>
                <Link href={l.href} className="hover:text-white">
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="border-t border-slate-800">
        <div className="mx-auto max-w-6xl px-4 py-6">
          <p className="text-center text-xs text-slate-500 sm:text-left">
            © {new Date().getFullYear()} {site.name}
          </p>
        </div>
      </div>
    </footer>
  );
}
