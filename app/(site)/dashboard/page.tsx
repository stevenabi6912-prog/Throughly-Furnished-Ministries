import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/auth/session";
import {
  getCompletedLessonIds,
  getCourseContent,
  getEnrolledCourses,
  getLatestSubmissions,
} from "@/lib/data";
import StatusBadge from "@/components/StatusBadge";
import PageHero from "@/components/PageHero";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const user = await requireUser();
  const enrolled = await getEnrolledCourses(user.id);
  const latestByAssignment = await getLatestSubmissions(user.id);

  // Per-course lesson progress + open assignments.
  const courseCards = await Promise.all(
    enrolled.map(async (course) => {
      const { lessons, assignments } = await getCourseContent(course.id);
      const done = await getCompletedLessonIds(
        user.id,
        lessons.map((l) => l.id)
      );
      const open = assignments.filter((a) => {
        const sub = latestByAssignment.get(a.id);
        return !sub || sub.status === "returned";
      });
      return { course, lessonCount: lessons.length, doneCount: done.size, open };
    })
  );

  const openAssignments = courseCards.flatMap(({ course, open }) =>
    open.map((assignment) => ({ course, assignment }))
  );
  const recentGrades = [...latestByAssignment.values()]
    .filter((s) => s.gradedAt !== null)
    .sort((a, b) => b.gradedAt!.getTime() - a.gradedAt!.getTime())
    .slice(0, 5);

  return (
    <>
      <PageHero
        eyebrow="Student Dashboard"
        title={`Welcome, ${user.name.split(" ")[0]}`}
        intro="Pick up where you left off."
      />

      <section className="bg-slate-50 px-4 py-12 sm:py-16">
        <div className="mx-auto grid max-w-6xl gap-10 lg:grid-cols-3">
          {/* Courses + progress */}
          <div className="lg:col-span-2">
            <h2 className="text-2xl">My Courses</h2>
            {courseCards.length === 0 ? (
              <div className="mt-6 rounded-2xl bg-white p-8 text-center shadow-sm">
                <p className="text-slate-600">
                  You aren&rsquo;t enrolled in any courses yet.
                </p>
                <Link
                  href="/courses"
                  className="mt-4 inline-block rounded-lg bg-brand-500 px-6 py-3 font-semibold text-white transition-colors hover:bg-brand-600"
                >
                  Browse Courses
                </Link>
              </div>
            ) : (
              <div className="mt-6 space-y-4">
                {courseCards.map(({ course, lessonCount, doneCount, open }) => {
                  const pct =
                    lessonCount === 0
                      ? 0
                      : Math.round((doneCount / lessonCount) * 100);
                  return (
                    <Link
                      key={course.id}
                      href={`/courses/${course.slug}`}
                      className="hover-lift block rounded-2xl bg-white p-6 shadow-sm"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <h3 className="text-lg font-bold text-slate-900">
                          {course.title}
                        </h3>
                        <span className="text-sm text-slate-500">
                          {doneCount}/{lessonCount} lessons
                          {open.length > 0 &&
                            ` · ${open.length} assignment${open.length === 1 ? "" : "s"} to do`}
                        </span>
                      </div>
                      <div
                        className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100"
                        role="progressbar"
                        aria-valuenow={pct}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-label={`${course.title} progress`}
                      >
                        <div
                          className="h-full rounded-full bg-brand-500 transition-all"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>

          {/* Sidebar: to-do + recent grades */}
          <div className="space-y-10">
            <div>
              <h2 className="text-2xl">To Do</h2>
              {openAssignments.length === 0 ? (
                <p className="mt-4 rounded-2xl bg-white p-5 text-sm text-slate-600 shadow-sm">
                  Nothing waiting on you — great work.
                </p>
              ) : (
                <ul className="mt-4 space-y-3">
                  {openAssignments.slice(0, 6).map(({ course, assignment }) => (
                    <li key={assignment.id}>
                      <Link
                        href={`/assignments/${assignment.id}`}
                        className="hover-lift block rounded-xl bg-white p-4 shadow-sm"
                      >
                        <p className="text-sm font-semibold text-slate-900">
                          {assignment.title}
                        </p>
                        <p className="mt-0.5 text-xs text-slate-500">
                          {course.title}
                          {assignment.dueAt &&
                            ` · due ${assignment.dueAt.toLocaleDateString()}`}
                        </p>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div>
              <h2 className="text-2xl">Recent Grades</h2>
              {recentGrades.length === 0 ? (
                <p className="mt-4 rounded-2xl bg-white p-5 text-sm text-slate-600 shadow-sm">
                  Grades will appear here once your work is reviewed.
                </p>
              ) : (
                <ul className="mt-4 space-y-3">
                  {recentGrades.map((sub) => (
                    <li
                      key={sub.id}
                      className="flex items-center justify-between gap-3 rounded-xl bg-white p-4 shadow-sm"
                    >
                      <Link
                        href={`/assignments/${sub.assignmentId}`}
                        className="text-sm font-semibold text-brand-700 hover:underline"
                      >
                        View feedback
                      </Link>
                      <span className="flex items-center gap-2">
                        {sub.score !== null && (
                          <span className="text-sm font-bold text-slate-900">
                            {sub.score}
                          </span>
                        )}
                        <StatusBadge status={sub.status} />
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              <Link
                href="/grades"
                className="mt-4 inline-block text-sm font-semibold text-brand-700 hover:underline"
              >
                See all grades →
              </Link>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
