/**
 * One-shot builder for the Church Epistles 311 trimester (Fall 2026),
 * from the materials in the shared iCloud folder (converted to PDF in the
 * session scratchpad). Uploads worksheets + textbook chapters to Blob,
 * then creates/updates the course's lessons, schedule, and homework.
 *
 *   set -a; source .env.vercel.local; set +a   # to target production
 *   npx tsx scripts/build-ce311.ts
 *
 * Safe to re-run: lessons are upserted by slug, uploads are re-pointed.
 */
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { and, eq } from "drizzle-orm";
import { assignments, courses, lessons, submissions } from "../lib/db/schema";
import { openScriptDb } from "./db";
import { easternToUtc, saturdayDeadlineAfter } from "../lib/time";

const SCRATCH =
  "/private/tmp/claude-501/-Users-stevenwireman-Desktop-TFM-Website/4c654a97-576c-45d1-bf2c-90dfddf081bc/scratchpad";
const WS = `${SCRATCH}/wsgen`;
const TB = `${SCRATCH}/textbook`;

function loadBlobToken(): string {
  if (process.env.BLOB_READ_WRITE_TOKEN) return process.env.BLOB_READ_WRITE_TOKEN;
  const envFile = path.join(process.cwd(), ".env.vercel.local");
  const m = readFileSync(envFile, "utf8").match(/^BLOB_READ_WRITE_TOKEN="?([^"\n]+)"?$/m);
  if (!m) throw new Error("No BLOB_READ_WRITE_TOKEN available");
  return m[1];
}

type LessonPlan = {
  slug: string;
  title: string;
  sortOrder: number;
  /** Eastern wall time the class opens, or null for always-available. */
  opens: string | null;
  worksheetPdf?: string; // file in WS dir
  textbookPdf?: string; // file in TB dir
  textbookLabel?: string;
  memoryVerse?: string;
  extraHtml?: string;
  homeworkPoints?: number; // creates/updates the turn-in assignment
  homeworkTitle?: string;
};

const MV = {
  romans: "Romans 3:28 — “Therefore we conclude that a man is justified by faith without the deeds of the law.”",
  cor1: "1 Corinthians 14:40 — “Let all things be done decently and in order.”",
  cor2: "2 Corinthians 4:5 — “For we preach not ourselves, but Christ Jesus the Lord; and ourselves your servants for Jesus' sake.”",
  gal: "Galatians 3:13 — “Christ hath redeemed us from the curse of the law, being made a curse for us: for it is written, Cursed is every one that hangeth on a tree:”",
  eph: "Ephesians 1:3 — “Blessed be the God and Father of our Lord Jesus Christ, who hath blessed us with all spiritual blessings in heavenly places in Christ:”",
  phil: "Philippians 2:17 — “Yea, and if I be offered upon the sacrifice and service of your faith, I joy, and rejoice with you all.”",
  col: "Colossians 2:9-10 — “For in him dwelleth all the fulness of the Godhead bodily. And ye are complete in him, which is the head of all principality and power:”",
  th1: "1 Thessalonians 1:10 — “And to wait for his Son from heaven, whom he raised from the dead, even Jesus, which delivered us from the wrath to come.”",
  th2: "2 Thessalonians 3:5 — “And the Lord direct your hearts into the love of God, and into the patient waiting for Christ.”",
};

const PLAN: LessonPlan[] = [
  {
    slug: "overview",
    title: "Course Overview & Syllabus",
    sortOrder: 0,
    opens: null,
    textbookPdf: "Introduction_TheChurchEpistles_Final_7x10_4.pdf",
    textbookLabel: "Introduction: The Church Epistles",
    extraHtml: `
<p><strong>Trimester 1 · September – December 2026 · Sundays after the afternoon service</strong></p>
<p>This trimester focuses on the <strong>Church Epistles</strong> — Romans, 1 &amp; 2 Corinthians, Galatians, Ephesians, Philippians, Colossians, and 1 &amp; 2 Thessalonians. These letters were written and delivered first to specific local churches, and they contain the majority of the doctrine, practice, correction, admonition, and exhortation God has given to the New Testament Church. Each lesson gives a cursory examination of one epistle with focused attention on one or two of its major doctrinal themes.</p>
<h2>How your grade works</h2>
<ul>
<li><strong>Student Worksheets — 40%.</strong> One fillable worksheet per lesson, due by the start of class the following Sunday (turn it in here on the website by Saturday midnight). Late worksheets lose 10% per week.</li>
<li><strong>Exams — 25%.</strong> A Midterm (Nov 1) and a Final (Dec 13), covering every lesson and memory verse up to the exam.</li>
<li><strong>Scripture Memory — 10%</strong>, <strong>Personal Devotions — 10%</strong>, <strong>Sermon Notes — 5%</strong>, <strong>Personal Evangelism — 5%</strong>, <strong>Attendance — 5%</strong> — tracked in your printed workbook, which you should bring to every class and service.</li>
</ul>
<h2>Memory verses for the trimester</h2>
<ul>
${Object.values(MV).map((v) => `<li>${v}</li>`).join("\n")}
</ul>
<p><em>Attendance in the Sunday afternoon class is required — recorded video is a help for review, not a replacement. Check this site weekly for assignments and updates.</em></p>`,
  },
  {
    slug: "the-apostle-paul",
    title: "The Apostle Paul",
    sortOrder: 10,
    opens: "2026-09-13T15:00",
    worksheetPdf: "Worksheet_Ch01_TheApostlePaul.pdf",
    textbookPdf: "Chapter1_TheApostlePaul_Final_7x10.pdf",
    textbookLabel: "Chapter 1: The Apostle Paul",
    homeworkPoints: 100,
    extraHtml:
      "<p>Before we open the epistles themselves, we meet the man God chose to write them. Read the chapter, watch the class, and complete the worksheet alongside the Romans lesson this first week.</p>",
  },
  {
    slug: "romans",
    title: "Lesson 1: Romans",
    sortOrder: 20,
    opens: "2026-09-13T15:00",
    worksheetPdf: "Worksheet_Ch02_Romans.pdf",
    textbookPdf: "Chapter2_Romans_Expanded_2.pdf",
    textbookLabel: "Chapter 2: The Epistle to the Romans",
    memoryVerse: MV.romans,
    homeworkPoints: 100,
  },
  {
    slug: "1-corinthians",
    title: "Lesson 2: 1 Corinthians",
    sortOrder: 30,
    opens: "2026-09-20T15:00",
    worksheetPdf: "Worksheet_Ch03_1Corinthians.pdf",
    textbookPdf: "Chapter3_1Corinthians_Expanded-2.pdf",
    textbookLabel: "Chapter 3: 1 Corinthians",
    memoryVerse: MV.cor1,
    homeworkPoints: 100,
  },
  {
    slug: "2-corinthians",
    title: "Lesson 3: 2 Corinthians",
    sortOrder: 40,
    opens: "2026-09-27T15:00",
    worksheetPdf: "Worksheet_Ch04_2Corinthians.pdf",
    textbookPdf: "Correct format Chapter4_2Corinthians_Expanded_2.pdf",
    textbookLabel: "Chapter 4: 2 Corinthians",
    memoryVerse: MV.cor2,
    homeworkPoints: 100,
  },
  {
    slug: "galatians",
    title: "Lesson 4: Galatians",
    sortOrder: 50,
    opens: "2026-10-04T15:00",
    worksheetPdf: "Worksheet_Ch05_Galatians.pdf",
    textbookPdf: "Chapter5_Galatians_Expanded_4.pdf",
    textbookLabel: "Chapter 5: Galatians",
    memoryVerse: MV.gal,
    homeworkPoints: 100,
    extraHtml: "<p><em>No class October 11 — Bible Conference. Lesson 5 opens October 18.</em></p>",
  },
  {
    slug: "ephesians",
    title: "Lesson 5: Ephesians",
    sortOrder: 60,
    opens: "2026-10-18T15:00",
    worksheetPdf: "Worksheet_Ch06_Ephesians.pdf",
    textbookPdf: "Chapter6_Ephesians_Expanded.pdf",
    textbookLabel: "Chapter 6: Ephesians",
    memoryVerse: MV.eph,
    homeworkPoints: 100,
  },
  {
    slug: "philippians",
    title: "Lesson 6: Philippians",
    sortOrder: 70,
    opens: "2026-10-25T15:00",
    worksheetPdf: "Worksheet_Ch07_Philippians.pdf",
    textbookPdf: "Chapter7_Philippians_Expanded_3.pdf",
    textbookLabel: "Chapter 7: Philippians",
    memoryVerse: MV.phil,
    homeworkPoints: 100,
  },
  {
    slug: "midterm-exam",
    title: "Midterm Exam",
    sortOrder: 80,
    opens: "2026-11-01T15:00",
    homeworkPoints: 300,
    homeworkTitle: "Midterm Exam",
    extraHtml:
      "<p>The Midterm is taken <strong>in class on Sunday, November 1</strong>. It covers Lessons 1–6 (The Apostle Paul through Philippians) and every memory verse assigned so far. If your teacher has you turn in or photograph your exam, upload it here.</p>",
  },
  {
    slug: "colossians",
    title: "Lesson 7: Colossians",
    sortOrder: 90,
    opens: "2026-11-08T15:00",
    worksheetPdf: "Worksheet_Ch08_Colossians.pdf",
    textbookPdf: "Chapter8_Colossians_Expanded_1.pdf",
    textbookLabel: "Chapter 8: Colossians",
    memoryVerse: MV.col,
    homeworkPoints: 100,
  },
  {
    slug: "1-thessalonians",
    title: "Lesson 8: 1 Thessalonians",
    sortOrder: 100,
    opens: "2026-11-15T15:00",
    worksheetPdf: "Worksheet_Ch09_1Thessalonians.pdf",
    textbookPdf: "Chapter9_1Thessalonians_Final_7x10_2.pdf",
    textbookLabel: "Chapter 9: 1 Thessalonians",
    memoryVerse: MV.th1,
    homeworkPoints: 100,
    extraHtml:
      "<p><em>No class November 22 (Harvest Sunday) or November 29 (Thanksgiving weekend). Lesson 9 opens December 6.</em></p>",
  },
  {
    slug: "2-thessalonians",
    title: "Lesson 9: 2 Thessalonians",
    sortOrder: 110,
    opens: "2026-12-06T15:00",
    worksheetPdf: "Worksheet_Ch10_2Thessalonians.pdf",
    textbookPdf: "Chapter10_2Thessalonians_Expanded.pdf",
    textbookLabel: "Chapter 10: 2 Thessalonians",
    memoryVerse: MV.th2,
    homeworkPoints: 100,
  },
  {
    slug: "final-exam",
    title: "Final Exam",
    sortOrder: 120,
    opens: "2026-12-13T15:00",
    homeworkPoints: 300,
    homeworkTitle: "Final Exam",
    extraHtml:
      "<p>The Final is taken <strong>in class on Sunday, December 13</strong>. It covers the whole trimester, and every student recites all nine memory verses as part of the exam. If your teacher has you turn in or photograph your exam, upload it here.</p>",
  },
];

async function main() {
  process.env.BLOB_READ_WRITE_TOKEN = loadBlobToken();
  const { put } = await import("@vercel/blob");
  const db = await openScriptDb();

  const course = await db.query.courses.findFirst({
    where: eq(courses.slug, "church-epistles-311"),
  });
  if (!course) throw new Error("Course church-epistles-311 not found");
  console.log(`Course #${course.id}: ${course.title}`);

  // Refresh the course description and publish it.
  await db
    .update(courses)
    .set({
      description:
        "Trimester 1 (September–December 2026). A survey of the nine Church Epistles — Romans through 2 Thessalonians — the letters that carry most of the doctrine, practice, and exhortation God gave the New Testament Church. One epistle per lesson, with a fillable worksheet, a textbook chapter, and a memory verse each week.",
      published: true,
    })
    .where(eq(courses.id, course.id));

  const uploaded = new Map<string, string>();
  async function toBlob(localPath: string, folder: string): Promise<string> {
    const cached = uploaded.get(localPath);
    if (cached) return cached;
    if (!existsSync(localPath)) throw new Error(`Missing file: ${localPath}`);
    const name = `CE311-${path.basename(localPath).replace(/[^a-zA-Z0-9._-]+/g, "_")}`;
    const blob = await put(`${folder}/${name}`, readFileSync(localPath), {
      access: "public",
      addRandomSuffix: true,
    });
    uploaded.set(localPath, blob.url);
    return blob.url;
  }

  const keepSlugs = new Set(PLAN.map((p) => p.slug));
  const report: string[] = [];

  for (const p of PLAN) {
    const worksheetUrl = p.worksheetPdf
      ? await toBlob(path.join(WS, p.worksheetPdf), "content/worksheets")
      : null;
    const textbookUrl = p.textbookPdf
      ? await toBlob(path.join(TB, p.textbookPdf), "content/textbook")
      : null;

    const parts: string[] = [];
    if (p.memoryVerse)
      parts.push(
        `<blockquote><p><strong>Memory verse:</strong> ${p.memoryVerse}</p></blockquote>`
      );
    if (textbookUrl)
      parts.push(
        `<p>📖 <strong>Read before class:</strong> <a href="${textbookUrl}" target="_blank">${p.textbookLabel}</a> (PDF)</p>`
      );
    if (p.worksheetPdf)
      parts.push(
        `<p>Fill in the worksheet below as you read and as we work through the lesson in class, then turn it in — it is due by Saturday midnight before the next class. You can type directly into the PDF, save it, and upload it here.</p>`
      );
    if (p.extraHtml) parts.push(p.extraHtml.trim());
    const contentHtml = parts.join("\n");

    const availableAt = p.opens ? easternToUtc(p.opens) : null;
    const values = {
      title: p.title,
      contentHtml,
      sortOrder: p.sortOrder,
      published: true,
      worksheetUrl,
      videoUrl: null,
      availableAt,
    };

    const existing = await db.query.lessons.findFirst({
      where: and(eq(lessons.courseId, course.id), eq(lessons.slug, p.slug)),
    });
    let lessonId: number;
    if (existing) {
      await db.update(lessons).set(values).where(eq(lessons.id, existing.id));
      lessonId = existing.id;
    } else {
      const [created] = await db
        .insert(lessons)
        .values({ courseId: course.id, slug: p.slug, ...values })
        .returning();
      lessonId = created.id;
    }

    if (p.homeworkPoints) {
      const dueAt = availableAt ? saturdayDeadlineAfter(availableAt) : null;
      const hwTitle = p.homeworkTitle ?? `Homework — ${p.title}`;
      const hw = await db.query.assignments.findFirst({
        where: eq(assignments.lessonId, lessonId),
      });
      const hwValues = {
        courseId: course.id,
        lessonId,
        title: hwTitle,
        instructionsHtml: p.homeworkTitle
          ? "<p>Upload your completed exam here if directed by your teacher.</p>"
          : "<p>Complete the fillable worksheet for this lesson and upload it here. Due Saturday midnight before the next class; 10% off per week late.</p>",
        points: p.homeworkPoints,
        dueAt,
        published: true,
        sortOrder: p.sortOrder,
      };
      if (hw) await db.update(assignments).set(hwValues).where(eq(assignments.id, hw.id));
      else await db.insert(assignments).values(hwValues);
    }
    report.push(
      `${p.title} — opens ${p.opens ?? "always"}${p.homeworkPoints ? `, homework ${p.homeworkPoints} pts` : ""}${worksheetUrl ? ", worksheet ✓" : ""}${textbookUrl ? ", textbook ✓" : ""}`
    );
  }

  // Tidy up: unpublish leftover imported lessons that aren't in the plan,
  // and leftover assignments unless they hold graded history.
  const allLessons = await db.query.lessons.findMany({
    where: eq(lessons.courseId, course.id),
  });
  let hiddenLessons = 0;
  for (const l of allLessons) {
    if (!keepSlugs.has(l.slug) && l.published) {
      await db.update(lessons).set({ published: false }).where(eq(lessons.id, l.id));
      hiddenLessons++;
    }
  }
  const planLessonIds = new Set(
    allLessons.filter((l) => keepSlugs.has(l.slug)).map((l) => l.id)
  );
  const allAssignments = await db.query.assignments.findMany({
    where: eq(assignments.courseId, course.id),
  });
  let hiddenAssignments = 0;
  for (const a of allAssignments) {
    if (a.lessonId && planLessonIds.has(a.lessonId)) continue;
    const hasGrades = await db.query.submissions.findFirst({
      where: eq(submissions.assignmentId, a.id),
    });
    if (!hasGrades && a.published) {
      await db.update(assignments).set({ published: false }).where(eq(assignments.id, a.id));
      hiddenAssignments++;
    }
  }

  console.log("\n===== Church Epistles 311 built =====");
  for (const line of report) console.log("  • " + line);
  console.log(`  • ${uploaded.size} files uploaded to Blob`);
  console.log(`  • ${hiddenLessons} old lessons unpublished, ${hiddenAssignments} old assignments unpublished`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
