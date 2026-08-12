import "server-only";
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import {
  assignments,
  courses,
  enrollmentScores,
  enrollments,
  getDb,
  lessonProgress,
  lessons,
  submissions,
  users,
  type Assignment,
  type Course,
  type EnrollmentScore,
  type Submission,
} from "@/lib/db";

// Shared read queries. Mutations live in lib/actions.

export const TRACK_INFO: Record<
  string,
  { title: string; href: string; image: string; blurb: string }
> = {
  "biblical-studies": {
    title: "Biblical Studies",
    href: "/biblical-studies",
    image: "/images/track-biblical-studies.png",
    blurb:
      "Biblical doctrine, biblical principles, and biblical church practice — the foundation for a life of ministry.",
  },
  "practical-skills": {
    title: "Practical Skills",
    href: "/practical-skills",
    image: "/images/track-practical-skills.png",
    blurb:
      "First aid, construction, and the everyday skills a missionary leans on in the field.",
  },
  "ministry-participation": {
    title: "Ministry Participation",
    href: "/ministry-participation",
    image: "/images/track-ministry-participation.png",
    blurb:
      "Hands-on service in the ministries of the local church — learning by doing, alongside mentors.",
  },
};

/** The one course currently in session (TFM runs one at a time). */
export async function getCurrentCourse(): Promise<Course | null> {
  const db = await getDb();
  return (
    (await db.query.courses.findFirst({ where: eq(courses.current, true) })) ??
    null
  );
}

/**
 * Whether a user may open a course: admins always; students when it's the
 * course in session (every active student is automatically in it) or one
 * they participated in before.
 */
export async function canViewCourse(
  user: { id: number; role: string },
  course: Course
): Promise<boolean> {
  if (user.role === "admin") return true;
  if (course.current && course.published) return true;
  return Boolean(await getEnrollment(user.id, course.id));
}

export async function getPublishedCourses(track?: string): Promise<Course[]> {
  const db = await getDb();
  return db.query.courses.findMany({
    where: track
      ? and(
          eq(courses.published, true),
          eq(courses.track, track as Course["track"])
        )
      : eq(courses.published, true),
    orderBy: [asc(courses.sortOrder), asc(courses.title)],
  });
}

export async function getCourseBySlug(slug: string) {
  const db = await getDb();
  return db.query.courses.findFirst({ where: eq(courses.slug, slug) });
}

export async function getCourseContent(
  courseId: number,
  { includeDrafts = false }: { includeDrafts?: boolean } = {}
) {
  const db = await getDb();
  const [courseLessons, courseAssignments] = await Promise.all([
    db.query.lessons.findMany({
      where: includeDrafts
        ? eq(lessons.courseId, courseId)
        : and(eq(lessons.courseId, courseId), eq(lessons.published, true)),
      orderBy: [asc(lessons.sortOrder), asc(lessons.id)],
    }),
    db.query.assignments.findMany({
      where: includeDrafts
        ? eq(assignments.courseId, courseId)
        : and(
            eq(assignments.courseId, courseId),
            eq(assignments.published, true)
          ),
      orderBy: [asc(assignments.sortOrder), asc(assignments.id)],
    }),
  ]);
  return { lessons: courseLessons, assignments: courseAssignments };
}

export async function getEnrollment(userId: number, courseId: number) {
  const db = await getDb();
  return db.query.enrollments.findFirst({
    where: and(
      eq(enrollments.userId, userId),
      eq(enrollments.courseId, courseId)
    ),
  });
}

export async function getEnrolledCourses(userId: number): Promise<Course[]> {
  const db = await getDb();
  const rows = await db
    .select({ course: courses })
    .from(enrollments)
    .innerJoin(courses, eq(enrollments.courseId, courses.id))
    .where(eq(enrollments.userId, userId))
    .orderBy(asc(courses.sortOrder), asc(courses.title));
  return rows.map((r) => r.course);
}

export async function getCompletedLessonIds(
  userId: number,
  lessonIds: number[]
): Promise<Set<number>> {
  if (lessonIds.length === 0) return new Set();
  const db = await getDb();
  const rows = await db.query.lessonProgress.findMany({
    where: and(
      eq(lessonProgress.userId, userId),
      inArray(lessonProgress.lessonId, lessonIds)
    ),
  });
  return new Set(rows.map((r) => r.lessonId));
}

/** Latest submission per assignment for one student. */
export async function getLatestSubmissions(
  userId: number,
  assignmentIds?: number[]
): Promise<Map<number, Submission>> {
  const db = await getDb();
  const rows = await db.query.submissions.findMany({
    where:
      assignmentIds !== undefined
        ? assignmentIds.length === 0
          ? undefined
          : and(
              eq(submissions.userId, userId),
              inArray(submissions.assignmentId, assignmentIds)
            )
        : eq(submissions.userId, userId),
    orderBy: [desc(submissions.submittedAt)],
  });
  if (assignmentIds !== undefined && assignmentIds.length === 0)
    return new Map();
  const latest = new Map<number, Submission>();
  for (const row of rows) {
    // Rows arrive newest-first; an approved grade always wins.
    const cur = latest.get(row.assignmentId);
    if (!cur || (cur.status !== "approved" && row.status === "approved")) {
      latest.set(row.assignmentId, row);
    }
  }
  return latest;
}

/**
 * A student's full report card, grouped by course — every course they
 * have participated in (current or past), with earned/possible points.
 */
export async function getGradebook(userId: number) {
  const enrolled = await getEnrolledCourses(userId);
  const result: {
    course: Course;
    completedAt: Date | null;
    overridePct: number | null;
    rows: { assignment: Assignment; submission: Submission | null }[];
    archivedScores: EnrollmentScore[];
    earned: number;
    possible: number;
  }[] = [];
  const db = await getDb();
  const enrollmentRows = await db.query.enrollments.findMany({
    where: eq(enrollments.userId, userId),
  });
  const enrollmentByCourse = new Map(enrollmentRows.map((e) => [e.courseId, e]));
  const scoresByEnrollment = new Map<number, EnrollmentScore[]>();
  if (enrollmentRows.length > 0) {
    const scores = await db.query.enrollmentScores.findMany({
      where: inArray(
        enrollmentScores.enrollmentId,
        enrollmentRows.map((e) => e.id)
      ),
      orderBy: [asc(enrollmentScores.sortOrder)],
    });
    for (const score of scores) {
      const list = scoresByEnrollment.get(score.enrollmentId) ?? [];
      list.push(score);
      scoresByEnrollment.set(score.enrollmentId, list);
    }
  }
  for (const course of enrolled) {
    const { assignments: courseAssignments } = await getCourseContent(
      course.id
    );
    const latest = await getLatestSubmissions(
      userId,
      courseAssignments.map((a) => a.id)
    );
    const rows = courseAssignments.map((assignment) => ({
      assignment,
      submission: latest.get(assignment.id) ?? null,
    }));
    let earned = 0;
    let possible = 0;
    for (const { assignment, submission } of rows) {
      if (submission?.status === "approved" && submission.score !== null) {
        earned += submission.score;
        possible += assignment.points;
      }
    }
    const enrollment = enrollmentByCourse.get(course.id);
    result.push({
      course,
      completedAt: enrollment?.completedAt ?? null,
      overridePct: enrollment?.overridePct ?? null,
      rows,
      archivedScores: enrollment ? (scoresByEnrollment.get(enrollment.id) ?? []) : [],
      earned,
      possible,
    });
  }
  return result;
}

/** Grading queue: ungraded submissions, oldest first. */
export async function getGradingQueue() {
  const db = await getDb();
  return db
    .select({
      submission: submissions,
      student: users,
      assignment: assignments,
      course: courses,
    })
    .from(submissions)
    .innerJoin(users, eq(submissions.userId, users.id))
    .innerJoin(assignments, eq(submissions.assignmentId, assignments.id))
    .innerJoin(courses, eq(assignments.courseId, courses.id))
    .where(eq(submissions.status, "submitted"))
    .orderBy(asc(submissions.submittedAt));
}
