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
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-3 px-4 py-6 sm:flex-row sm:justify-between">
          <p className="text-xs text-slate-500">
            © {new Date().getFullYear()} {site.name}
          </p>
          <p className="flex gap-5 text-xs">
            <a href={site.social.facebook} className="text-slate-400 hover:text-white">
              Facebook
            </a>
            <a href={site.church.url} className="text-slate-400 hover:text-white">
              {site.church.name}
            </a>
          </p>
        </div>
      </div>
    </footer>
  );
}
