import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import {
  getCompletedLessonIds,
  getCourseBySlug,
  getCourseContent,
  getEnrollment,
} from "@/lib/data";
import { toggleLessonComplete } from "@/lib/actions/student";
import SubmitButton from "@/components/SubmitButton";

export default async function LessonPage({
  params,
}: {
  params: Promise<{ slug: string; lessonSlug: string }>;
}) {
  const { slug, lessonSlug } = await params;
  const user = await requireUser();
  const course = await getCourseBySlug(slug);
  if (!course) notFound();

  const enrollment = await getEnrollment(user.id, course.id);
  if (!enrollment && user.role !== "admin") notFound();

  const { lessons, assignments } = await getCourseContent(course.id);
  const index = lessons.findIndex((l) => l.slug === lessonSlug);
  if (index === -1) notFound();
  const lesson = lessons[index];
  const prev = index > 0 ? lessons[index - 1] : null;
  const next = index < lessons.length - 1 ? lessons[index + 1] : null;
  const done = await getCompletedLessonIds(user.id, [lesson.id]);
  const isDone = done.has(lesson.id);
  const lessonAssignments = assignments.filter(
    (a) => a.lessonId === lesson.id
  );

  return (
    <>
      <section className="bg-slate-900 px-4 py-10 text-white">
        <div className="mx-auto max-w-3xl">
          <Link
            href={`/courses/${course.slug}`}
            className="text-sm font-semibold text-brand-400 hover:text-brand-500"
          >
            ← {course.title}
          </Link>
          <h1 className="mt-3 text-3xl sm:text-4xl">{lesson.title}</h1>
          <p className="mt-2 text-sm text-slate-400">
            Lesson {index + 1} of {lessons.length}
          </p>
        </div>
      </section>

      <section className="bg-white px-4 py-12">
        <div className="mx-auto max-w-3xl">
          {lesson.contentHtml ? (
            <div
              className="lesson-body"
              dangerouslySetInnerHTML={{ __html: lesson.contentHtml }}
            />
          ) : (
            <p className="text-slate-500">This lesson has no content yet.</p>
          )}

          {lessonAssignments.length > 0 && (
            <div className="mt-10 rounded-2xl bg-slate-50 p-6">
              <h2 className="text-lg font-bold text-slate-900">
                Assignment{lessonAssignments.length === 1 ? "" : "s"} for this
                lesson
              </h2>
              <ul className="mt-3 space-y-2">
                {lessonAssignments.map((a) => (
                  <li key={a.id}>
                    <Link
                      href={`/assignments/${a.id}`}
                      className="font-semibold text-brand-700 hover:underline"
                    >
                      {a.title} →
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="mt-10 flex flex-wrap items-center justify-between gap-4 border-t border-slate-200 pt-8">
            <form action={toggleLessonComplete.bind(null, lesson.id)}>
              <SubmitButton
                className={
                  isDone
                    ? "rounded-lg border border-green-600 px-5 py-2.5 text-sm font-semibold text-green-700 transition-colors hover:bg-green-50 disabled:opacity-60"
                    : "rounded-lg bg-brand-500 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-600 disabled:cursor-wait disabled:opacity-60"
                }
              >
                {isDone ? "✓ Completed — mark incomplete" : "Mark Lesson Complete"}
              </SubmitButton>
            </form>
            <div className="flex gap-3">
              {prev && (
                <Link
                  href={`/courses/${course.slug}/${prev.slug}`}
                  className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  ← Previous
                </Link>
              )}
              {next && (
                <Link
                  href={`/courses/${course.slug}/${next.slug}`}
                  className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Next →
                </Link>
              )}
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
