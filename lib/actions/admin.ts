"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq, inArray } from "drizzle-orm";
import {
  assignments,
  courses,
  enrollments,
  getDb,
  lessons,
  submissions,
  users,
} from "@/lib/db";
import { requireAdmin } from "@/lib/auth/session";
import { cleanHtml } from "@/lib/html";
import { saveContentFile } from "@/lib/uploads";
import { youTubeEmbedUrl } from "@/lib/youtube";
import { easternToUtc, saturdayDeadlineAfter, weeksLate } from "@/lib/time";

export type FormState = { error?: string; ok?: boolean } | undefined;

const TRACKS = new Set([
  "biblical-studies",
  "practical-skills",
  "ministry-participation",
]);

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

// --- Courses ---------------------------------------------------------------

export async function saveCourse(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  await requireAdmin();
  const id = formData.get("id") ? Number(formData.get("id")) : null;
  const title = String(formData.get("title") ?? "").trim();
  const track = String(formData.get("track") ?? "");
  const description = String(formData.get("description") ?? "").trim();
  const sortOrder = Number(formData.get("sortOrder") ?? 0) || 0;
  const published = formData.get("published") === "on";

  if (!title) return { error: "The course needs a title." };
  if (!TRACKS.has(track)) return { error: "Pick a program track." };

  const db = await getDb();
  const values = {
    title,
    track: track as typeof courses.$inferInsert.track,
    description,
    sortOrder,
    published,
  };
  if (id) {
    await db.update(courses).set(values).where(eq(courses.id, id));
    revalidatePath("/admin/courses", "layout");
    return { ok: true };
  }
  let slug = slugify(title) || "course";
  if (await db.query.courses.findFirst({ where: eq(courses.slug, slug) })) {
    slug = `${slug}-${Date.now() % 10000}`;
  }
  const [created] = await db
    .insert(courses)
    .values({ ...values, slug })
    .returning();
  redirect(`/admin/courses/${created.id}`);
}

/**
 * Make one course "the course in session" (clears any other). Every active
 * student automatically sees it on their dashboard. Passing currentId only
 * (no courseId) ends the session with no new course.
 */
export async function setCurrentCourse(formData: FormData): Promise<void> {
  await requireAdmin();
  const courseId = formData.get("courseId") ? Number(formData.get("courseId")) : null;
  const db = await getDb();
  await db.update(courses).set({ current: false }).where(eq(courses.current, true));
  if (courseId) {
    // The current course must be visible, so publish it too.
    await db
      .update(courses)
      .set({ current: true, published: true })
      .where(eq(courses.id, courseId));
  }
  revalidatePath("/", "layout");
}

export async function deleteCourse(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = Number(formData.get("id"));
  const db = await getDb();
  await db.delete(courses).where(eq(courses.id, id));
  revalidatePath("/admin/courses", "layout");
  redirect("/admin/courses");
}

// --- Lessons ---------------------------------------------------------------

export async function saveLesson(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  await requireAdmin();
  const id = formData.get("id") ? Number(formData.get("id")) : null;
  const courseId = Number(formData.get("courseId"));
  const title = String(formData.get("title") ?? "").trim();
  const contentHtml = cleanHtml(String(formData.get("contentHtml") ?? ""));
  const sortOrder = Number(formData.get("sortOrder") ?? 0) || 0;
  const published = formData.get("published") === "on";
  const hasHomework = formData.get("hasHomework") === "on";

  // The teaching video: any YouTube link is fine, we normalize at render.
  const videoUrl = String(formData.get("videoUrl") ?? "").trim() || null;
  if (videoUrl && !youTubeEmbedUrl(videoUrl))
    return { error: "That doesn't look like a YouTube link." };

  // The worksheet: either a freshly uploaded PDF or a pasted URL.
  let worksheetUrl = String(formData.get("worksheetUrl") ?? "").trim() || null;
  const worksheetFile = formData.get("worksheetFile");
  if (worksheetFile instanceof File && worksheetFile.size > 0) {
    if (!worksheetFile.name.toLowerCase().endsWith(".pdf"))
      return { error: "The worksheet must be a PDF." };
    try {
      worksheetUrl = (await saveContentFile(worksheetFile)).url;
    } catch (e) {
      return { error: e instanceof Error ? e.message : "Worksheet upload failed." };
    }
  }

  if (!title) return { error: "The lesson needs a title." };

  // Scheduling: when the lesson opens (Eastern time). Blank = right away.
  const availableAtRaw = String(formData.get("availableAt") ?? "").trim();
  const availableAt = availableAtRaw ? easternToUtc(availableAtRaw) : null;

  const db = await getDb();
  const values = {
    title, contentHtml, sortOrder, published, videoUrl, worksheetUrl, availableAt,
  };
  let lessonId = id;
  if (id) {
    await db.update(lessons).set(values).where(eq(lessons.id, id));
  } else {
    let slug = slugify(title) || "lesson";
    const clash = await db.query.lessons.findFirst({
      where: and(eq(lessons.courseId, courseId), eq(lessons.slug, slug)),
    });
    if (clash) slug = `${slug}-${Date.now() % 10000}`;
    const [created] = await db
      .insert(lessons)
      .values({ courseId, slug, ...values })
      .returning();
    lessonId = created.id;
  }

  // "This lesson has homework" — make sure a turn-in assignment exists.
  // Its due date follows the schedule: the Saturday (11:59 PM Eastern)
  // after the lesson opens.
  if (hasHomework && lessonId) {
    const dueAt = availableAt ? saturdayDeadlineAfter(availableAt) : null;
    const existing = await db.query.assignments.findFirst({
      where: eq(assignments.lessonId, lessonId),
    });
    if (!existing) {
      await db.insert(assignments).values({
        courseId,
        lessonId,
        title: `Homework — ${title}`,
        instructionsHtml:
          "<p>Complete the worksheet for this lesson and turn it in here.</p>",
        points: 100,
        dueAt,
      });
    } else if (dueAt) {
      await db
        .update(assignments)
        .set({ dueAt })
        .where(eq(assignments.lessonId, lessonId));
    }
  }

  revalidatePath("/admin/courses", "layout");
  revalidatePath("/courses", "layout");
  return { ok: true };
}

export async function deleteLesson(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = Number(formData.get("id"));
  const db = await getDb();
  await db.delete(lessons).where(eq(lessons.id, id));
  revalidatePath("/admin/courses", "layout");
  revalidatePath("/courses", "layout");
}

// --- Assignments -----------------------------------------------------------

export async function saveAssignment(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  await requireAdmin();
  const id = formData.get("id") ? Number(formData.get("id")) : null;
  const courseId = Number(formData.get("courseId"));
  const lessonIdRaw = formData.get("lessonId");
  const lessonId = lessonIdRaw && lessonIdRaw !== "" ? Number(lessonIdRaw) : null;
  const title = String(formData.get("title") ?? "").trim();
  const instructionsHtml = cleanHtml(
    String(formData.get("instructionsHtml") ?? "")
  );
  const points = Math.max(1, Number(formData.get("points") ?? 100) || 100);
  const dueAtRaw = String(formData.get("dueAt") ?? "");
  // Due dates mean end of that day, Michigan time.
  const dueAt = dueAtRaw ? easternToUtc(`${dueAtRaw}T23:59`) : null;
  const published = formData.get("published") === "on";

  if (!title) return { error: "The assignment needs a title." };
  const db = await getDb();
  const values = { courseId, lessonId, title, instructionsHtml, points, dueAt, published };
  if (id) {
    await db.update(assignments).set(values).where(eq(assignments.id, id));
  } else {
    await db.insert(assignments).values(values);
  }
  revalidatePath("/admin/courses", "layout");
  revalidatePath("/courses", "layout");
  return { ok: true };
}

export async function deleteAssignment(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = Number(formData.get("id"));
  const db = await getDb();
  await db.delete(assignments).where(eq(assignments.id, id));
  revalidatePath("/admin/courses", "layout");
  revalidatePath("/courses", "layout");
}

// --- Grading ---------------------------------------------------------------

export async function gradeSubmission(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  const admin = await requireAdmin();
  const id = Number(formData.get("id"));
  const status = String(formData.get("status") ?? "");
  const scoreRaw = String(formData.get("score") ?? "").trim();
  let score = scoreRaw === "" ? null : Number(scoreRaw);
  let feedback = String(formData.get("feedback") ?? "").trim() || null;
  const applyLatePenalty = formData.get("applyLatePenalty") === "on";

  if (status !== "approved" && status !== "returned")
    return { error: "Choose approve or return." };
  if (score !== null && (!Number.isFinite(score) || score < 0))
    return { error: "The score must be a positive number." };
  if (status === "approved" && score === null)
    return { error: "Enter a score to approve this submission." };

  const db = await getDb();

  // Late policy: 10% of the assignment's points off per week late.
  if (status === "approved" && applyLatePenalty && score !== null) {
    const submission = await db.query.submissions.findFirst({
      where: eq(submissions.id, id),
    });
    const assignment = submission
      ? await db.query.assignments.findFirst({
          where: eq(assignments.id, submission.assignmentId),
        })
      : null;
    if (submission && assignment) {
      const weeks = weeksLate(submission.submittedAt, assignment.dueAt);
      if (weeks > 0) {
        const penalty = Math.round(assignment.points * 0.1 * weeks);
        score = Math.max(0, score - penalty);
        const note = `Late penalty: −${penalty} points (${weeks} week${weeks === 1 ? "" : "s"} late, 10% per week).`;
        feedback = feedback ? `${feedback}\n\n${note}` : note;
      }
    }
  }

  await db
    .update(submissions)
    .set({
      status: status as "approved" | "returned",
      score,
      feedback,
      gradedById: admin.id,
      gradedAt: new Date(),
    })
    .where(eq(submissions.id, id));
  revalidatePath("/admin", "layout");
  revalidatePath("/grades");
  revalidatePath("/dashboard");
  redirect("/admin/grading");
}

// --- Students --------------------------------------------------------------

export async function setStudentEnrollment(formData: FormData): Promise<void> {
  await requireAdmin();
  const userId = Number(formData.get("userId"));
  const courseId = Number(formData.get("courseId"));
  const enroll = formData.get("enroll") === "1";
  const db = await getDb();
  if (enroll) {
    await db
      .insert(enrollments)
      .values({ userId, courseId })
      .onConflictDoNothing();
  } else {
    await db
      .delete(enrollments)
      .where(
        and(eq(enrollments.userId, userId), eq(enrollments.courseId, courseId))
      );
  }
  revalidatePath("/admin/students", "layout");
}

/**
 * Set (or clear) the official final grade for a course on a student's
 * record — overrides the computed average on the report card. This is how
 * grades from the paper gradebook get onto the site.
 */
export async function setGradeOverride(formData: FormData): Promise<void> {
  await requireAdmin();
  const userId = Number(formData.get("userId"));
  const courseId = Number(formData.get("courseId"));
  const raw = String(formData.get("pct") ?? "").trim();
  const pct = raw === "" ? null : Math.max(0, Math.min(100, Math.round(Number(raw))));
  if (pct !== null && !Number.isFinite(pct)) return;
  const db = await getDb();
  await db
    .insert(enrollments)
    .values({ userId, courseId, overridePct: pct })
    .onConflictDoUpdate({
      target: [enrollments.userId, enrollments.courseId],
      set: { overridePct: pct },
    });
  revalidatePath("/admin/students", "layout");
  revalidatePath("/grades");
}

/**
 * Mark a course complete (or not) on a student's record — this is what
 * awards credits and the Complete/Pass entries on the report card.
 */
export async function setCourseCompletion(formData: FormData): Promise<void> {
  await requireAdmin();
  const userId = Number(formData.get("userId"));
  const courseId = Number(formData.get("courseId"));
  const complete = formData.get("complete") === "1";
  const db = await getDb();
  await db
    .insert(enrollments)
    .values({
      userId,
      courseId,
      completedAt: complete ? new Date() : null,
    })
    .onConflictDoUpdate({
      target: [enrollments.userId, enrollments.courseId],
      set: { completedAt: complete ? new Date() : null },
    });
  revalidatePath("/admin/students", "layout");
  revalidatePath("/grades");
}

export async function setUserRole(formData: FormData): Promise<void> {
  const admin = await requireAdmin();
  const userId = Number(formData.get("userId"));
  const role = String(formData.get("role"));
  if (userId === admin.id) return; // can't demote yourself
  if (role !== "student" && role !== "admin") return;
  const db = await getDb();
  await db.update(users).set({ role }).where(eq(users.id, userId));
  revalidatePath("/admin/students", "layout");
}

/**
 * Bulk archive / restore / delete from the students table. Only touches
 * student accounts — admins (and yourself) are never affected, so a stray
 * select-all can't lock anyone out or erase an admin.
 */
export async function bulkStudents(formData: FormData): Promise<void> {
  const admin = await requireAdmin();
  const op = String(formData.get("op"));
  const ids = String(formData.get("ids") ?? "")
    .split(",")
    .map((s) => Number(s))
    .filter((n) => Number.isInteger(n) && n !== admin.id);
  if (ids.length === 0) return;
  if (op !== "archive" && op !== "restore" && op !== "delete") return;

  const db = await getDb();
  const targets = await db.query.users.findMany({
    where: inArray(users.id, ids),
  });
  const studentIds = targets
    .filter((u) => u.role === "student")
    .map((u) => u.id);
  if (studentIds.length === 0) return;

  if (op === "delete") {
    // Cascades: enrollments, lesson progress, and submissions go with them.
    await db.delete(users).where(inArray(users.id, studentIds));
  } else {
    await db
      .update(users)
      .set({ active: op === "restore" })
      .where(inArray(users.id, studentIds));
  }
  revalidatePath("/admin/students", "layout");
}

export async function setUserActive(formData: FormData): Promise<void> {
  const admin = await requireAdmin();
  const userId = Number(formData.get("userId"));
  const active = formData.get("active") === "1";
  if (userId === admin.id) return; // can't deactivate yourself
  const db = await getDb();
  await db.update(users).set({ active }).where(eq(users.id, userId));
  revalidatePath("/admin/students", "layout");
}
