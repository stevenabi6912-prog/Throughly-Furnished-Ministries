import Link from "next/link";
import { notFound } from "next/navigation";
import { and, desc, eq } from "drizzle-orm";
import { requireUser } from "@/lib/auth/session";
import { assignments, courses, getDb, lessons, submissions } from "@/lib/db";
import { canViewCourse } from "@/lib/data";
import { formatEastern } from "@/lib/time";
import StatusBadge from "@/components/StatusBadge";
import SubmissionForm from "./SubmissionForm";

export default async function AssignmentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const assignmentId = Number(id);
  if (!Number.isInteger(assignmentId)) notFound();

  const user = await requireUser();
  const db = await getDb();
  const assignment = await db.query.assignments.findFirst({
    where: eq(assignments.id, assignmentId),
  });
  if (!assignment || (!assignment.published && user.role !== "admin"))
    notFound();
  const course = await db.query.courses.findFirst({
    where: eq(courses.id, assignment.courseId),
  });
  if (!course || !(await canViewCourse(user, course))) notFound();

  // Locked until it opens — same rule as the lesson it belongs to (if
  // any), plus its own availableAt for standalone assignments like
  // weekly Devotions/Sermon Notes/Scripture Memory. A hidden/draft
  // lesson (a few leftovers from the LearnDash import) hides its
  // homework outright, same as navigating to the lesson itself would.
  const lesson = assignment.lessonId
    ? await db.query.lessons.findFirst({ where: eq(lessons.id, assignment.lessonId) })
    : null;
  if (lesson && !lesson.published && user.role !== "admin") notFound();
  const opensAt = lesson?.availableAt ?? assignment.availableAt;
  if (user.role !== "admin" && opensAt && opensAt > new Date()) {
    return (
      <section className="bg-slate-50 px-4 py-24 text-center">
        <div className="mx-auto max-w-md rounded-2xl bg-white p-10 shadow-sm">
          <p className="text-4xl" aria-hidden="true">🔒</p>
          <h1 className="mt-4 text-2xl text-slate-900">{assignment.title}</h1>
          <p className="mt-3 text-slate-600">
            This opens {formatEastern(opensAt)}.
          </p>
          <Link
            href={`/courses/${course.slug}`}
            className="mt-6 inline-block rounded-lg bg-brand-500 px-6 py-3 font-semibold text-white transition-colors hover:bg-brand-600"
          >
            Back to {course.title}
          </Link>
        </div>
      </section>
    );
  }

  const mySubmissions = await db.query.submissions.findMany({
    where: and(
      eq(submissions.assignmentId, assignmentId),
      eq(submissions.userId, user.id)
    ),
    orderBy: [desc(submissions.submittedAt)],
  });
  const approved = mySubmissions.find((s) => s.status === "approved");
  const pending = mySubmissions.find((s) => s.status === "submitted");
  const isLate = Boolean(assignment.dueAt && assignment.dueAt < new Date());

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
          <h1 className="mt-3 text-3xl sm:text-4xl">{assignment.title}</h1>
          <p className="mt-2 text-sm text-slate-400">{assignment.points} points</p>
          {assignment.dueAt && (
            <p
              className={`mt-1 text-sm font-semibold ${isLate ? "text-red-400" : "text-slate-300"}`}
            >
              {isLate ? "Past due — " : "Due "}
              {formatEastern(assignment.dueAt)}
              {isLate && " · late work loses 10% per week"}
            </p>
          )}
        </div>
      </section>

      <section className="bg-white px-4 py-12">
        <div className="mx-auto max-w-3xl">
          {assignment.instructionsHtml ? (
            <div
              className="lesson-body"
              dangerouslySetInnerHTML={{ __html: assignment.instructionsHtml }}
            />
          ) : (
            <p className="text-slate-500">No instructions provided.</p>
          )}

          {/* Submission history with grades + feedback */}
          {mySubmissions.length > 0 && (
            <div className="mt-10">
              <h2 className="text-xl font-bold text-slate-900">
                Your Submissions
              </h2>
              <ul className="mt-4 space-y-4">
                {mySubmissions.map((sub) => (
                  <li key={sub.id} className="rounded-2xl bg-slate-50 p-5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-sm text-slate-500">
                        Submitted {sub.submittedAt.toLocaleString()}
                      </span>
                      <span className="flex items-center gap-2">
                        {sub.status === "approved" && sub.score !== null && (
                          <span className="font-bold text-slate-900">
                            {sub.score}/{assignment.points}
                          </span>
                        )}
                        <StatusBadge status={sub.status} />
                      </span>
                    </div>
                    {sub.text && (
                      <p className="mt-3 whitespace-pre-wrap rounded-lg bg-white p-4 text-sm text-slate-700">
                        {sub.text}
                      </p>
                    )}
                    {sub.fileUrl && (
                      <p className="mt-3 text-sm">
                        <a
                          href={sub.fileUrl}
                          className="font-semibold text-brand-700 hover:underline"
                          target="_blank"
                        >
                          📎 {sub.fileName ?? "Attached file"}
                        </a>
                      </p>
                    )}
                    {sub.feedback && (
                      <div className="mt-3 rounded-lg border-l-4 border-brand-500 bg-white p-4">
                        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                          Teacher feedback
                        </p>
                        <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">
                          {sub.feedback}
                        </p>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Submission form */}
          <div className="mt-10">
            {approved ? (
              <p className="rounded-2xl bg-green-50 p-5 text-sm font-medium text-green-800">
                ✓ This assignment has been approved. Well done!
              </p>
            ) : pending ? (
              <p className="rounded-2xl bg-amber-50 p-5 text-sm font-medium text-amber-800">
                Your work is in — a teacher will review it soon.
              </p>
            ) : (
              <>
                <h2 className="text-xl font-bold text-slate-900">
                  {mySubmissions.length > 0 ? "Resubmit" : "Submit Your Work"}
                </h2>
                <SubmissionForm assignmentId={assignment.id} />
              </>
            )}
          </div>
        </div>
      </section>
    </>
  );
}
