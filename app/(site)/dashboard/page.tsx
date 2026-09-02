import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/auth/session";
import {
  getCompletedLessonIds,
  getCourseContent,
  getCurrentCourse,
  getLatestSubmissions,
  TRACK_INFO,
} from "@/lib/data";
import StatusBadge from "@/components/StatusBadge";
import PageHero from "@/components/PageHero";
import { formatEastern } from "@/lib/time";

export const metadata: Metadata = { title: "Dashboard" };

// TFM runs one course at a time and every active student is automatically
// in it — so the dashboard IS the current course, plus recent grades.
export default async function DashboardPage() {
  const user = await requireUser();
  const course = await getCurrentCourse();
  const latestByAssignment = await getLatestSubmissions(user.id);

  const content = course ? await getCourseContent(course.id) : null;
  const done = content
    ? await getCompletedLessonIds(user.id, content.lessons.map((l) => l.id))
    : new Set<number>();
  const now = new Date();
  // Lessons that haven't opened yet stay locked — and their homework
  // stays out of the to-do list until they do.
  const lockedLessonIds = new Set(
    content?.lessons
      .filter((l) => l.availableAt && l.availableAt > now)
      .map((l) => l.id) ?? []
  );
  // content.lessons only holds published lessons, so a lessonId that
  // isn't in it belongs to a hidden/draft lesson (leftover from the
  // LearnDash import in a few courses) — its homework shouldn't show
  // as a to-do either.
  const visibleLessonIds = new Set(content?.lessons.map((l) => l.id) ?? []);
  const openAssignments =
    content?.assignments.filter((a) => {
      if (a.lessonId && !visibleLessonIds.has(a.lessonId)) return false;
      if (a.lessonId && lockedLessonIds.has(a.lessonId)) return false;
      if (a.availableAt && a.availableAt > now) return false;
      const sub = latestByAssignment.get(a.id);
      return !sub || sub.status === "returned";
    }) ?? [];
  const pastDue = openAssignments.filter((a) => a.dueAt && a.dueAt < now);
  const upcoming = openAssignments.filter((a) => !a.dueAt || a.dueAt >= now);
  // Progress counts lessons that have homework (completion = turned in);
  // info-only lessons like the syllabus overview don't count against it.
  const completableLessons =
    content?.lessons.filter((l) =>
      content.assignments.some((a) => a.lessonId === l.id)
    ) ?? [];
  const doneCompletable = completableLessons.filter((l) => done.has(l.id));
  const pct =
    completableLessons.length > 0
      ? Math.round((doneCompletable.length / completableLessons.length) * 100)
      : 0;

  const recentGrades = [...latestByAssignment.values()]
    .filter((s) => s.gradedAt !== null)
    .sort((a, b) => b.gradedAt!.getTime() - a.gradedAt!.getTime())
    .slice(0, 5);

  return (
    <>
      <PageHero
        eyebrow="Student Dashboard"
        title={`Welcome, ${user.name.split(" ")[0]}`}
        intro={
          course
            ? `The course in session: ${course.title}`
            : "No course is in session right now."
        }
      />

      <section className="bg-slate-50 px-4 py-12 sm:py-16">
        <div className="mx-auto max-w-6xl">
          {/* What needs turning in — first thing on the page */}
          {openAssignments.length > 0 && (
            <div className="mb-10 overflow-hidden rounded-2xl bg-white shadow-sm">
              <div
                className={`px-6 py-4 ${pastDue.length > 0 ? "bg-red-600" : "bg-brand-500"} text-white`}
              >
                <h2 className="text-xl">
                  {pastDue.length > 0
                    ? `You're behind on ${pastDue.length} assignment${pastDue.length === 1 ? "" : "s"}`
                    : `Homework to turn in (${openAssignments.length})`}
                </h2>
              </div>
              <ul className="divide-y divide-slate-100">
                {[...pastDue, ...upcoming].map((assignment) => {
                  const isLate = Boolean(assignment.dueAt && assignment.dueAt < now);
                  const returned =
                    latestByAssignment.get(assignment.id)?.status === "returned";
                  return (
                    <li key={assignment.id}>
                      <Link
                        href={`/assignments/${assignment.id}`}
                        className="flex flex-wrap items-center justify-between gap-2 px-6 py-3.5 hover:bg-slate-50"
                      >
                        <span className="font-semibold text-slate-900">
                          {assignment.title}
                          {returned && (
                            <span className="ml-2 rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700">
                              Returned — fix &amp; resubmit
                            </span>
                          )}
                        </span>
                        <span
                          className={`text-sm font-semibold ${
                            isLate ? "text-red-600" : "text-slate-500"
                          }`}
                        >
                          {assignment.dueAt
                            ? `${isLate ? "Past due — " : "Due "}${formatEastern(assignment.dueAt)}${isLate ? " (10% off per week late)" : ""}`
                            : "Turn in →"}
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          <div className="grid gap-10 lg:grid-cols-3">
          {/* The current course */}
          <div className="lg:col-span-2">
            {!course || !content ? (
              <div className="rounded-2xl bg-white p-8 text-center shadow-sm">
                <p className="text-slate-600">
                  There&rsquo;s no course in session at the moment — check
                  back soon, or look over your{" "}
                  <Link href="/grades" className="font-semibold text-brand-700 hover:underline">
                    past grades
                  </Link>
                  .
                </p>
              </div>
            ) : (
              <div className="overflow-hidden rounded-2xl bg-white shadow-sm">
                <div className="bg-slate-900 px-6 py-5 text-white">
                  <p className="text-xs font-semibold uppercase tracking-wider text-brand-400">
                    {TRACK_INFO[course.track].title} · Current Course
                  </p>
                  <h2 className="mt-1 text-2xl">{course.title}</h2>
                  {course.description && (
                    <p className="mt-2 text-sm text-slate-300">
                      {course.description}
                    </p>
                  )}
                  <div
                    className="mt-4 h-2 overflow-hidden rounded-full bg-white/15"
                    role="progressbar"
                    aria-valuenow={pct}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label="Lesson progress"
                  >
                    <div
                      className="h-full rounded-full bg-brand-400 transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <p className="mt-1.5 text-xs text-slate-400">
                    {doneCompletable.length} of {completableLessons.length}{" "}
                    lessons complete (a lesson counts as complete when its
                    homework is turned in)
                  </p>
                </div>

                <div className="p-6">
                  <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-500">
                    Lessons
                  </h3>
                  {content.lessons.length === 0 ? (
                    <p className="mt-3 text-sm text-slate-600">
                      Lessons are being prepared.
                    </p>
                  ) : (
                    <ol className="mt-3 space-y-2">
                      {content.lessons.map((lesson, i) =>
                        lockedLessonIds.has(lesson.id) ? (
                          <li
                            key={lesson.id}
                            className="flex items-center gap-3 rounded-lg px-2 py-2 opacity-60"
                          >
                            <span
                              aria-hidden="true"
                              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs"
                            >
                              🔒
                            </span>
                            <span className="font-medium text-slate-600">
                              {lesson.title}
                            </span>
                            <span className="ml-auto text-xs text-slate-500">
                              Opens {formatEastern(lesson.availableAt!)}
                            </span>
                          </li>
                        ) : (
                          <li key={lesson.id}>
                            <Link
                              href={`/courses/${course.slug}/${lesson.slug}`}
                              className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-slate-50"
                            >
                              <span
                                aria-hidden="true"
                                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                                  done.has(lesson.id)
                                    ? "bg-green-100 text-green-700"
                                    : "bg-slate-100 text-slate-500"
                                }`}
                              >
                                {done.has(lesson.id) ? "✓" : i + 1}
                              </span>
                              <span className="font-medium text-slate-900">
                                {lesson.title}
                              </span>
                            </Link>
                          </li>
                        )
                      )}
                    </ol>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Sidebar: recent grades */}
          <div className="space-y-10">
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
                All my grades →
              </Link>
            </div>
          </div>
          </div>
        </div>
      </section>
    </>
  );
}
