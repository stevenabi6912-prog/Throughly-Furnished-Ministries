import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import {
  getCompletedLessonIds,
  getCourseBySlug,
  getCourseContent,
  getEnrollment,
  getLatestSubmissions,
  TRACK_INFO,
} from "@/lib/data";
import { enrollInCourse } from "@/lib/actions/student";
import PageHero from "@/components/PageHero";
import StatusBadge from "@/components/StatusBadge";
import SubmitButton from "@/components/SubmitButton";

export default async function CoursePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const user = await requireUser();
  const course = await getCourseBySlug(slug);
  if (!course || (!course.published && user.role !== "admin")) notFound();

  const [enrollment, { lessons, assignments }] = await Promise.all([
    getEnrollment(user.id, course.id),
    getCourseContent(course.id),
  ]);

  if (!enrollment && user.role !== "admin") {
    // Not enrolled yet — show the description and an enroll button.
    return (
      <>
        <PageHero
          eyebrow={TRACK_INFO[course.track].title}
          title={course.title}
          intro={course.description || undefined}
        />
        <section className="bg-white px-4 py-16 text-center">
          <p className="text-slate-600">
            {lessons.length} lesson{lessons.length === 1 ? "" : "s"} ·{" "}
            {assignments.length} assignment{assignments.length === 1 ? "" : "s"}
          </p>
          <form action={enrollInCourse.bind(null, course.id)} className="mt-6">
            <SubmitButton className="rounded-lg bg-brand-500 px-8 py-3.5 font-semibold text-white transition-colors hover:bg-brand-600 disabled:cursor-wait disabled:opacity-60">
              Enroll in This Course
            </SubmitButton>
          </form>
        </section>
      </>
    );
  }

  const [done, latest] = await Promise.all([
    getCompletedLessonIds(user.id, lessons.map((l) => l.id)),
    getLatestSubmissions(user.id, assignments.map((a) => a.id)),
  ]);
  const lessonAssignments = new Map<number, typeof assignments>();
  const courseWide: typeof assignments = [];
  for (const a of assignments) {
    if (a.lessonId && lessons.some((l) => l.id === a.lessonId)) {
      const list = lessonAssignments.get(a.lessonId) ?? [];
      list.push(a);
      lessonAssignments.set(a.lessonId, list);
    } else {
      courseWide.push(a);
    }
  }

  return (
    <>
      <PageHero
        eyebrow={TRACK_INFO[course.track].title}
        title={course.title}
        intro={course.description || undefined}
      />

      <section className="bg-slate-50 px-4 py-12 sm:py-16">
        <div className="mx-auto max-w-3xl">
          <h2 className="text-2xl">Lessons</h2>
          {lessons.length === 0 ? (
            <p className="mt-4 text-slate-600">No lessons yet.</p>
          ) : (
            <ol className="mt-6 space-y-3">
              {lessons.map((lesson, i) => (
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
                    {(lessonAssignments.get(lesson.id)?.length ?? 0) > 0 && (
                      <span className="text-xs text-slate-500">
                        {lessonAssignments.get(lesson.id)!.length} assignment
                        {lessonAssignments.get(lesson.id)!.length === 1 ? "" : "s"}
                      </span>
                    )}
                  </Link>
                </li>
              ))}
            </ol>
          )}

          <h2 className="mt-12 text-2xl">Assignments</h2>
          {assignments.length === 0 ? (
            <p className="mt-4 text-slate-600">No assignments yet.</p>
          ) : (
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
          )}
        </div>
      </section>
    </>
  );
}
