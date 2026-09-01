/**
 * One-off setup for tonight's orientation-dinner walkthrough: a dedicated
 * "Demo Student" account (never a real student's data) with a small demo
 * course showing one overdue assignment and one due this week, plus a
 * populated-looking report card from a few real completed courses.
 *
 * Sets the Demo Course as the site-wide "current" course — same toggle
 * the admin course list uses — so it's what every student's dashboard
 * shows until it's switched back (Admin > Courses > Make Current).
 *
 * Usage:
 *   set -a; source .env.vercel.local; set +a
 *   npx tsx scripts/setup-demo.ts [--dry-run]
 *
 * Safe to re-run: everything is upserted by slug/email.
 */
import { and, eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import {
  assignments,
  courses,
  enrollments,
  lessons,
  users,
} from "../lib/db/schema";
import { easternToUtc, saturdayDeadlineAfter } from "../lib/time";
import { openScriptDb } from "./db";

const DEMO_PASSWORD = "Welcome2026";
// Mirrors lib/auth/password.ts's hashPassword — reimplemented here since
// that file is guarded by "server-only" and can't be imported outside Next.
const hashPassword = (password: string) => bcrypt.hashSync(password, 12);

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const db = await openScriptDb();

  // ---- Demo Student user ----
  let demoUser = await db.query.users.findFirst({
    where: eq(users.email, "demo@tfmchelsea.org"),
  });
  if (!demoUser) {
    console.log("would create user: Demo Student <demo@tfmchelsea.org>");
    if (!dryRun) {
      [demoUser] = await db
        .insert(users)
        .values({
          name: "Demo Student",
          email: "demo@tfmchelsea.org",
          passwordHash: hashPassword(DEMO_PASSWORD),
          role: "student",
          active: true,
        })
        .returning();
    }
  } else {
    console.log("demo user already exists, resetting password");
    if (!dryRun) {
      await db
        .update(users)
        .set({ passwordHash: hashPassword(DEMO_PASSWORD) })
        .where(eq(users.id, demoUser.id));
    }
  }

  // ---- Demo Course ----
  let demoCourse = await db.query.courses.findFirst({
    where: eq(courses.slug, "orientation-demo"),
  });
  if (!demoCourse) {
    console.log("would create course: Orientation Demo");
    if (!dryRun) {
      [demoCourse] = await db
        .insert(courses)
        .values({
          slug: "orientation-demo",
          title: "Orientation Demo",
          description:
            "A sample course used for the student orientation walkthrough — not a real class.",
          track: "biblical-studies",
          published: true,
          sortOrder: 999,
        })
        .returning();
    }
  }

  if (demoCourse) {
    // Lesson 1 — already open, homework overdue.
    const l1Available = easternToUtc("2026-08-23T15:00");
    let lesson1 = await db.query.lessons.findFirst({
      where: and(eq(lessons.courseId, demoCourse.id), eq(lessons.slug, "sample-lesson-1")),
    });
    if (!lesson1) {
      console.log("would create lesson 1 (overdue example)");
      if (!dryRun) {
        [lesson1] = await db
          .insert(lessons)
          .values({
            courseId: demoCourse.id,
            slug: "sample-lesson-1",
            title: "Sample Lesson 1 — Getting Started",
            contentHtml:
              "<p>This is a sample lesson for the orientation walkthrough. In a real lesson, this is where the teaching video and worksheet would go.</p>",
            availableAt: l1Available,
            sortOrder: 10,
            published: true,
          })
          .returning();
      }
    }
    if (lesson1) {
      const existing = await db.query.assignments.findFirst({
        where: and(eq(assignments.courseId, demoCourse.id), eq(assignments.lessonId, lesson1.id)),
      });
      if (!existing) {
        console.log("would create assignment for lesson 1 (past due)");
        if (!dryRun) {
          await db.insert(assignments).values({
            courseId: demoCourse.id,
            lessonId: lesson1.id,
            title: "Homework — Sample Lesson 1",
            instructionsHtml: "<p>Upload any file — this is just to demo how homework turn-in works.</p>",
            points: 100,
            dueAt: saturdayDeadlineAfter(l1Available),
            sortOrder: 10,
            published: true,
          });
        }
      }
    }

    // Lesson 2 — opened this past Sunday, homework due this coming Saturday.
    const l2Available = easternToUtc("2026-08-30T15:00");
    let lesson2 = await db.query.lessons.findFirst({
      where: and(eq(lessons.courseId, demoCourse.id), eq(lessons.slug, "sample-lesson-2")),
    });
    if (!lesson2) {
      console.log("would create lesson 2 (due-this-week example)");
      if (!dryRun) {
        [lesson2] = await db
          .insert(lessons)
          .values({
            courseId: demoCourse.id,
            slug: "sample-lesson-2",
            title: "Sample Lesson 2 — This Week",
            contentHtml:
              "<p>This is a sample lesson for the orientation walkthrough.</p>",
            availableAt: l2Available,
            sortOrder: 20,
            published: true,
          })
          .returning();
      }
    }
    if (lesson2) {
      const existing = await db.query.assignments.findFirst({
        where: and(eq(assignments.courseId, demoCourse.id), eq(assignments.lessonId, lesson2.id)),
      });
      if (!existing) {
        console.log("would create assignment for lesson 2 (due this week)");
        if (!dryRun) {
          await db.insert(assignments).values({
            courseId: demoCourse.id,
            lessonId: lesson2.id,
            title: "Homework — Sample Lesson 2",
            instructionsHtml: "<p>Upload any file — this is just to demo how homework turn-in works.</p>",
            points: 100,
            dueAt: saturdayDeadlineAfter(l2Available),
            sortOrder: 20,
            published: true,
          });
        }
      }
    }
  }

  if (!dryRun && demoUser && demoCourse) {
    // ---- Enroll Demo Student in the demo course (in progress) ----
    const existingEnrollment = await db.query.enrollments.findFirst({
      where: and(eq(enrollments.userId, demoUser.id), eq(enrollments.courseId, demoCourse.id)),
    });
    if (!existingEnrollment) {
      await db.insert(enrollments).values({ userId: demoUser.id, courseId: demoCourse.id });
    }

    // ---- A few fabricated-but-realistic grades so /grades isn't empty ----
    const sample: { title: string; overridePct?: number; completedAt: Date }[] = [
      { title: "The General Epistles 111", overridePct: 91, completedAt: easternToUtc("2026-05-01T12:00") },
      { title: "Baptist Distinctives 121", overridePct: 87, completedAt: easternToUtc("2026-03-01T12:00") },
      { title: "First Aid", completedAt: easternToUtc("2026-02-01T12:00") },
      { title: "Ministry Participation — Fall 2025", completedAt: easternToUtc("2025-12-01T12:00") },
    ];
    for (const s of sample) {
      const course = await db.query.courses.findFirst({ where: eq(courses.title, s.title) });
      if (!course) {
        console.warn(`  skip sample grade — course not found: ${s.title}`);
        continue;
      }
      const existing = await db.query.enrollments.findFirst({
        where: and(eq(enrollments.userId, demoUser.id), eq(enrollments.courseId, course.id)),
      });
      if (existing) {
        await db
          .update(enrollments)
          .set({ overridePct: s.overridePct ?? null, completedAt: s.completedAt })
          .where(eq(enrollments.id, existing.id));
      } else {
        await db.insert(enrollments).values({
          userId: demoUser.id,
          courseId: course.id,
          overridePct: s.overridePct ?? null,
          completedAt: s.completedAt,
        });
      }
    }

    // ---- Make the demo course the site-wide "current" course ----
    await db.update(courses).set({ current: false }).where(eq(courses.current, true));
    await db.update(courses).set({ current: true, published: true }).where(eq(courses.id, demoCourse.id));
  }

  console.log(`\n${dryRun ? "DRY RUN — nothing written." : "Done."}`);
  if (!dryRun) {
    console.log(`\nDemo login:\n  email:    demo@tfmchelsea.org\n  password: ${DEMO_PASSWORD}`);
  }
}

main();
