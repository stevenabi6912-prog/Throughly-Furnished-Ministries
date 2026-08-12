/**
 * Imports individual assignment/component scores (Worksheet 1: 94,
 * Midterm: 96, Final Exam: 98, ...) for archived enrollments that were
 * created by scripts/import-report-cards.ts but only carry a single
 * rolled-up `overridePct`. Source: the raw per-row LearnDash gradebook
 * exports in ~/Downloads (the "-all-grades.csv" files), which don't
 * identify their course by name — each file is mapped to a course below
 * based on distinctive assignment names in its contents (e.g. "Shadows
 * of Christ" → Doctrines of Christ 321) cross-checked against the
 * matching students' already-imported report-card percentages (see chat
 * history for the reasoning per file).
 *
 * This never touches `enrollments.overridePct`/`completedAt` — the
 * report card's numbers stay authoritative. It only adds the per-line
 * detail shown when a student expands a course on their report card. A
 * row is skipped (and reported) if the student or the enrollment for
 * that course doesn't already exist — this script never creates users
 * or enrollments.
 *
 * Usage:
 *   set -a; source .env.vercel.local; set +a
 *   npx tsx scripts/import-assignment-scores.ts [--dry-run]
 *
 * Safe to re-run: for every enrollment it touches, existing scores are
 * deleted and reinserted fresh.
 */
import { readFileSync } from "node:fs";
import { eq, inArray } from "drizzle-orm";
import { enrollmentScores, enrollments } from "../lib/db/schema";
import { openScriptDb } from "./db";

const DOWNLOADS = "/Users/stevenwireman/Downloads";

const FILES: { path: string; courseTitle: string }[] = [
  { path: `${DOWNLOADS}/gradebook-5495-0-all-grades.csv`, courseTitle: "The General Epistles 111" },
  { path: `${DOWNLOADS}/gradebook-5114-0-all-grades.csv`, courseTitle: "Church History 221 & 301" },
  { path: `${DOWNLOADS}/gradebook-5194-0-all-grades.csv`, courseTitle: "Church History 301" },
  { path: `${DOWNLOADS}/gradebook-2114-0-all-grades.csv`, courseTitle: "Doctrines of Christ 321" },
  { path: `${DOWNLOADS}/gradebook-4420-0-all-grades.csv`, courseTitle: "Biblical Missions and Evangelism 101" },
  { path: `${DOWNLOADS}/gradebook-4554-0-all-grades.csv`, courseTitle: "Baptist Distinctives 121" },
];

// Minimal CSV line parser — handles quoted fields with embedded commas,
// which is all these exports use (no embedded newlines or quotes).
function parseCsv(text: string): string[][] {
  return text
    .split(/\r?\n/)
    .filter((line) => line.length > 0)
    .map((line) => {
      const fields: string[] = [];
      let cur = "";
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const c = line[i];
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

function parseTimestamp(raw: string): Date | null {
  if (!raw) return null;
  const cleaned = raw.replace(" @ ", ", ");
  const d = new Date(cleaned);
  return Number.isNaN(d.getTime()) ? null : d;
}

type PendingRow = { label: string; score: number; recordedAt: Date | null };

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const db = await openScriptDb();

  const allCourses = await db.query.courses.findMany();
  const allUsers = await db.query.users.findMany();
  const userIdByEmail = new Map(allUsers.map((u) => [u.email.toLowerCase(), u.id]));

  // enrollmentId -> ordered rows to write
  const pending = new Map<number, PendingRow[]>();
  const skippedUsers = new Set<string>();
  const skippedNoEnrollment = new Set<string>();

  for (const file of FILES) {
    const course = allCourses.find(
      (c) => c.title.toLowerCase() === file.courseTitle.toLowerCase()
    );
    if (!course) {
      console.warn(`⚠ course not found: ${file.courseTitle} (skipping ${file.path})`);
      continue;
    }

    let enrollmentRows;
    try {
      enrollmentRows = await db.query.enrollments.findMany({
        where: eq(enrollments.courseId, course.id),
      });
    } catch {
      continue;
    }
    const enrollmentByUser = new Map(enrollmentRows.map((e) => [e.userId, e.id]));

    const text = readFileSync(file.path, "utf8");
    const [header, ...rows] = parseCsv(text);
    const col = (name: string) => header.findIndex((h) => h.trim() === name);
    const emailCol = col("Email Address");
    const nameCol = col("Display Name");
    const labelCol = col("Grade Name");
    const scoreCol = col("Grade Score");
    const tsCol = col("Grade Completion Timestamp");

    for (const row of rows) {
      const email = row[emailCol]?.trim().toLowerCase();
      const name = row[nameCol]?.trim();
      const label = row[labelCol]?.trim();
      const scoreRaw = row[scoreCol]?.trim();
      if (!email || !label || scoreRaw === undefined || scoreRaw === "") continue;
      const score = Math.round(Number(scoreRaw));
      if (Number.isNaN(score)) continue;

      const userId = userIdByEmail.get(email);
      if (userId === undefined) {
        skippedUsers.add(`${name} <${email}> (${file.courseTitle})`);
        continue;
      }
      const enrollmentId = enrollmentByUser.get(userId);
      if (enrollmentId === undefined) {
        skippedNoEnrollment.add(`${name} <${email}> — ${file.courseTitle}`);
        continue;
      }
      const list = pending.get(enrollmentId) ?? [];
      list.push({ label, score, recordedAt: parseTimestamp(row[tsCol]?.trim() ?? "") });
      pending.set(enrollmentId, list);
    }
  }

  let totalScores = 0;
  for (const rows of pending.values()) totalScores += rows.length;

  console.log(`${dryRun ? "DRY RUN — " : ""}Assignment score import`);
  console.log(`  enrollments touched: ${pending.size}`);
  console.log(`  scores to write:     ${totalScores}`);
  if (skippedUsers.size > 0) {
    console.log(`\n  skipped — no matching user (${skippedUsers.size}):`);
    for (const s of skippedUsers) console.log(`     - ${s}`);
  }
  if (skippedNoEnrollment.size > 0) {
    console.log(`\n  skipped — no existing enrollment (${skippedNoEnrollment.size}):`);
    for (const s of skippedNoEnrollment) console.log(`     - ${s}`);
  }

  if (dryRun) return;

  const enrollmentIds = [...pending.keys()];
  if (enrollmentIds.length > 0) {
    await db.delete(enrollmentScores).where(inArray(enrollmentScores.enrollmentId, enrollmentIds));
  }
  for (const [enrollmentId, rows] of pending) {
    await db.insert(enrollmentScores).values(
      rows.map((r, i) => ({
        enrollmentId,
        label: r.label,
        score: r.score,
        recordedAt: r.recordedAt,
        sortOrder: i,
      }))
    );
  }
  console.log("\nDone.");
}

main();
