import type { Metadata } from "next";
import Link from "next/link";
import { asc } from "drizzle-orm";
import { courses, getDb } from "@/lib/db";
import { TRACK_INFO } from "@/lib/data";
import PageHero from "@/components/PageHero";
import CourseForm from "@/components/admin/CourseForm";

export const metadata: Metadata = { title: "Admin · Courses" };

export default async function AdminCoursesPage() {
  const db = await getDb();
  const all = await db.query.courses.findMany({
    orderBy: [asc(courses.track), asc(courses.sortOrder), asc(courses.title)],
  });

  return (
    <>
      <PageHero eyebrow="Admin" title="Courses" />
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
                <li key={course.id}>
                  <Link
                    href={`/admin/courses/${course.id}`}
                    className="hover-lift flex flex-wrap items-center justify-between gap-2 rounded-xl bg-white p-4 shadow-sm"
                  >
                    <span>
                      <span className="block font-semibold text-slate-900">
                        {course.title}
                      </span>
                      <span className="mt-0.5 block text-xs text-slate-500">
                        {TRACK_INFO[course.track].title}
                      </span>
                    </span>
                    <span className="flex items-center gap-3">
                      {!course.published && (
                        <span className="rounded-full bg-slate-200 px-2.5 py-0.5 text-xs font-semibold text-slate-600">
                          Draft
                        </span>
                      )}
                      <span className="text-sm font-semibold text-brand-700">
                        Edit →
                      </span>
                    </span>
                  </Link>
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
