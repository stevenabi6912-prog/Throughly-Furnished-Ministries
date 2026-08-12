/**
 * Imports individual LearnDash quiz scores from
 * learndash_reports_user_quizzes_d9d83a0ad3.csv into enrollment_scores.
 *
 * This data turned out NOT to be covered by the original bulk
 * scripts/import-learndash.ts run (verified directly against production:
 * every quiz title below was confirmed absent from that user's
 * `submissions`) — despite the CSV's own "course_title" column only
 * naming the old top-level LearnDash track ("Biblical Studies"), each
 * quiz_title clearly identifies a specific site course (see QUIZ_COURSE
 * below), and every (user, course) pair already has a completed
 * enrollment from either the report-card import or the original bulk
 * import — so this only adds supplementary per-quiz detail, never a new
 * enrollment or grade.
 *
 * Usage:
 *   set -a; source .env.vercel.local; set +a
 *   npx tsx scripts/import-quiz-scores.ts [--dry-run]
 *
 * Safe to re-run: for every enrollment it touches, existing scores
 * *from this quiz CSV* are identified by label and replaced — it will
 * not touch enrollment_scores rows written by other import scripts for
 * the same enrollment (e.g. worksheet/midterm detail from the raw
 * gradebook CSVs).
 */
import { readFileSync } from "node:fs";
import { and, eq, inArray } from "drizzle-orm";
import { enrollmentScores, enrollments } from "../lib/db/schema";
import { openScriptDb } from "./db";

const QUIZ_CSV =
  "/Users/stevenwireman/Downloads/learndash_reports_user_quizzes_d9d83a0ad3.csv";

// quiz_title -> exact courses.title. Anything not listed here is skipped
// and reported (there were none left unmapped as of the source data).
const QUIZ_COURSE: Record<string, string> = {
  // Baptist Distinctives 121
  "All Regenerate Membership": "Baptist Distinctives 121",
  "Biblical Authority": "Baptist Distinctives 121",
  "Individual Soul Liberty": "Baptist Distinctives 121",
  "Priesthood of the Believer": "Baptist Distinctives 121",
  "Separation of Church and State": "Baptist Distinctives 121",
  "Two Offices": "Baptist Distinctives 121",
  "Two Ordinances": "Baptist Distinctives 121",
  "Midterm Exam, Baptist Distinctives": "Baptist Distinctives 121",
  "Final Exam, Baptist Distinctives": "Baptist Distinctives 121",
  // The General Epistles 111
  "The General Epistle of 1 Peter": "The General Epistles 111",
  "The General Epistle of 2nd Peter": "The General Epistles 111",
  "The General Epistle of James": "The General Epistles 111",
  "The General Epistle of Jude": "The General Epistles 111",
  "The General Epistles of 1st, 2nd, and 3rd John": "The General Epistles 111",
  "The General Epistles Final Exam": "The General Epistles 111",
  // Doctrines of Christ 321
  "Christ in the Old Testament Part 1": "Doctrines of Christ 321",
  "Christ in the Old Testament Part 2": "Doctrines of Christ 321",
  "The Deity of Christ Part 1": "Doctrines of Christ 321",
  "The Deity of Christ Part 2": "Doctrines of Christ 321",
  "The Humanity of Christ Part 1": "Doctrines of Christ 321",
  // Biblical Missions and Evangelism 101
  "Origin of Missions": "Biblical Missions and Evangelism 101",
  "The History of Missions": "Biblical Missions and Evangelism 101",
  "The Message of Missions": "Biblical Missions and Evangelism 101",
  "The Method and Means of Missions": "Biblical Missions and Evangelism 101",
  "The Purpose and People of Missions": "Biblical Missions and Evangelism 101",
  "The Completion of Missions": "Biblical Missions and Evangelism 101",
  "Mandate of Missions": "Biblical Missions and Evangelism 101",
  "Biblical Missions and Evangelism Midterm Exam": "Biblical Missions and Evangelism 101",
  "Biblical Missions and Evangelism Final Exam": "Biblical Missions and Evangelism 101",
  // The Biblical Family 201
  "Families in the Bible": "The Biblical Family 201",
  "The Purpose of the Family": "The Biblical Family 201",
  // Church History 301
  "Church History 301 Final Exam": "Church History 301",
  // Church Epistles 311
  "Church Epistles Final Exam": "Church Epistles 311",
};

// CR-only line endings (classic Mac / old Excel export) — no LF at all.
function parseCsv(text: string): string[][] {
  return text
    .split(/\r\n|\r|\n/)
    .filter((line) => line.length > 0)
    .map((line) => {
      const fields: string[] = [];
      let cur = "";
      let inQuotes = false;
      for (const c of line) {
        if (inQuotes) {
          if (c === '"') inQuotes = false;
          else cur += c;
        } else if (c === '"') {
          inQuotes = true;
        } else if (c === ",") {
          fields.push(cur);
          cur = "";
        } else {
          cur += c;
        }
      }
      fields.push(cur);
      return fields;
    });
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const db = await openScriptDb();

  const allCourses = await db.query.courses.findMany();
  const courseIdByTitle = new Map(allCourses.map((c) => [c.title.toLowerCase(), c.id]));
  const allUsers = await db.query.users.findMany();
  const userIdByEmail = new Map(allUsers.map((u) => [u.email.toLowerCase(), u.id]));

  const text = readFileSync(QUIZ_CSV, "utf8");
  const [header, ...rows] = parseCsv(text);
  const col = (name: string) => header.indexOf(name);
  const emailCol = col("email");
  const titleCol = col("quiz_title");
  const percentCol = col("percentage");
  const dateCol = col("date");

  type PendingRow = { label: string; score: number; recordedAt: Date | null };
  const pending = new Map<number, PendingRow[]>();
  const skippedUnmapped = new Set<string>();
  const skippedNoUser = new Set<string>();
  const skippedNoEnrollment = new Set<string>();

  for (const row of rows) {
    const email = row[emailCol]?.trim().toLowerCase();
    const title = row[titleCol]?.trim();
    const pctRaw = row[percentCol]?.trim();
    if (!email || !title || !pctRaw) continue;
    const score = Math.round(Number(pctRaw));
    if (Number.isNaN(score)) continue;

    const courseTitle = QUIZ_COURSE[title];
    if (!courseTitle) {
      skippedUnmapped.add(title);
      continue;
    }
    const courseId = courseIdByTitle.get(courseTitle.toLowerCase());
    if (!courseId) {
      skippedUnmapped.add(`${title} -> ${courseTitle} (course not found)`);
      continue;
    }
    const userId = userIdByEmail.get(email);
    if (userId === undefined) {
      skippedNoUser.add(email);
      continue;
    }
    const enrollment = await db.query.enrollments.findFirst({
      where: and(eq(enrollments.userId, userId), eq(enrollments.courseId, courseId)),
    });
    if (!enrollment) {
      skippedNoEnrollment.add(`${email} — ${courseTitle}`);
      continue;
    }
    const rawDate = row[dateCol]?.trim();
    const recordedAt = rawDate ? new Date(rawDate) : null;
    const list = pending.get(enrollment.id) ?? [];
    list.push({
      label: title,
      score,
      recordedAt: recordedAt && !Number.isNaN(recordedAt.getTime()) ? recordedAt : null,
    });
    pending.set(enrollment.id, list);
  }

  let total = 0;
  for (const rows of pending.values()) total += rows.length;
  console.log(`${dryRun ? "DRY RUN — " : ""}Quiz score import`);
  console.log(`  enrollments touched: ${pending.size}`);
  console.log(`  scores to write:     ${total}`);
  if (skippedUnmapped.size > 0) {
    console.log(`\n  skipped — unmapped quiz title (${skippedUnmapped.size}):`);
    for (const s of skippedUnmapped) console.log(`     - ${s}`);
  }
  if (skippedNoUser.size > 0) {
    console.log(`\n  skipped — no matching user (${skippedNoUser.size}):`);
    for (const s of skippedNoUser) console.log(`     - ${s}`);
  }
  if (skippedNoEnrollment.size > 0) {
    console.log(`\n  skipped — no existing enrollment (${skippedNoEnrollment.size}):`);
    for (const s of skippedNoEnrollment) console.log(`     - ${s}`);
  }

  if (dryRun) return;

  for (const [enrollmentId, rows] of pending) {
    const existing = await db.query.enrollmentScores.findMany({
      where: eq(enrollmentScores.enrollmentId, enrollmentId),
    });
    // Append after whatever's already there (e.g. worksheet/midterm rows
    // from the raw gradebook import), replacing only this quiz CSV's own
    // labels if this script has already run against this enrollment.
    const quizLabels = new Set(Object.keys(QUIZ_COURSE));
    const keep = existing.filter((e) => !quizLabels.has(e.label));
    if (existing.length !== keep.length) {
      await db.delete(enrollmentScores).where(
        inArray(
          enrollmentScores.id,
          existing.filter((e) => quizLabels.has(e.label)).map((e) => e.id)
        )
      );
    }
    const startOrder = keep.length > 0 ? Math.max(...keep.map((e) => e.sortOrder)) + 1 : 0;
    await db.insert(enrollmentScores).values(
      rows.map((r, i) => ({
        enrollmentId,
        label: r.label,
        score: r.score,
        recordedAt: r.recordedAt,
        sortOrder: startOrder + i,
      }))
    );
  }
  console.log("\nDone.");
}

main();
