"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { and, eq } from "drizzle-orm";
import {
  assignments,
  courses,
  enrollments,
  getDb,
  lessonProgress,
  submissions,
  type Course,
  type User,
} from "@/lib/db";
import { requireUser } from "@/lib/auth/session";
import { saveSubmissionFile } from "@/lib/uploads";
import { aiGradeSubmission } from "@/lib/ai-grader";

export type FormState = { error?: string; ok?: boolean } | undefined;

// TFM runs one course at a time and every active student is automatically
// in it — there is no enroll step. A student may work in the course in
// session, or revisit one they participated in before. Working in the
// current course quietly records their participation (the enrollments
// table), which is what groups the grades page by course later.
async function mayWorkIn(
  user: User,
  course: Course
): Promise<boolean> {
  const db = await getDb();
  const record = await db.query.enrollments.findFirst({
    where: and(
      eq(enrollments.userId, user.id),
      eq(enrollments.courseId, course.id)
    ),
  });
  if (record) return true;
  if (user.role !== "admin" && (!course.current || !course.published))
    return false;
  await db
    .insert(enrollments)
    .values({ userId: user.id, courseId: course.id })
    .onConflictDoNothing();
  return true;
}

export async function submitAssignment(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  const user = await requireUser();
  const assignmentId = Number(formData.get("assignmentId"));
  const text = String(formData.get("text") ?? "").trim();
  const file = formData.get("file");
  const hasFile = file instanceof File && file.size > 0;

  if (!Number.isInteger(assignmentId)) return { error: "Something went wrong." };
  if (!text && !hasFile)
    return { error: "Attach your completed worksheet before turning it in." };

  const db = await getDb();
  const assignment = await db.query.assignments.findFirst({
    where: eq(assignments.id, assignmentId),
  });
  if (!assignment || !assignment.published)
    return { error: "This assignment is no longer available." };
  const course = await db.query.courses.findFirst({
    where: eq(courses.id, assignment.courseId),
  });
  if (!course || !(await mayWorkIn(user, course)))
    return { error: "This assignment isn't part of the current course." };

  // One open submission at a time: an approved assignment is done, and a
  // submitted one is waiting on a grader.
  const prior = await db.query.submissions.findMany({
    where: and(
      eq(submissions.assignmentId, assignmentId),
      eq(submissions.userId, user.id)
    ),
  });
  if (prior.some((s) => s.status === "approved"))
    return { error: "This assignment has already been approved — you're done!" };
  if (prior.some((s) => s.status === "submitted"))
    return { error: "Your submission is waiting to be graded." };

  let fileUrl: string | null = null;
  let fileName: string | null = null;
  if (hasFile) {
    try {
      const saved = await saveSubmissionFile(file, user.id);
      fileUrl = saved.url;
      fileName = saved.fileName;
    } catch (e) {
      return { error: e instanceof Error ? e.message : "Upload failed." };
    }
  }

  const [created] = await db
    .insert(submissions)
    .values({
      assignmentId,
      userId: user.id,
      text: text || null,
      fileUrl,
      fileName,
    })
    .returning();
  // Turning in the homework IS completing the lesson — check it off.
  if (assignment.lessonId) {
    await db
      .insert(lessonProgress)
      .values({ userId: user.id, lessonId: assignment.lessonId })
      .onConflictDoNothing();
  }
  // Claude drafts a suggested grade in the background; a teacher reviews it
  // in the grading queue before the student sees anything.
  after(() => aiGradeSubmission(created.id));
  revalidatePath(`/assignments/${assignmentId}`);
  revalidatePath("/dashboard");
  revalidatePath("/grades");
  return { ok: true };
}
