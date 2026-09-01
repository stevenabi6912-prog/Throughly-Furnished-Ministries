/**
 * One-shot import of the manually-maintained "New Report Cards.xlsx"
 * workbook into the site. Reads the pre-extracted JSON dump at
 * /tmp/report_cards.json (produced by a one-off python/openpyxl pass over
 * the workbook — see chat history) and, per student sheet:
 *
 *   - matches the student to an existing user by name, or creates a new
 *     (inactive, no-login) alumni record — this workbook goes back to
 *     2019 and includes many students who have since graduated
 *   - matches each course cell to an existing course, or creates it
 *     (four Practical Skills courses and ~24 distinct Ministry
 *     Participation terms don't exist yet)
 *   - writes the grade onto that student's enrollment: a percentage
 *     override for graded Biblical Studies courses, or just a completion
 *     date for Practical Skills "Complete" / Ministry Participation
 *     "Pass" rows (courses with no grade at all, "Incomplete", "Fail",
 *     or a bare "MPA" with no term are left alone — nothing to record)
 *
 * Usage:
 *   set -a; source .env.vercel.local; set +a
 *   npx tsx scripts/import-report-cards.ts [--dry-run]
 *
 * Safe to re-run: courses are matched by title before creating, and
 * enrollment writes are upserts keyed on (userId, courseId).
 */
import { readFileSync } from "node:fs";
import { and, eq } from "drizzle-orm";
import { courses, enrollments, users } from "../lib/db/schema";
import { openScriptDb } from "./db";

const DATA_PATH = "/tmp/report_cards.json";

type Row = [string, string | null, number | null, number | null]; // course, letter, pct(0-1), gpa
type SheetData = { sheet: string; rows: Row[] };

// ---------------------------------------------------------------------------
// Name → existing user matching. The workbook has no emails, so students
// are matched by their display name against what the LearnDash import
// already created. Anything not listed here gets a brand-new account.
// ---------------------------------------------------------------------------
// The JSON dict key comes from concatenating the workbook's tab name
// (e.g. "Leonard, Kaitlynn") — a couple of those got mangled/typo'd in
// that process. Corrected display name to use when creating a new user.
const NAME_CORRECTIONS: Record<string, string> = {
  "Kaitlyn Leoanrd": "Kaitlynn Leonard",
};

const KNOWN_USER_BY_NAME: Record<string, string> = {
  "Emilie Leonard": "emilieleonard94@gmail.com",
  "Benjamin Guenther": "rachelguenther@protonmail.com",
  "Noah Guenther": "noahgguenther@gmail.com",
  "Matthew Kennedy": "mk17cb@gmail.com",
  "Kelsey Leonard": "kelseymleonard11@iclould.com", // real typo'd domain, imported verbatim
  "Olivia Leonard": "olivialeonard2009@gmail.com",
  "Harmony Summers": "summersharms@gmail.com",
  "Isaac Summers": "isaacsummers5300@gmail.com",
  "Alaina Whitaker": "alainawhitaker6@gmail.com",
  "Payton Whitaker": "pjwhitaker9@icloud.com",
  "Moriah Summers": "summersmoriah@gmail.com",
  "Rebekah Summers": "summersbecca2@gmail.com",
};

// ---------------------------------------------------------------------------
// Course-label normalization. The workbook has a handful of typos and
// slot-number inconsistencies (a student's actual Practical Skills course
// sometimes differs from the "usual" pairing for that term slot) — this
// maps every label seen in the sheets to a canonical course title.
// ---------------------------------------------------------------------------
const COURSE_ALIASES: Record<string, string> = {
  "Baptist Distictives 121": "Baptist Distinctives 121",
  "Baptist Distictives 321": "Baptist Distinctives 121",
  "Basic Life Support/First Aid 122": "First Aid",
  "Basic Life Support/First Aid 322": "First Aid",
  "Basic Life Support/First": "First Aid",
  "Basic Construction 203": "Basic Construction",
  "Church Media 102": "Church Media",
  "Church/Christian Finance": "Church and Christian Finance",
  "Church Finance 302/Home Management 303": "Church and Christian Finance",
  "Childrens Ministry 302": "Children and Teen Ministry",
  "Children/Youth Ministry 302": "Children and Teen Ministry",
  "Children's Ministries 312": "Children and Teen Ministry",
  "General Epistles 111": "The General Epistles 111",
  "Sermon and Lesson Prep 202": "Lesson and Sermon Preparation 202",
  "The Essential Doctrines of God 211": "Essential Doctrines of God 211",
  "Church History 221": "Church History 221 & 301",
  "The Doctrines of Christ 321": "Doctrines of Christ 321",
  "Introductory Greek ": "Introductory Greek",
};

// New Practical Skills courses the workbook references that don't exist
// on the site yet.
const NEW_PSC_COURSES = new Set([
  "Home Electrical 112",
  "Auto Mechanics 222",
  "Church Music 312",
  "Church Ministration 322",
]);

function canonicalCourseLabel(raw: string): string {
  const trimmed = raw.trim();
  return COURSE_ALIASES[trimmed] ?? trimmed;
}

/** "MPA Fall '20" / "MPA  Summer '24" / "MPA 'Winter 25" / "MPA Spring'26" → "Fall 2020" etc, or null for a bare "MPA" with no term. */
function normalizeMpaTerm(raw: string): string | null {
  const m = raw.match(/(Spring|Summer|Fall|Winter)\D*'?(\d{2})/i);
  if (!m) return null;
  const season = m[1][0].toUpperCase() + m[1].slice(1).toLowerCase();
  const year = 2000 + Number(m[2]);
  return `${season} ${year}`;
}

function slugify(s: string): string {
  return (
    s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80) ||
    "item"
  );
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const data = JSON.parse(readFileSync(DATA_PATH, "utf8")) as Record<string, SheetData>;
  const db = await openScriptDb();

  // ---- Load current state ----
  const allUsers = await db.query.users.findMany();
  const allCourses = await db.query.courses.findMany();
  const userIdByEmail = new Map(allUsers.map((u) => [u.email.toLowerCase(), u.id]));
  const courseIdByTitle = new Map(allCourses.map((c) => [c.title.trim().toLowerCase(), c.id]));
  const mpaCourseIdByTerm = new Map<string, number>();
  for (const c of allCourses) {
    if (c.track === "ministry-participation") {
      const m = c.title.match(/^Ministry Participation — (.+)$/);
      if (m) mpaCourseIdByTerm.set(m[1], c.id);
    }
  }

  let newUsers = 0;
  let newCourses = 0;
  let bscWrites = 0;
  let pscWrites = 0;
  let mpaWrites = 0;
  let skippedNoGrade = 0;
  let skippedFail = 0;
  let skippedBareMpa = 0;
  const unrecognized = new Set<string>();
  const report: string[] = [];

  for (const [rawStudentName, { rows }] of Object.entries(data)) {
    const studentName = NAME_CORRECTIONS[rawStudentName] ?? rawStudentName;
    // ---- Resolve (or create) the user ----
    let userId: number;
    const knownEmail = KNOWN_USER_BY_NAME[studentName];
    if (knownEmail && userIdByEmail.has(knownEmail.toLowerCase())) {
      userId = userIdByEmail.get(knownEmail.toLowerCase())!;
    } else {
      const placeholderEmail = `${slugify(studentName)}@tfm-archive.local`;
      if (userIdByEmail.has(placeholderEmail)) {
        userId = userIdByEmail.get(placeholderEmail)!;
      } else {
        if (dryRun) {
          userId = -1; // placeholder for reporting only
        } else {
          const [created] = await db
            .insert(users)
            .values({
              name: studentName,
              email: placeholderEmail,
              role: "student",
              active: false, // archival record — no login, matches old/graduated status
            })
            .returning();
          userId = created.id;
          userIdByEmail.set(placeholderEmail, userId);
        }
        newUsers++;
      }
    }

    let studentBsc = 0,
      studentPsc = 0,
      studentMpa = 0;

    for (const [rawCourse, letter, pct] of rows) {
      const isMpa = rawCourse.toUpperCase().startsWith("MPA");

      if (isMpa) {
        const term = normalizeMpaTerm(rawCourse);
        if (!term) {
          skippedBareMpa++;
          continue;
        }
        if (letter !== "Pass") {
          if (letter === "Fail") skippedFail++;
          else skippedNoGrade++;
          continue;
        }
        let courseId = mpaCourseIdByTerm.get(term);
        if (!courseId) {
          const title = `Ministry Participation — ${term}`;
          if (dryRun) {
            courseId = -1;
          } else {
            let slug = slugify(title);
            while (await db.query.courses.findFirst({ where: eq(courses.slug, slug) })) {
              slug = `${slug}-${Math.random().toString(36).slice(2, 6)}`;
            }
            const [created] = await db
              .insert(courses)
              .values({
                slug,
                title,
                track: "ministry-participation",
                published: true,
                description:
                  "Hands-on service this term in one of the ministry's areas of need — audio, video, financial counting, teaching, class helper, greeter, nursery, or maintenance.",
              })
              .returning();
            courseId = created.id;
          }
          mpaCourseIdByTerm.set(term, courseId);
          newCourses++;
        }
        if (userId > 0 && courseId > 0 && !dryRun) {
          await db
            .insert(enrollments)
            .values({ userId, courseId, completedAt: new Date() })
            .onConflictDoUpdate({
              target: [enrollments.userId, enrollments.courseId],
              set: { completedAt: new Date() },
            });
        }
        mpaWrites++;
        studentMpa++;
        continue;
      }

      // Non-MPA: a Biblical Studies or Practical Skills course.
      const canonical = canonicalCourseLabel(rawCourse);
      let courseId = courseIdByTitle.get(canonical.toLowerCase());
      if (!courseId) {
        if (NEW_PSC_COURSES.has(canonical)) {
          if (dryRun) {
            courseId = -1;
          } else {
            let slug = slugify(canonical);
            while (await db.query.courses.findFirst({ where: eq(courses.slug, slug) })) {
              slug = `${slug}-${Math.random().toString(36).slice(2, 6)}`;
            }
            const [created] = await db
              .insert(courses)
              .values({
                slug,
                title: canonical,
                track: "practical-skills",
                published: true,
                description: "",
              })
              .returning();
            courseId = created.id;
          }
          courseIdByTitle.set(canonical.toLowerCase(), courseId);
          newCourses++;
        } else {
          unrecognized.add(rawCourse);
          continue;
        }
      }

      const course = allCourses.find((c) => c.id === courseId);
      const track = course?.track ?? (NEW_PSC_COURSES.has(canonical) ? "practical-skills" : "biblical-studies");

      if (track === "biblical-studies") {
        if (letter === null || pct === null) {
          skippedNoGrade++;
          continue; // not taken yet
        }
        const overridePct = Math.round(pct * 100);
        if (userId > 0 && courseId > 0 && !dryRun) {
          await db
            .insert(enrollments)
            .values({ userId, courseId, overridePct, completedAt: new Date() })
            .onConflictDoUpdate({
              target: [enrollments.userId, enrollments.courseId],
              set: { overridePct, completedAt: new Date() },
            });
        }
        bscWrites++;
        studentBsc++;
      } else {
        // Practical Skills: Complete / Incomplete / blank.
        if (letter !== "Complete") {
          skippedNoGrade++;
          continue;
        }
        if (userId > 0 && courseId > 0 && !dryRun) {
          await db
            .insert(enrollments)
            .values({ userId, courseId, completedAt: new Date() })
            .onConflictDoUpdate({
              target: [enrollments.userId, enrollments.courseId],
              set: { completedAt: new Date() },
            });
        }
        pscWrites++;
        studentPsc++;
      }
    }
    report.push(`${studentName}: ${studentBsc} BSC grades, ${studentPsc} PSC completions, ${studentMpa} MPA terms`);
  }

  console.log(`\n${dryRun ? "DRY RUN — " : ""}Report card import`);
  for (const line of report) console.log("  • " + line);
  console.log(`\nTotals:`);
  console.log(`  new users created:        ${newUsers}`);
  console.log(`  new courses created:      ${newCourses}`);
  console.log(`  BSC grade writes:         ${bscWrites}`);
  console.log(`  PSC completion writes:    ${pscWrites}`);
  console.log(`  MPA term writes:          ${mpaWrites}`);
  console.log(`  skipped (no grade/incomplete): ${skippedNoGrade}`);
  console.log(`  skipped (Fail):            ${skippedFail}`);
  console.log(`  skipped (bare "MPA", no term): ${skippedBareMpa}`);
  if (unrecognized.size > 0) {
    console.log(`\n  ⚠ UNRECOGNIZED course labels (skipped entirely):`);
    for (const u of unrecognized) console.log("     - " + JSON.stringify(u));
  }
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
