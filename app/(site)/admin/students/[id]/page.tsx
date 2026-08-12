import Link from "next/link";
import { notFound } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { courses, getDb, users } from "@/lib/db";
import { getGradebook } from "@/lib/data";
import {
  setCourseCompletion,
  setGradeOverride,
  setUserActive,
  setUserRole,
} from "@/lib/actions/admin";
import { requireAdmin } from "@/lib/auth/session";
import PageHero from "@/components/PageHero";
import ReportCard from "@/components/ReportCard";

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

  const [gradebook, allCourses] = await Promise.all([
    getGradebook(student.id),
    db.query.courses.findMany({
      orderBy: [asc(courses.track), asc(courses.sortOrder)],
    }),
  ]);
  const recordByCourse = new Map(gradebook.map((g) => [g.course.id, g]));
  const isSelf = student.id === admin.id;

  // Submissions still waiting on a grade, surfaced for quick access.
  const waiting = gradebook.flatMap(({ rows }) =>
    rows.filter((r) => r.submission?.status === "submitted")
  );

  return (
    <>
      <PageHero eyebrow="Admin · Student" title={student.name} intro={student.email} />
      <section className="bg-slate-50 px-4 py-12">
        <div className="mx-auto grid max-w-5xl gap-8 lg:grid-cols-[1fr_18rem]">
          <div className="space-y-6">
            {waiting.length > 0 && (
              <div className="rounded-2xl bg-amber-50 p-5">
                <h2 className="text-sm font-bold text-amber-900">
                  Waiting to be graded
                </h2>
                <ul className="mt-2 space-y-1">
                  {waiting.map(({ assignment, submission }) => (
                    <li key={assignment.id}>
                      <Link
                        href={`/admin/grading/${submission!.id}`}
                        className="text-sm font-semibold text-brand-700 hover:underline"
                      >
                        {assignment.title} →
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <ReportCard studentName={student.name} gradebook={gradebook} linkAssignments />
          </div>

          {/* Management sidebar */}
          <div className="space-y-8">
            <div className="rounded-2xl bg-white p-5 shadow-sm">
              <h2 className="font-bold text-slate-900">Course Record</h2>
              <p className="mt-1 text-xs text-slate-500">
                Marking a course complete awards its credits (and the
                Complete/Pass on the report card).
              </p>
              <ul className="mt-3 space-y-2">
                {allCourses.map((course) => {
                  const record = recordByCourse.get(course.id);
                  const completed = Boolean(record?.completedAt);
                  return (
                    <li key={course.id} className="text-sm">
                      <div className="flex items-center justify-between gap-2">
                        <span
                          className={
                            record ? "text-slate-800" : "text-slate-400"
                          }
                        >
                          {course.title}
                          {completed && " ✓"}
                        </span>
                        <form action={setCourseCompletion}>
                          <input type="hidden" name="userId" value={student.id} />
                          <input type="hidden" name="courseId" value={course.id} />
                          <input
                            type="hidden"
                            name="complete"
                            value={completed ? "0" : "1"}
                          />
                          <button
                            type="submit"
                            className={`rounded px-2 py-1 text-xs font-semibold ${
                              completed
                                ? "text-slate-500 hover:bg-slate-100"
                                : "text-brand-700 hover:bg-slate-100"
                            }`}
                          >
                            {completed ? "Un-complete" : "Mark complete"}
                          </button>
                        </form>
                      </div>
                      {course.track === "biblical-studies" && (
                        <form
                          action={setGradeOverride}
                          className="mt-1 flex items-center gap-1.5 pl-3"
                        >
                          <input type="hidden" name="userId" value={student.id} />
                          <input type="hidden" name="courseId" value={course.id} />
                          <label className="text-xs text-slate-500">
                            Official grade %
                            <input
                              name="pct"
                              type="number"
                              min={0}
                              max={100}
                              defaultValue={record?.overridePct ?? ""}
                              placeholder="auto"
                              className="ml-1.5 w-16 rounded border border-slate-300 px-1.5 py-0.5 text-xs text-slate-900"
                            />
                          </label>
                          <button
                            type="submit"
                            className="rounded px-1.5 py-0.5 text-xs font-semibold text-brand-700 hover:bg-slate-100"
                          >
                            Set
                          </button>
                        </form>
                      )}
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
                    {student.active ? "Archive Account" : "Restore Account"}
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
