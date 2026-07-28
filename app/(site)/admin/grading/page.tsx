import type { Metadata } from "next";
import Link from "next/link";
import { getGradingQueue } from "@/lib/data";
import PageHero from "@/components/PageHero";

export const metadata: Metadata = { title: "Admin · Grading" };

export default async function GradingQueuePage() {
  const queue = await getGradingQueue();

  return (
    <>
      <PageHero
        eyebrow="Admin"
        title="Grading Queue"
        intro={
          queue.length === 0
            ? undefined
            : `${queue.length} submission${queue.length === 1 ? "" : "s"} waiting, oldest first.`
        }
      />
      <section className="bg-slate-50 px-4 py-12">
        <div className="mx-auto max-w-4xl">
          {queue.length === 0 ? (
            <p className="text-center text-slate-600">
              Nothing to grade — every submission has been reviewed. 🎉
            </p>
          ) : (
            <ul className="space-y-3">
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
                        {submission.submittedAt.toLocaleString()}
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
      </section>
    </>
  );
}
