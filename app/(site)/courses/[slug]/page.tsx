import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import {
  canViewCourse,
  getCompletedLessonIds,
  getCourseBySlug,
  getCourseContent,
  getLatestSubmissions,
  TRACK_INFO,
} from "@/lib/data";
import PageHero from "@/components/PageHero";
import StatusBadge from "@/components/StatusBadge";
import { formatEastern } from "@/lib/time";

// A course a student is part of (the one in session, or a past one).
export default async function CoursePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const user = await requireUser();
  const course = await getCourseBySlug(slug);
  if (!course || !(await canViewCourse(user, course))) notFound();

  const { lessons, assignments } = await getCourseContent(course.id, {
    includeDrafts: user.role === "admin",
  });
  const [done, latest] = await Promise.all([
    getCompletedLessonIds(user.id, lessons.map((l) => l.id)),
    getLatestSubmissions(user.id, assignments.map((a) => a.id)),
  ]);
  const assignmentCountByLesson = new Map<number, number>();
  for (const a of assignments) {
    if (a.lessonId)
      assignmentCountByLesson.set(
        a.lessonId,
        (assignmentCountByLesson.get(a.lessonId) ?? 0) + 1
      );
  }

  return (
    <>
      <PageHero
        eyebrow={`${TRACK_INFO[course.track].title}${course.current ? " · Current Course" : ""}`}
        title={course.title}
        intro={course.description || undefined}
      />

      <section className="bg-slate-50 px-4 py-12 sm:py-16">
        <div className="mx-auto max-w-3xl">
          <h2 className="text-2xl">Lessons</h2>
          {lessons.length === 0 ? (
            <p className="mt-4 text-slate-600">Lessons are being prepared.</p>
          ) : (
            <ol className="mt-6 space-y-3">
              {lessons.map((lesson, i) => {
                const locked =
                  user.role !== "admin" &&
                  lesson.availableAt &&
                  lesson.availableAt > new Date();
                if (locked) {
                  return (
                    <li
                      key={lesson.id}
                      className="flex items-center gap-4 rounded-xl bg-white/60 p-4 shadow-sm"
                    >
                      <span
                        aria-hidden="true"
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-sm"
                      >
                        🔒
                      </span>
                      <span className="flex-1 font-semibold text-slate-500">
                        {lesson.title}
                      </span>
                      <span className="text-xs text-slate-500">
                        Opens {formatEastern(lesson.availableAt!)}
                      </span>
                    </li>
                  );
                }
                return (
                  <li key={lesson.id}>
                    <Link
                      href={`/courses/${course.slug}/${lesson.slug}`}
                      className="hover-lift flex items-center gap-4 rounded-xl bg-white p-4 shadow-sm"
                    >
                      <span
                        aria-hidden="true"
                        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                          done.has(lesson.id)
                            ? "bg-green-100 text-green-700"
                            : "bg-slate-100 text-slate-500"
                        }`}
                      >
                        {done.has(lesson.id) ? "✓" : i + 1}
                      </span>
                      <span className="flex-1 font-semibold text-slate-900">
                        {lesson.title}
                      </span>
                      {(assignmentCountByLesson.get(lesson.id) ?? 0) > 0 && (
                        <span className="text-xs text-slate-500">homework</span>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ol>
          )}

          {assignments.length > 0 && (
            <>
              <h2 className="mt-12 text-2xl">Assignments &amp; Grades</h2>
              <ul className="mt-6 space-y-3">
                {assignments.map((assignment) => {
                  const sub = latest.get(assignment.id);
                  return (
                    <li key={assignment.id}>
                      <Link
                        href={`/assignments/${assignment.id}`}
                        className="hover-lift flex flex-wrap items-center justify-between gap-3 rounded-xl bg-white p-4 shadow-sm"
                      >
                        <span>
                          <span className="block font-semibold text-slate-900">
                            {assignment.title}
                          </span>
                          <span className="mt-0.5 block text-xs text-slate-500">
                            {assignment.points} points
                            {assignment.dueAt &&
                              ` · due ${assignment.dueAt.toLocaleDateString()}`}
                          </span>
                        </span>
                        <span className="flex items-center gap-2">
                          {sub?.status === "approved" && sub.score !== null && (
                            <span className="text-sm font-bold text-slate-900">
                              {sub.score}/{assignment.points}
                            </span>
                          )}
                          <StatusBadge status={sub?.status ?? "notsubmitted"} />
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </div>
      </section>
    </>
  );
}
