import type { Metadata } from "next";
import Link from "next/link";
import { sql } from "drizzle-orm";
import { courses, getDb, submissions, users } from "@/lib/db";
import { getGradingQueue } from "@/lib/data";
import PageHero from "@/components/PageHero";

export const metadata: Metadata = { title: "Admin" };

export default async function AdminOverviewPage() {
  const db = await getDb();
  const [[studentCount], [courseCount], [gradedCount], queue] =
    await Promise.all([
      db
        .select({ n: sql<number>`count(*)::int` })
        .from(users)
        .where(sql`${users.role} = 'student' and ${users.active}`),
      db.select({ n: sql<number>`count(*)::int` }).from(courses),
      db
        .select({ n: sql<number>`count(*)::int` })
        .from(submissions)
        .where(sql`${submissions.status} != 'submitted'`),
      getGradingQueue(),
    ]);

  const stats = [
    { label: "Active students", value: studentCount.n, href: "/admin/students" },
    { label: "Courses", value: courseCount.n, href: "/admin/courses" },
    { label: "Waiting to be graded", value: queue.length, href: "/admin/grading" },
    { label: "Assignments graded", value: gradedCount.n, href: "/admin/grading" },
  ];

  return (
    <>
      <PageHero eyebrow="TFM Administration" title="Overview" />
      <section className="bg-slate-50 px-4 py-12">
        <div className="mx-auto max-w-6xl">
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {stats.map((s) => (
              <Link
                key={s.label}
                href={s.href}
                className="hover-lift rounded-2xl bg-white p-6 shadow-sm"
              >
                <p className="font-display text-4xl text-brand-500">{s.value}</p>
                <p className="mt-1 text-sm font-semibold text-slate-600">
                  {s.label}
                </p>
              </Link>
            ))}
          </div>

          <h2 className="mt-12 text-2xl">Grading Queue</h2>
          {queue.length === 0 ? (
            <p className="mt-4 text-slate-600">
              Nothing waiting — every submission has been graded.
            </p>
          ) : (
            <ul className="mt-6 space-y-3">
              {queue.slice(0, 8).map(({ submission, student, assignment, course }) => (
                <li key={submission.id}>
                  <Link
                    href={`/admin/grading/${submission.id}`}
                    className="hover-lift flex flex-wrap items-center justify-between gap-2 rounded-xl bg-white p-4 shadow-sm"
                  >
                    <span>
                      <span className="block font-semibold text-slate-900">
                        {student.name} — {assignment.title}
                      </span>
                      <span className="mt-0.5 block text-xs text-slate-500">
                        {course.title} · submitted{" "}
                        {submission.submittedAt.toLocaleDateString()}
                      </span>
                    </span>
                    <span className="text-sm font-semibold text-brand-700">
                      Grade →
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </>
  );
}
