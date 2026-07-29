import Link from "next/link";
import { notFound } from "next/navigation";
import { and, desc, eq } from "drizzle-orm";
import { assignments, courses, getDb, lessons, submissions, users } from "@/lib/db";
import PageHero from "@/components/PageHero";
import StatusBadge from "@/components/StatusBadge";
import GradeForm from "./GradeForm";
import { formatEastern, weeksLate } from "@/lib/time";

export default async function GradeSubmissionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const submissionId = Number(id);
  if (!Number.isInteger(submissionId)) notFound();

  const db = await getDb();
  const submission = await db.query.submissions.findFirst({
    where: eq(submissions.id, submissionId),
  });
  if (!submission) notFound();
  const [assignment, student] = await Promise.all([
    db.query.assignments.findFirst({
      where: eq(assignments.id, submission.assignmentId),
    }),
    db.query.users.findFirst({ where: eq(users.id, submission.userId) }),
  ]);
  if (!assignment || !student) notFound();
  const course = await db.query.courses.findFirst({
    where: eq(courses.id, assignment.courseId),
  });
  const lesson = assignment.lessonId
    ? await db.query.lessons.findFirst({
        where: eq(lessons.id, assignment.lessonId),
      })
    : undefined;
  // The student's earlier attempts, for context.
  const history = await db.query.submissions.findMany({
    where: and(
      eq(submissions.assignmentId, assignment.id),
      eq(submissions.userId, student.id)
    ),
    orderBy: [desc(submissions.submittedAt)],
  });

  return (
    <>
      <PageHero
        eyebrow={`Grading · ${course?.title ?? ""}`}
        title={assignment.title}
        intro={`Submitted by ${student.name}`}
      />
      <section className="bg-slate-50 px-4 py-12">
        <div className="mx-auto grid max-w-5xl gap-8 lg:grid-cols-[1fr_20rem]">
          <div className="space-y-6">
            {assignment.instructionsHtml && (
              <details className="rounded-2xl bg-white p-6 shadow-sm">
                <summary className="cursor-pointer font-semibold text-slate-900">
                  Assignment instructions
                </summary>
                <div
                  className="lesson-body mt-4"
                  dangerouslySetInnerHTML={{
                    __html: assignment.instructionsHtml,
                  }}
                />
              </details>
            )}

            {history.map((sub) => (
              <div
                key={sub.id}
                className={`rounded-2xl bg-white p-6 shadow-sm ${
                  sub.id === submission.id ? "ring-2 ring-brand-500" : "opacity-80"
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm text-slate-500">
                    {sub.id === submission.id ? "This submission · " : "Earlier attempt · "}
                    {sub.submittedAt.toLocaleString()}
                  </p>
                  <StatusBadge status={sub.status} />
                </div>
                {sub.text ? (
                  <p className="mt-4 whitespace-pre-wrap rounded-lg bg-slate-50 p-4 text-sm text-slate-800">
                    {sub.text}
                  </p>
                ) : (
                  <p className="mt-4 text-sm italic text-slate-500">
                    No written answer.
                  </p>
                )}
                {sub.fileUrl && (
                  <p className="mt-3">
                    <a
                      href={sub.fileUrl}
                      target="_blank"
                      className="text-sm font-semibold text-brand-700 hover:underline"
                    >
                      📎 {sub.fileName ?? "Attached file"}
                    </a>
                  </p>
                )}
                {sub.feedback && (
                  <p className="mt-3 rounded-lg border-l-4 border-slate-300 bg-slate-50 p-3 text-sm text-slate-600">
                    {sub.feedback}
                  </p>
                )}
              </div>
            ))}
          </div>

          <div>
            <div className="sticky top-24 rounded-2xl bg-white p-6 shadow-sm">
              <h2 className="text-lg font-bold text-slate-900">Grade</h2>
              <p className="mt-1 text-sm text-slate-500">
                Out of {assignment.points} points
                {assignment.dueAt &&
                  ` · was due ${formatEastern(assignment.dueAt)}`}
              </p>
              {lesson?.answerKeyUrl && (
                <a
                  href={lesson.answerKeyUrl}
                  target="_blank"
                  className="mt-2 inline-block rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  📄 Open Answer Key
                </a>
              )}
              {submission.aiScore !== null && submission.status === "submitted" && (
                <div className="mt-4 rounded-lg bg-brand-500/5 p-3 ring-1 ring-brand-500/20">
                  <p className="text-xs font-semibold uppercase tracking-wider text-brand-700">
                    Claude&rsquo;s suggestion — review before approving
                  </p>
                  <p className="mt-1 text-sm font-bold text-slate-900">
                    {submission.aiScore}/{assignment.points}
                  </p>
                  {submission.aiFeedback && (
                    <p className="mt-1 whitespace-pre-wrap text-xs text-slate-600">
                      {submission.aiFeedback}
                    </p>
                  )}
                  <p className="mt-2 text-xs text-slate-500">
                    Pre-filled below — edit anything before approving. The
                    student sees nothing until you do.
                  </p>
                </div>
              )}
              {submission.status === "submitted" ? (
                <GradeForm
                  submissionId={submission.id}
                  maxPoints={assignment.points}
                  lateWeeks={weeksLate(submission.submittedAt, assignment.dueAt)}
                  defaultScore={submission.aiScore}
                  defaultFeedback={submission.aiFeedback}
                />
              ) : (
                <p className="mt-4 text-sm text-slate-600">
                  Already graded
                  {submission.score !== null && ` — ${submission.score}/${assignment.points}`}
                  .{" "}
                  <Link href="/admin/grading" className="font-semibold text-brand-700 hover:underline">
                    Back to the queue
                  </Link>
                </p>
              )}
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
