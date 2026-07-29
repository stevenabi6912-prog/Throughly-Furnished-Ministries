import Link from "next/link";
import { notFound } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { assignments, courses, getDb, lessons } from "@/lib/db";
import {
  deleteAssignment,
  deleteCourse,
  deleteLesson,
} from "@/lib/actions/admin";
import PageHero from "@/components/PageHero";
import CourseForm from "@/components/admin/CourseForm";
import LessonForm from "@/components/admin/LessonForm";
import AssignmentForm from "@/components/admin/AssignmentForm";

export default async function AdminCourseDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const courseId = Number(id);
  if (!Number.isInteger(courseId)) notFound();

  const db = await getDb();
  const course = await db.query.courses.findFirst({
    where: eq(courses.id, courseId),
  });
  if (!course) notFound();
  const [courseLessons, courseAssignments] = await Promise.all([
    db.query.lessons.findMany({
      where: eq(lessons.courseId, courseId),
      orderBy: [asc(lessons.sortOrder), asc(lessons.id)],
    }),
    db.query.assignments.findMany({
      where: eq(assignments.courseId, courseId),
      orderBy: [asc(assignments.sortOrder), asc(assignments.id)],
    }),
  ]);

  return (
    <>
      <PageHero eyebrow="Admin · Course" title={course.title} />
      <section className="bg-slate-50 px-4 py-12">
        <div className="mx-auto max-w-4xl space-y-10">
          <div className="rounded-2xl bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-xl font-bold text-slate-900">Course Details</h2>
              <Link
                href={`/courses/${course.slug}`}
                className="text-sm font-semibold text-brand-700 hover:underline"
              >
                View as student →
              </Link>
            </div>
            <div className="mt-4">
              <CourseForm course={course} />
            </div>
          </div>

          <div className="rounded-2xl bg-white p-6 shadow-sm">
            <h2 className="text-xl font-bold text-slate-900">
              Lessons ({courseLessons.length})
            </h2>
            <ul className="mt-4 space-y-6">
              {courseLessons.map((lesson) => (
                <li key={lesson.id} className="rounded-xl border border-slate-200 p-5">
                  <details>
                    <summary className="cursor-pointer font-semibold text-slate-900">
                      {lesson.title}
                      {!lesson.published && (
                        <span className="ml-2 rounded-full bg-slate-200 px-2 py-0.5 text-xs text-slate-600">
                          Draft
                        </span>
                      )}
                    </summary>
                    <div className="mt-4">
                      <LessonForm
                        courseId={course.id}
                        lesson={lesson}
                        hasAssignment={courseAssignments.some(
                          (a) => a.lessonId === lesson.id
                        )}
                      />
                      <form action={deleteLesson} className="mt-3">
                        <input type="hidden" name="id" value={lesson.id} />
                        <button
                          type="submit"
                          className="text-xs font-semibold text-red-600 hover:underline"
                        >
                          Delete this lesson
                        </button>
                      </form>
                    </div>
                  </details>
                </li>
              ))}
            </ul>
            <h3 className="mt-8 font-semibold text-slate-900">Add a lesson</h3>
            <div className="mt-3">
              <LessonForm courseId={course.id} />
            </div>
          </div>

          <div className="rounded-2xl bg-white p-6 shadow-sm">
            <h2 className="text-xl font-bold text-slate-900">
              Assignments ({courseAssignments.length})
            </h2>
            <ul className="mt-4 space-y-6">
              {courseAssignments.map((assignment) => (
                <li key={assignment.id} className="rounded-xl border border-slate-200 p-5">
                  <details>
                    <summary className="cursor-pointer font-semibold text-slate-900">
                      {assignment.title}
                      <span className="ml-2 text-xs font-normal text-slate-500">
                        {assignment.points} pts
                      </span>
                      {!assignment.published && (
                        <span className="ml-2 rounded-full bg-slate-200 px-2 py-0.5 text-xs text-slate-600">
                          Draft
                        </span>
                      )}
                    </summary>
                    <div className="mt-4">
                      <AssignmentForm
                        courseId={course.id}
                        lessons={courseLessons}
                        assignment={assignment}
                      />
                      <form action={deleteAssignment} className="mt-3">
                        <input type="hidden" name="id" value={assignment.id} />
                        <button
                          type="submit"
                          className="text-xs font-semibold text-red-600 hover:underline"
                        >
                          Delete this assignment
                        </button>
                      </form>
                    </div>
                  </details>
                </li>
              ))}
            </ul>
            <h3 className="mt-8 font-semibold text-slate-900">Add an assignment</h3>
            <div className="mt-3">
              <AssignmentForm courseId={course.id} lessons={courseLessons} />
            </div>
          </div>

          <div className="rounded-2xl border border-red-200 bg-white p-6">
            <h2 className="text-lg font-bold text-red-700">Danger Zone</h2>
            <p className="mt-1 text-sm text-slate-600">
              Deleting a course removes its lessons, assignments, enrollments,
              and submissions. There is no undo.
            </p>
            <form action={deleteCourse} className="mt-4">
              <input type="hidden" name="id" value={course.id} />
              <button
                type="submit"
                className="rounded-lg border border-red-600 px-4 py-2 text-sm font-semibold text-red-600 transition-colors hover:bg-red-50"
              >
                Delete Course
              </button>
            </form>
          </div>
        </div>
      </section>
    </>
  );
}
