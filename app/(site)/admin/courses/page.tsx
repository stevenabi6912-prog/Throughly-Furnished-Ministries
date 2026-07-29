import type { Metadata } from "next";
import Link from "next/link";
import { asc } from "drizzle-orm";
import { courses, getDb } from "@/lib/db";
import { TRACK_INFO } from "@/lib/data";
import { setCurrentCourse } from "@/lib/actions/admin";
import PageHero from "@/components/PageHero";
import CourseForm from "@/components/admin/CourseForm";

export const metadata: Metadata = { title: "Admin · Courses" };

export default async function AdminCoursesPage() {
  const db = await getDb();
  const all = await db.query.courses.findMany({
    orderBy: [asc(courses.track), asc(courses.sortOrder), asc(courses.title)],
  });
  const current = all.find((c) => c.current);

  return (
    <>
      <PageHero
        eyebrow="Admin"
        title="Courses"
        intro={
          current
            ? `Course in session: ${current.title}. Every active student sees it on their dashboard.`
            : "No course is in session — pick one below and press “Make Current.”"
        }
      />
      <section className="bg-slate-50 px-4 py-12">
        <div className="mx-auto max-w-4xl">
          {all.length === 0 ? (
            <p className="text-slate-600">
              No courses yet — create the first one below, or run the
              LearnDash import.
            </p>
          ) : (
            <ul className="space-y-3">
              {all.map((course) => (
                <li
                  key={course.id}
                  className={`flex flex-wrap items-center justify-between gap-3 rounded-xl bg-white p-4 shadow-sm ${
                    course.current ? "ring-2 ring-brand-500" : ""
                  }`}
                >
                  <span>
                    <span className="block font-semibold text-slate-900">
                      {course.title}
                      {course.current && (
                        <span className="ml-2 rounded-full bg-brand-500 px-2.5 py-0.5 text-xs font-semibold text-white">
                          In session
                        </span>
                      )}
                      {!course.published && (
                        <span className="ml-2 rounded-full bg-slate-200 px-2.5 py-0.5 text-xs font-semibold text-slate-600">
                          Draft
                        </span>
                      )}
                    </span>
                    <span className="mt-0.5 block text-xs text-slate-500">
                      {TRACK_INFO[course.track].title}
                    </span>
                  </span>
                  <span className="flex items-center gap-3">
                    {course.current ? (
                      <form action={setCurrentCourse}>
                        <button
                          type="submit"
                          className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                        >
                          End Session
                        </button>
                      </form>
                    ) : (
                      <form action={setCurrentCourse}>
                        <input type="hidden" name="courseId" value={course.id} />
                        <button
                          type="submit"
                          className="rounded-lg border border-brand-500 px-3 py-1.5 text-xs font-semibold text-brand-700 hover:bg-brand-500/5"
                        >
                          Make Current
                        </button>
                      </form>
                    )}
                    <Link
                      href={`/admin/courses/${course.id}`}
                      className="text-sm font-semibold text-brand-700 hover:underline"
                    >
                      Edit →
                    </Link>
                  </span>
                </li>
              ))}
            </ul>
          )}

          <div className="mt-12 rounded-2xl bg-white p-6 shadow-sm">
            <h2 className="text-xl font-bold text-slate-900">New Course</h2>
            <div className="mt-4">
              <CourseForm />
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
