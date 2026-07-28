import Link from "next/link";
import { notFound } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { courses, getDb, users } from "@/lib/db";
import { getEnrolledCourses, getGradebook } from "@/lib/data";
import {
  setStudentEnrollment,
  setUserActive,
  setUserRole,
} from "@/lib/actions/admin";
import { requireAdmin } from "@/lib/auth/session";
import PageHero from "@/components/PageHero";
import StatusBadge from "@/components/StatusBadge";

export default async function AdminStudentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const userId = Number(id);
  if (!Number.isInteger(userId)) notFound();

  const admin = await requireAdmin();
  const db = await getDb();
  const student = await db.query.users.findFirst({
    where: eq(users.id, userId),
  });
  if (!student) notFound();

  const [gradebook, enrolled, allCourses] = await Promise.all([
    getGradebook(student.id),
    getEnrolledCourses(student.id),
    db.query.courses.findMany({
      orderBy: [asc(courses.track), asc(courses.sortOrder)],
    }),
  ]);
  const enrolledIds = new Set(enrolled.map((c) => c.id));
  const isSelf = student.id === admin.id;

  return (
    <>
      <PageHero eyebrow="Admin · Student" title={student.name} intro={student.email} />
      <section className="bg-slate-50 px-4 py-12">
        <div className="mx-auto grid max-w-5xl gap-8 lg:grid-cols-[1fr_18rem]">
          {/* Gradebook */}
          <div className="space-y-6">
            <h2 className="text-2xl">Gradebook</h2>
            {gradebook.length === 0 && (
              <p className="text-slate-600">Not enrolled in any courses yet.</p>
            )}
            {gradebook.map(({ course, rows, earned, possible }) => (
              <div key={course.id} className="overflow-hidden rounded-2xl bg-white shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-900 px-5 py-3 text-white">
                  <h3 className="font-semibold">{course.title}</h3>
                  {possible > 0 && (
                    <span className="text-sm font-semibold text-brand-400">
                      {earned}/{possible} ({Math.round((earned / possible) * 100)}%)
                    </span>
                  )}
                </div>
                <ul className="divide-y divide-slate-100">
                  {rows.map(({ assignment, submission }) => (
                    <li
                      key={assignment.id}
                      className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 text-sm"
                    >
                      <span className="font-medium text-slate-800">
                        {assignment.title}
                      </span>
                      <span className="flex items-center gap-2">
                        {submission?.status === "approved" &&
                          submission.score !== null && (
                            <span className="font-bold">
                              {submission.score}/{assignment.points}
                            </span>
                          )}
                        {submission && submission.status === "submitted" ? (
                          <Link
                            href={`/admin/grading/${submission.id}`}
                            className="font-semibold text-brand-700 hover:underline"
                          >
                            Grade now →
                          </Link>
                        ) : (
                          <StatusBadge status={submission?.status ?? "notsubmitted"} />
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          {/* Management sidebar */}
          <div className="space-y-8">
            <div className="rounded-2xl bg-white p-5 shadow-sm">
              <h2 className="font-bold text-slate-900">Enrollments</h2>
              <ul className="mt-3 space-y-2">
                {allCourses.map((course) => {
                  const isEnrolled = enrolledIds.has(course.id);
                  return (
                    <li
                      key={course.id}
                      className="flex items-center justify-between gap-2 text-sm"
                    >
                      <span className={isEnrolled ? "text-slate-800" : "text-slate-500"}>
                        {course.title}
                      </span>
                      <form action={setStudentEnrollment}>
                        <input type="hidden" name="userId" value={student.id} />
                        <input type="hidden" name="courseId" value={course.id} />
                        <input type="hidden" name="enroll" value={isEnrolled ? "0" : "1"} />
                        <button
                          type="submit"
                          className={`rounded px-2 py-1 text-xs font-semibold ${
                            isEnrolled
                              ? "text-red-600 hover:bg-red-50"
                              : "text-brand-700 hover:bg-slate-100"
                          }`}
                        >
                          {isEnrolled ? "Remove" : "Enroll"}
                        </button>
                      </form>
                    </li>
                  );
                })}
              </ul>
            </div>

            {!isSelf && (
              <div className="rounded-2xl bg-white p-5 shadow-sm">
                <h2 className="font-bold text-slate-900">Account</h2>
                <form action={setUserRole} className="mt-3">
                  <input type="hidden" name="userId" value={student.id} />
                  <input
                    type="hidden"
                    name="role"
                    value={student.role === "admin" ? "student" : "admin"}
                  />
                  <button
                    type="submit"
                    className="w-full rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    {student.role === "admin"
                      ? "Change to Student"
                      : "Make an Admin"}
                  </button>
                </form>
                <form action={setUserActive} className="mt-2">
                  <input type="hidden" name="userId" value={student.id} />
                  <input
                    type="hidden"
                    name="active"
                    value={student.active ? "0" : "1"}
                  />
                  <button
                    type="submit"
                    className={`w-full rounded-lg border px-4 py-2 text-sm font-semibold ${
                      student.active
                        ? "border-red-300 text-red-600 hover:bg-red-50"
                        : "border-green-500 text-green-700 hover:bg-green-50"
                    }`}
                  >
                    {student.active ? "Deactivate Account" : "Reactivate Account"}
                  </button>
                </form>
              </div>
            )}
          </div>
        </div>
      </section>
    </>
  );
}
