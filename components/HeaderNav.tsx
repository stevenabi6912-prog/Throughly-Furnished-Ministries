"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { programs, studentLinks } from "@/lib/nav";
import { logout } from "@/lib/actions/auth";

type SessionUser = { name: string; role: "student" | "admin" } | null;

// Site-wide header, same bones as the church site's. Client component only
// because the mobile menu needs open/closed state.
export default function HeaderNav({ user }: { user: SessionUser }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();
  const close = () => setMobileOpen(false);

  const linkClass = (href: string) =>
    `rounded px-3 py-2 text-sm font-medium transition-colors ${
      pathname === href ? "text-white" : "text-slate-300 hover:text-white"
    }`;

  const navLinks = user
    ? [...studentLinks, ...(user.role === "admin" ? [{ label: "Admin", href: "/admin" }] : [])]
    : programs;

  return (
    <header className="sticky top-0 z-50 bg-slate-950/95 backdrop-blur supports-[backdrop-filter]:bg-slate-950/85">
      <nav
        aria-label="Main"
        className="mx-auto flex h-20 max-w-6xl items-center justify-between gap-2 px-4"
      >
        <Link
          href="/"
          onClick={close}
          aria-label="Throughly Furnished Ministries — home"
          className="flex shrink-0 items-center gap-3"
        >
          <span className="rounded bg-white/95 p-1">
            <Image
              src="/images/logo.png"
              alt=""
              width={170}
              height={100}
              priority
              className="h-9 w-auto sm:h-10"
            />
          </span>
          <span className="hidden font-display text-lg uppercase leading-none tracking-wide text-white min-[420px]:block sm:text-xl">
            Throughly Furnished
            <span className="block text-xs tracking-[0.2em] text-brand-400">
              Ministries
            </span>
          </span>
        </Link>

        {/* Desktop nav */}
        <div className="hidden items-center gap-1 lg:flex">
          {navLinks.map((l) => (
            <Link key={l.href} href={l.href} className={linkClass(l.href)}>
              {l.label}
            </Link>
          ))}
          {user ? (
            <>
              <Link
                href="/report-bug"
                title="Report a bug"
                aria-label="Report a bug"
                className="ml-1 rounded-lg px-2.5 py-2 text-lg text-slate-300 transition-colors hover:bg-slate-900 hover:text-white"
              >
                🐞
              </Link>
              <form action={logout} className="ml-1">
                <button
                  type="submit"
                  className="rounded-lg border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-200 transition-colors hover:border-slate-500 hover:text-white"
                >
                  Log Out
                </button>
              </form>
            </>
          ) : (
            <>
              <Link href="/login" className={linkClass("/login")}>
                Log In
              </Link>
              <Link
                href="/register"
                className="ml-2 rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-600"
              >
                Register
              </Link>
            </>
          )}
        </div>

        {/* Mobile: primary button + hamburger */}
        <div className="flex items-center gap-2 lg:hidden">
          <Link
            href={user ? "/dashboard" : "/register"}
            onClick={close}
            className="rounded-lg bg-brand-500 px-3 py-2 text-sm font-semibold text-white"
          >
            {user ? "Dashboard" : "Register"}
          </Link>
          <button
            type="button"
            aria-expanded={mobileOpen}
            aria-controls="mobile-menu"
            aria-label={mobileOpen ? "Close menu" : "Open menu"}
            onClick={() => setMobileOpen((o) => !o)}
            className="rounded p-2 text-slate-200"
          >
            <svg aria-hidden="true" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              {mobileOpen ? (
                <path d="M6 6l12 12M18 6L6 18" />
              ) : (
                <path d="M4 7h16M4 12h16M4 17h16" />
              )}
            </svg>
          </button>
        </div>
      </nav>

      {/* Mobile menu */}
      {mobileOpen && (
        <div id="mobile-menu" className="border-t border-slate-800 bg-slate-950 px-4 pb-6 pt-2 lg:hidden">
          <div className="mt-2 space-y-1">
            {navLinks.map((l) => (
              <Link key={l.href} href={l.href} onClick={close} className="block rounded px-2 py-2 text-base text-slate-200 hover:bg-slate-900">
                {l.label}
              </Link>
            ))}
          </div>
          <p className="mt-4 px-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
            Programs
          </p>
          <div className="mt-1 space-y-1">
            {programs.map((l) => (
              <Link key={l.href} href={l.href} onClick={close} className="block rounded px-2 py-2 text-base text-slate-200 hover:bg-slate-900">
                {l.label}
              </Link>
            ))}
          </div>
          <div className="mt-4 border-t border-slate-800 pt-4">
            {user ? (
              <>
                <Link
                  href="/report-bug"
                  onClick={close}
                  className="block rounded px-2 py-2 text-base text-slate-300 hover:bg-slate-900"
                >
                  🐞 Report a Bug
                </Link>
                <form action={logout}>
                  <button
                    type="submit"
                    className="mt-1 block w-full rounded px-2 py-2 text-left text-base text-slate-300 hover:bg-slate-900"
                  >
                    Log Out ({user.name})
                  </button>
                </form>
              </>
            ) : (
              <Link href="/login" onClick={close} className="block rounded px-2 py-2 text-base text-slate-300 hover:bg-slate-900">
                Log In
              </Link>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
