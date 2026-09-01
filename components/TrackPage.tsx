import Image from "next/image";
import Link from "next/link";
import { getPublishedCourses, TRACK_INFO } from "@/lib/data";
import { getCurrentUser } from "@/lib/auth/session";

// Shared template for the three program-track pages.
export default async function TrackPage({
  track,
  heroImage,
  children,
  areasOfService,
}: {
  track: keyof typeof TRACK_INFO;
  heroImage: string;
  children: React.ReactNode; // the track's descriptive copy
  // Ministry Participation isn't a curriculum students pick courses
  // from — it's ongoing service tracked term by term. When set, this
  // replaces the "Courses in This Program" grid (which would otherwise
  // list every historical term as if it were a course) with a simple
  // list of the actual areas students serve in.
  areasOfService?: string[];
}) {
  const info = TRACK_INFO[track];
  const [coursesInTrack, user] = await Promise.all([
    areasOfService ? Promise.resolve([]) : getPublishedCourses(track),
    getCurrentUser(),
  ]);

  return (
    <>
      <section className="relative overflow-hidden bg-slate-950 px-4 py-24 text-center text-white sm:py-32">
        <div className="absolute inset-0" aria-hidden="true">
          <Image
            src={heroImage}
            alt=""
            fill
            priority
            className="object-cover opacity-35"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-slate-950/60 to-slate-950/90" />
        </div>
        <div className="relative mx-auto max-w-3xl">
          <p className="animate-rise animate-rise-1 text-sm font-semibold uppercase tracking-[0.25em] text-brand-400">
            TFM Program
          </p>
          <h1 className="animate-rise animate-rise-2 mt-3 text-5xl sm:text-6xl">
            {info.title}
          </h1>
          <p className="animate-rise animate-rise-3 mx-auto mt-5 max-w-2xl text-lg text-slate-200">
            {info.blurb}
          </p>
        </div>
      </section>

      <section className="bg-white px-4 py-16 sm:py-20">
        <div className="prose prose-slate mx-auto max-w-3xl prose-a:text-brand-700">
          {children}
        </div>
      </section>

      <section className="bg-slate-50 px-4 py-16 sm:py-20">
        <div className="mx-auto max-w-5xl">
          <h2 className="text-center text-4xl">
            {areasOfService ? "Areas of Service" : "Courses in This Program"}
          </h2>
          {areasOfService ? (
            <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {areasOfService.map((area) => (
                <div
                  key={area}
                  className="rounded-2xl bg-white p-6 text-center shadow-sm"
                >
                  <p className="font-semibold text-slate-900">{area}</p>
                </div>
              ))}
            </div>
          ) : coursesInTrack.length === 0 ? (
            <p className="mt-8 text-center text-slate-600">
              Courses for this program are being prepared — check back soon.
            </p>
          ) : (
            // The curriculum, shown as information — students work in one
            // course at a time from their dashboard.
            <div className="mt-10 grid gap-6 sm:grid-cols-2">
              {coursesInTrack.map((course) => (
                <div key={course.id} className="rounded-2xl bg-white p-7 shadow-sm">
                  <h3 className="text-lg font-bold text-slate-900">
                    {course.title}
                    {course.current && (
                      <span className="ml-2 rounded-full bg-brand-500/10 px-2.5 py-0.5 text-xs font-semibold text-brand-700">
                        In session now
                      </span>
                    )}
                  </h3>
                </div>
              ))}
            </div>
          )}
          {!user && (
            <p className="mt-10 text-center">
              <Link
                href="/register"
                className="hover-lift inline-block rounded-lg bg-brand-500 px-7 py-3.5 font-semibold text-white shadow transition-colors hover:bg-brand-600"
              >
                Register as a Student
              </Link>
            </p>
          )}
        </div>
      </section>
    </>
  );
}
