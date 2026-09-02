import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { and, asc, eq } from "drizzle-orm";
import { assignments, courses, getDb, submissions, users } from "@/lib/db";
import { setAssignmentCompletion } from "@/lib/actions/admin";
import { formatEastern, utcToEasternInput } from "@/lib/time";
import PageHero from "@/components/PageHero";

export const metadata: Metadata = { title: "Admin · Roster" };

export default async function AdminRosterPage({
  params,
}: {
  params: Promise<{ assignmentId: string }>;
}) {
  const { assignmentId: idParam } = await params;
  const assignmentId = Number(idParam);
  if (!Number.isInteger(assignmentId)) notFound();

  const db = await getDb();
  const assignment = await db.query.assignments.findFirst({
    where: eq(assignments.id, assignmentId),
  });
  if (!assignment) notFound();
  const course = await db.query.courses.findFirst({
    where: eq(courses.id, assignment.courseId),
  });

  const [students, subs] = await Promise.all([
    db.query.users.findMany({
      where: and(eq(users.role, "student"), eq(users.active, true)),
      orderBy: [asc(users.name)],
    }),
    db.query.submissions.findMany({ where: eq(submissions.assignmentId, assignmentId) }),
  ]);
  const submissionByUser = new Map(subs.map((s) => [s.userId, s]));

  const today = utcToEasternInput(new Date()).slice(0, 10);

  return (
    <>
      <PageHero
        eyebrow={`Admin · Roster${course ? ` · ${course.title}` : ""}`}
        title={assignment.title}
        intro={
          assignment.dueAt
            ? `Due ${formatEastern(assignment.dueAt)}`
            : undefined
        }
      />
      <section className="bg-slate-50 px-4 py-12">
        <div className="mx-auto max-w-2xl">
          {course && (
            <Link
              href={`/admin/courses/${course.id}`}
              className="text-sm font-semibold text-brand-700 hover:underline"
            >
              ← {course.title}
            </Link>
          )}
          <div className="mt-4 overflow-hidden rounded-2xl bg-white shadow-sm">
            <ul className="divide-y divide-slate-100">
              {students.map((student) => {
                const sub = submissionByUser.get(student.id);
                const done = Boolean(sub);
                const defaultDate = sub
                  ? utcToEasternInput(sub.submittedAt).slice(0, 10)
                  : today;
                return (
                  <li
                    key={student.id}
                    className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5"
                  >
                    <div>
                      <p className="font-semibold text-slate-900">{student.name}</p>
                      {sub && (
                        <p className="text-xs text-slate-500">
                          Completed {formatEastern(sub.submittedAt, {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })}
                          {sub.fileUrl && (
                            <>
                              {" · "}
                              <a
                                href={sub.fileUrl}
                                target="_blank"
                                className="text-brand-700 hover:underline"
                              >
                                view upload
                              </a>
                            </>
                          )}
                        </p>
                      )}
                    </div>
                    <form action={setAssignmentCompletion} className="flex items-center gap-2">
                      <input type="hidden" name="userId" value={student.id} />
                      <input type="hidden" name="assignmentId" value={assignmentId} />
                      <input
                        type="date"
                        name="date"
                        defaultValue={defaultDate}
                        className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm text-slate-900"
                      />
                      <input type="hidden" name="complete" value={done ? "0" : "1"} />
                      <button
                        type="submit"
                        className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
                          done
                            ? "border border-slate-300 text-slate-600 hover:bg-slate-50"
                            : "border border-green-500 text-green-700 hover:bg-green-50"
                        }`}
                      >
                        {done ? "Un-mark" : "Mark Done"}
                      </button>
                    </form>
                  </li>
                );
              })}
              {students.length === 0 && (
                <li className="px-5 py-6 text-center text-sm text-slate-600">
                  No active students yet.
                </li>
              )}
            </ul>
          </div>
        </div>
      </section>
    </>
  );
}
