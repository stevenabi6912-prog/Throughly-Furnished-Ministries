import Image from "next/image";
import Link from "next/link";
import site from "@/content/site.json";
import { TRACK_INFO } from "@/lib/data";
import { getCurrentUser } from "@/lib/auth/session";

export default async function HomePage() {
  const user = await getCurrentUser();

  return (
    <>
      {/* Hero */}
      <section className="relative flex min-h-[82vh] items-center justify-center overflow-hidden bg-slate-950 px-4 py-24 text-center text-white">
        <div className="absolute inset-0" aria-hidden="true">
          <Image
            src="/images/hero-globe.jpg"
            alt=""
            fill
            priority
            data-parallax="0.18"
            className="object-cover opacity-40"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-slate-950/70 via-slate-950/40 to-slate-950" />
        </div>
        <div className="relative mx-auto max-w-4xl">
          <p className="animate-rise animate-rise-1 text-sm font-semibold uppercase tracking-[0.25em] text-brand-400">
            A Ministry of {site.church.name} · {site.church.city}
          </p>
          <h1 className="animate-rise animate-rise-2 mt-4 text-5xl sm:text-7xl md:text-8xl">
            Throughly Furnished
          </h1>
          <p className="animate-rise animate-rise-3 mx-auto mt-6 max-w-2xl text-lg text-slate-200 sm:text-xl">
            Preparing believers for missionary work and Christian service —
            grounded in Scripture, equipped with practical skills, and proven
            in the local church.
          </p>
          <div className="animate-rise animate-rise-4 mt-9 flex flex-wrap items-center justify-center gap-4">
            {user ? (
              <Link
                href="/dashboard"
                className="hover-lift rounded-lg bg-brand-500 px-7 py-3.5 text-base font-semibold text-white shadow-lg transition-colors hover:bg-brand-600"
              >
                Go to Your Dashboard
              </Link>
            ) : (
              <>
                <Link
                  href="/register"
                  className="hover-lift rounded-lg bg-brand-500 px-7 py-3.5 text-base font-semibold text-white shadow-lg transition-colors hover:bg-brand-600"
                >
                  Start Training
                </Link>
                <Link
                  href="/biblical-studies"
                  className="hover-lift rounded-lg border border-white/40 px-7 py-3.5 text-base font-semibold text-white transition-colors hover:bg-white/10"
                >
                  Explore the Programs
                </Link>
              </>
            )}
          </div>
        </div>
      </section>

      {/* The namesake verse */}
      <section className="bg-white px-4 py-20 sm:py-24">
        <div className="mx-auto max-w-3xl text-center">
          <p className="font-accent text-2xl italic leading-relaxed text-slate-700 sm:text-3xl">
            &ldquo;{site.verse}&rdquo;
          </p>
          <p className="mt-6 text-sm font-semibold uppercase tracking-[0.2em] text-brand-700">
            {site.verseRef}
          </p>
        </div>
      </section>

      {/* The three tracks */}
      <section className="bg-slate-50 px-4 py-20 sm:py-24">
        <div className="mx-auto max-w-6xl">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-4xl sm:text-5xl">Three-Part Preparation</h2>
            <p className="mt-4 text-lg text-slate-600">
              Head, hands, and heart — every TFM student trains in all three.
            </p>
          </div>
          <div className="mt-12 grid gap-8 md:grid-cols-3">
            {Object.entries(TRACK_INFO).map(([key, track]) => (
              <Link
                key={key}
                href={track.href}
                className="hover-lift group rounded-2xl bg-white p-8 text-center shadow-sm"
              >
                <Image
                  src={track.image}
                  alt=""
                  width={270}
                  height={250}
                  className="mx-auto h-32 w-auto"
                />
                <h3 className="mt-6 text-xl font-bold text-slate-900 group-hover:text-brand-700">
                  {track.title}
                </h3>
                <p className="mt-3 text-sm leading-relaxed text-slate-600">
                  {track.blurb}
                </p>
                <span className="mt-5 inline-block text-sm font-semibold text-brand-700">
                  Learn more →
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="bg-white px-4 py-20 sm:py-24">
        <div className="mx-auto max-w-6xl">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-4xl sm:text-5xl">How Training Works</h2>
          </div>
          <ol className="mt-12 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {[
              {
                step: "1",
                title: "Enroll",
                body: "Create an account and enroll in the courses for your track.",
              },
              {
                step: "2",
                title: "Study",
                body: "Work through the lessons at your own pace, marking each one complete.",
              },
              {
                step: "3",
                title: "Submit",
                body: "Turn in assignments right on the site — written work or file uploads.",
              },
              {
                step: "4",
                title: "Grow",
                body: "Teachers grade every assignment and give personal feedback.",
              },
            ].map((item) => (
              <li key={item.step} className="rounded-2xl border border-slate-200 p-7">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-500 font-display text-lg text-white">
                  {item.step}
                </span>
                <h3 className="mt-4 text-lg font-bold text-slate-900">{item.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">{item.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* CTA */}
      <section className="relative overflow-hidden bg-slate-950 px-4 py-20 text-center text-white sm:py-24">
        <div className="absolute inset-0" aria-hidden="true">
          <Image
            src="/images/continents.jpg"
            alt=""
            fill
            className="object-cover opacity-25"
          />
          <div className="absolute inset-0 bg-slate-950/60" />
        </div>
        <div className="relative mx-auto max-w-2xl">
          <h2 className="text-4xl sm:text-5xl">The Youth Today Is Tomorrow&rsquo;s Future</h2>
          <p className="mt-5 text-lg text-slate-300">
            Whether God is calling you to the mission field or to serve at
            home, start preparing now.
          </p>
          <Link
            href={user ? "/courses" : "/register"}
            className="hover-lift mt-8 inline-block rounded-lg bg-brand-500 px-8 py-4 text-base font-semibold text-white shadow-lg transition-colors hover:bg-brand-600"
          >
            {user ? "Browse Courses" : "Register Today"}
          </Link>
        </div>
      </section>
    </>
  );
}
