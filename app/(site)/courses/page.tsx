import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/auth/session";
import { getEnrolledCourses, getPublishedCourses, TRACK_INFO } from "@/lib/data";
import { enrollInCourse } from "@/lib/actions/student";
import PageHero from "@/components/PageHero";
import SubmitButton from "@/components/SubmitButton";

export const metadata: Metadata = { title: "Courses" };

export default async function CoursesPage() {
  const user = await requireUser();
  const [all, enrolled] = await Promise.all([
    getPublishedCourses(),
    getEnrolledCourses(user.id),
  ]);
  const enrolledIds = new Set(enrolled.map((c) => c.id));
  const available = all.filter((c) => !enrolledIds.has(c.id));

  return (
    <>
      <PageHero
        eyebrow="Course Catalog"
        title="Courses"
        intro="Your enrolled courses, and everything open for enrollment."
      />

      <section className="bg-slate-50 px-4 py-12 sm:py-16">
        <div className="mx-auto max-w-6xl">
          <h2 className="text-2xl">Enrolled</h2>
          {enrolled.length === 0 ? (
            <p className="mt-4 text-slate-600">
              You&rsquo;re not enrolled in anything yet — pick a course below.
            </p>
          ) : (
            <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {enrolled.map((course) => (
                <Link
                  key={course.id}
                  href={`/courses/${course.slug}`}
                  className="hover-lift rounded-2xl bg-white p-6 shadow-sm"
                >
                  <p className="text-xs font-semibold uppercase tracking-wider text-brand-700">
                    {TRACK_INFO[course.track].title}
                  </p>
                  <h3 className="mt-1 text-lg font-bold text-slate-900">
                    {course.title}
                  </h3>
                  <span className="mt-3 inline-block text-sm font-semibold text-brand-700">
                    Continue →
                  </span>
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="bg-white px-4 py-12 sm:py-16">
        <div className="mx-auto max-w-6xl">
          <h2 className="text-2xl">Open for Enrollment</h2>
          {available.length === 0 ? (
            <p className="mt-4 text-slate-600">
              You&rsquo;re enrolled in every available course.
            </p>
          ) : (
            <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {available.map((course) => (
                <div
                  key={course.id}
                  className="flex flex-col rounded-2xl border border-slate-200 p-6"
                >
                  <p className="text-xs font-semibold uppercase tracking-wider text-brand-700">
                    {TRACK_INFO[course.track].title}
                  </p>
                  <h3 className="mt-1 text-lg font-bold text-slate-900">
                    {course.title}
                  </h3>
                  {course.description && (
                    <p className="mt-2 line-clamp-3 flex-1 text-sm text-slate-600">
                      {course.description}
                    </p>
                  )}
                  <form
                    action={enrollInCourse.bind(null, course.id)}
                    className="mt-4"
                  >
                    <SubmitButton>Enroll</SubmitButton>
                  </form>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </>
  );
}
