import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/auth/session";
import { getGradebook } from "@/lib/data";
import PageHero from "@/components/PageHero";
import StatusBadge from "@/components/StatusBadge";

export const metadata: Metadata = { title: "Grades" };

export default async function GradesPage() {
  const user = await requireUser();
  const gradebook = await getGradebook(user.id);

  return (
    <>
      <PageHero
        eyebrow="Your Record"
        title="Grades"
        intro="Every assignment, every score, every piece of mentor feedback."
      />
      <section className="bg-slate-50 px-4 py-12 sm:py-16">
        <div className="mx-auto max-w-4xl space-y-10">
          {gradebook.length === 0 && (
            <p className="text-center text-slate-600">
              Enroll in a course and your grades will appear here.
            </p>
          )}
          {gradebook.map(({ course, rows, earned, possible }) => (
            <div key={course.id} className="overflow-hidden rounded-2xl bg-white shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-900 px-6 py-4 text-white">
                <h2 className="text-xl">{course.title}</h2>
                {possible > 0 && (
                  <span className="text-sm font-semibold text-brand-400">
                    {earned}/{possible} points ({Math.round((earned / possible) * 100)}%)
                  </span>
                )}
              </div>
              {rows.length === 0 ? (
                <p className="px-6 py-5 text-sm text-slate-600">
                  No assignments in this course yet.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 text-xs uppercase tracking-wider text-slate-500">
                        <th className="px-6 py-3 font-semibold">Assignment</th>
                        <th className="px-4 py-3 font-semibold">Status</th>
                        <th className="px-6 py-3 text-right font-semibold">Score</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map(({ assignment, submission }) => (
                        <tr key={assignment.id} className="border-b border-slate-100 last:border-0">
                          <td className="px-6 py-3">
                            <Link
                              href={`/assignments/${assignment.id}`}
                              className="font-semibold text-slate-900 hover:text-brand-700"
                            >
                              {assignment.title}
                            </Link>
                          </td>
                          <td className="px-4 py-3">
                            <StatusBadge status={submission?.status ?? "notsubmitted"} />
                          </td>
                          <td className="px-6 py-3 text-right font-semibold text-slate-900">
                            {submission?.status === "approved" && submission.score !== null
                              ? `${submission.score}/${assignment.points}`
                              : "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
