import type { Metadata } from "next";
import Link from "next/link";
import { getGradedSubmissions, getGradingQueue } from "@/lib/data";
import PageHero from "@/components/PageHero";
import StatusBadge from "@/components/StatusBadge";
import { formatEastern } from "@/lib/time";

export const metadata: Metadata = { title: "Admin · Grading" };

export default async function GradingQueuePage() {
  const [queue, graded] = await Promise.all([
    getGradingQueue(),
    getGradedSubmissions(),
  ]);

  return (
    <>
      <PageHero
        eyebrow="Admin"
        title="Grading"
        intro={
          queue.length === 0
            ? undefined
            : `${queue.length} submission${queue.length === 1 ? "" : "s"} waiting, oldest first.`
        }
      />
      <section className="bg-slate-50 px-4 py-12">
        <div className="mx-auto max-w-4xl space-y-12">
          <div>
            <h2 className="text-xl font-bold text-slate-900">Queue</h2>
            {queue.length === 0 ? (
              <p className="mt-4 text-slate-600">
                Nothing to grade — every submission has been reviewed. 🎉
              </p>
            ) : (
              <ul className="mt-4 space-y-3">
                {queue.map(({ submission, student, assignment, course }) => (
                  <li key={submission.id}>
                    <Link
                      href={`/admin/grading/${submission.id}`}
                      className="hover-lift flex flex-wrap items-center justify-between gap-2 rounded-xl bg-white p-5 shadow-sm"
                    >
                      <span>
                        <span className="block font-semibold text-slate-900">
                          {student.name}
                        </span>
                        <span className="mt-0.5 block text-sm text-slate-600">
                          {assignment.title}
                          <span className="text-slate-400"> · {course.title}</span>
                        </span>
                      </span>
                      <span className="text-right">
                        <span className="block text-xs text-slate-500">
                          {formatEastern(submission.submittedAt)}
                        </span>
                        <span className="mt-1 inline-block text-sm font-semibold text-brand-700">
                          Grade →
                        </span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div>
            <h2 className="text-xl font-bold text-slate-900">Recently Graded</h2>
            <p className="mt-1 text-xs text-slate-500">
              Most recent {graded.length} graded submission{graded.length === 1 ? "" : "s"}.
            </p>
            {graded.length === 0 ? (
              <p className="mt-4 text-slate-600">Nothing graded yet.</p>
            ) : (
              <ul className="mt-4 space-y-3">
                {graded.map(({ submission, student, assignment, course }) => (
                  <li key={submission.id}>
                    <Link
                      href={`/admin/grading/${submission.id}`}
                      className="hover-lift flex flex-wrap items-center justify-between gap-2 rounded-xl bg-white p-5 shadow-sm"
                    >
                      <span>
                        <span className="block font-semibold text-slate-900">
                          {student.name}
                        </span>
                        <span className="mt-0.5 block text-sm text-slate-600">
                          {assignment.title}
                          <span className="text-slate-400"> · {course.title}</span>
                        </span>
                      </span>
                      <span className="text-right">
                        <span className="block text-xs text-slate-500">
                          {submission.gradedAt ? formatEastern(submission.gradedAt) : ""}
                        </span>
                        <span className="mt-1 flex items-center justify-end gap-2">
                          {submission.score !== null && (
                            <span className="text-sm font-bold text-slate-900">
                              {submission.score}/{assignment.points}
                            </span>
                          )}
                          <StatusBadge status={submission.status} />
                        </span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </section>
    </>
  );
}
