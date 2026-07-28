"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import {
  assignments,
  courses,
  enrollments,
  getDb,
  lessonProgress,
  lessons,
  submissions,
} from "@/lib/db";
import { requireUser } from "@/lib/auth/session";
import { saveSubmissionFile } from "@/lib/uploads";

export type FormState = { error?: string; ok?: boolean } | undefined;

export async function enrollInCourse(courseId: number): Promise<void> {
  const user = await requireUser();
  const db = await getDb();
  const course = await db.query.courses.findFirst({
    where: and(eq(courses.id, courseId), eq(courses.published, true)),
  });
  if (!course) return;
  await db
    .insert(enrollments)
    .values({ userId: user.id, courseId })
    .onConflictDoNothing();
  revalidatePath("/courses");
  redirect(`/courses/${course.slug}`);
}

export async function toggleLessonComplete(lessonId: number): Promise<void> {
  const user = await requireUser();
  const db = await getDb();
  const lesson = await db.query.lessons.findFirst({
    where: eq(lessons.id, lessonId),
  });
  if (!lesson) return;
  // Only enrolled students can record progress.
  const enrolled = await db.query.enrollments.findFirst({
    where: and(
      eq(enrollments.userId, user.id),
      eq(enrollments.courseId, lesson.courseId)
    ),
  });
  if (!enrolled) return;

  const existing = await db.query.lessonProgress.findFirst({
    where: and(
      eq(lessonProgress.userId, user.id),
      eq(lessonProgress.lessonId, lessonId)
    ),
  });
  if (existing) {
    await db.delete(lessonProgress).where(eq(lessonProgress.id, existing.id));
  } else {
    await db
      .insert(lessonProgress)
      .values({ userId: user.id, lessonId })
      .onConflictDoNothing();
  }
  revalidatePath("/courses", "layout");
  revalidatePath("/dashboard");
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
    return { error: "Write your answer or attach a file before submitting." };

  const db = await getDb();
  const assignment = await db.query.assignments.findFirst({
    where: eq(assignments.id, assignmentId),
  });
  if (!assignment || !assignment.published)
    return { error: "This assignment is no longer available." };
  const enrolled = await db.query.enrollments.findFirst({
    where: and(
      eq(enrollments.userId, user.id),
      eq(enrollments.courseId, assignment.courseId)
    ),
  });
  if (!enrolled) return { error: "You aren't enrolled in this course." };

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

  await db.insert(submissions).values({
    assignmentId,
    userId: user.id,
    text: text || null,
    fileUrl,
    fileName,
  });
  revalidatePath(`/assignments/${assignmentId}`);
  revalidatePath("/dashboard");
  revalidatePath("/grades");
  return { ok: true };
}
