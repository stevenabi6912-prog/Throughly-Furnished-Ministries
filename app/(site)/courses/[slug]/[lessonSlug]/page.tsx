import Link from "next/link";
import { notFound } from "next/navigation";
import { and, desc, eq } from "drizzle-orm";
import { requireUser } from "@/lib/auth/session";
import { getDb, submissions } from "@/lib/db";
import {
  canViewCourse,
  getCompletedLessonIds,
  getCourseBySlug,
  getCourseContent,
} from "@/lib/data";
import { toggleLessonComplete } from "@/lib/actions/student";
import { youTubeEmbedUrl } from "@/lib/youtube";
import SubmitButton from "@/components/SubmitButton";
import StatusBadge from "@/components/StatusBadge";
import SubmissionForm from "@/app/(site)/assignments/[id]/SubmissionForm";

// The standard TFM lesson page: title → teaching video → fillable
// worksheet → homework turn-in, plus any extra written content.
export default async function LessonPage({
  params,
}: {
  params: Promise<{ slug: string; lessonSlug: string }>;
}) {
  const { slug, lessonSlug } = await params;
  const user = await requireUser();
  const course = await getCourseBySlug(slug);
  if (!course || !(await canViewCourse(user, course))) notFound();

  const { lessons, assignments } = await getCourseContent(course.id, {
    includeDrafts: user.role === "admin",
  });
  const index = lessons.findIndex((l) => l.slug === lessonSlug);
  if (index === -1) notFound();
  const lesson = lessons[index];
  const prev = index > 0 ? lessons[index - 1] : null;
  const next = index < lessons.length - 1 ? lessons[index + 1] : null;
  const done = await getCompletedLessonIds(user.id, [lesson.id]);
  const isDone = done.has(lesson.id);
  const lessonAssignments = assignments.filter((a) => a.lessonId === lesson.id);
  const embedUrl = lesson.videoUrl ? youTubeEmbedUrl(lesson.videoUrl) : null;

  const db = await getDb();
  const mySubmissionsByAssignment = new Map<
    number,
    (typeof submissions.$inferSelect)[]
  >();
  for (const a of lessonAssignments) {
    mySubmissionsByAssignment.set(
      a.id,
      await db.query.submissions.findMany({
        where: and(
          eq(submissions.assignmentId, a.id),
          eq(submissions.userId, user.id)
        ),
        orderBy: [desc(submissions.submittedAt)],
      })
    );
  }

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
          {/* 1. The teaching video */}
          {embedUrl && (
            <div className="overflow-hidden rounded-2xl bg-slate-950 shadow-sm">
              <iframe
                src={embedUrl}
                title={`Video: ${lesson.title}`}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                className="aspect-video w-full"
              />
            </div>
          )}

          {/* 2. The worksheet */}
          {lesson.worksheetUrl && (
            <div className="mt-8">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-xl font-bold text-slate-900">Worksheet</h2>
                <a
                  href={lesson.worksheetUrl}
                  target="_blank"
                  className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  ⬇ Open / Download PDF
                </a>
              </div>
              <p className="mt-1 text-sm text-slate-500">
                Fill it in as you watch, save it, then turn it in below.
              </p>
              <object
                data={lesson.worksheetUrl}
                type="application/pdf"
                className="mt-4 h-[36rem] w-full rounded-xl border border-slate-200"
              >
                <p className="p-6 text-sm text-slate-600">
                  Your browser can&rsquo;t preview PDFs —{" "}
                  <a href={lesson.worksheetUrl} className="font-semibold text-brand-700 hover:underline">
                    download the worksheet
                  </a>{" "}
                  instead.
                </p>
              </object>
            </div>
          )}

          {/* 3. Extra content */}
          {lesson.contentHtml && (
            <div
              className="lesson-body mt-8"
              dangerouslySetInnerHTML={{ __html: lesson.contentHtml }}
            />
          )}
          {!embedUrl && !lesson.worksheetUrl && !lesson.contentHtml && (
            <p className="text-slate-500">This lesson&rsquo;s materials are being prepared.</p>
          )}

          {/* 4. Homework turn-in, right on the lesson */}
          {lessonAssignments.map((assignment) => {
            const mine = mySubmissionsByAssignment.get(assignment.id) ?? [];
            const approved = mine.find((s) => s.status === "approved");
            const pending = mine.find((s) => s.status === "submitted");
            return (
              <div
                key={assignment.id}
                className="mt-10 rounded-2xl bg-slate-50 p-6"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="text-xl font-bold text-slate-900">
                    {assignment.title}
                  </h2>
                  <span className="flex items-center gap-2">
                    {approved && approved.score !== null && (
                      <span className="font-bold text-slate-900">
                        {approved.score}/{assignment.points}
                      </span>
                    )}
                    <StatusBadge
                      status={
                        approved?.status ?? pending?.status ?? mine[0]?.status ?? "notsubmitted"
                      }
                    />
                  </span>
                </div>
                {assignment.instructionsHtml && (
                  <div
                    className="lesson-body mt-3 text-sm"
                    dangerouslySetInnerHTML={{ __html: assignment.instructionsHtml }}
                  />
                )}
                {mine[0]?.feedback && (
                  <div className="mt-4 rounded-lg border-l-4 border-brand-500 bg-white p-4">
                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Mentor feedback
                    </p>
                    <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">
                      {mine[0].feedback}
                    </p>
                  </div>
                )}
                {approved ? (
                  <p className="mt-4 rounded-lg bg-green-50 p-4 text-sm font-medium text-green-800">
                    ✓ Approved. Well done!
                  </p>
                ) : pending ? (
                  <p className="mt-4 rounded-lg bg-amber-50 p-4 text-sm font-medium text-amber-800">
                    Your work is in — a mentor will review it soon.
                  </p>
                ) : (
                  <SubmissionForm assignmentId={assignment.id} />
                )}
                <p className="mt-3 text-xs text-slate-500">
                  <Link
                    href={`/assignments/${assignment.id}`}
                    className="hover:underline"
                  >
                    Full submission history →
                  </Link>
                </p>
              </div>
            );
          })}

          {/* Footer: complete + prev/next */}
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
