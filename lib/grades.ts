// TFM's grading system, matching the "New Report Cards" spreadsheet:
//
//   Biblical Studies courses      → letter grade + percent + grade points
//   Practical Skills courses      → Complete / Incomplete
//   Ministry Participation        → Pass (per term)
//   Every completed course/term   → 2 credits, totaled per track
//   Overall GPA                   → average grade points across graded
//                                   Biblical Studies courses only
//
// Grade points use the "thirds" scale from the spreadsheet (A- = 3.67).

import type { Course } from "@/lib/db/schema";

export const CREDITS_PER_COURSE = 2;

const SCALE: [number, string, number][] = [
  [93, "A", 4.0],
  [90, "A-", 3.67],
  [87, "B+", 3.33],
  [83, "B", 3.0],
  [80, "B-", 2.67],
  [77, "C+", 2.33],
  [73, "C", 2.0],
  [70, "C-", 1.67],
  [67, "D+", 1.33],
  [63, "D", 1.0],
  [60, "D-", 0.67],
];

export function letterGrade(pct: number): string {
  for (const [min, letter] of SCALE) if (pct >= min) return letter;
  return "F";
}

export function gradePoints(pct: number): number {
  for (const [min, , points] of SCALE) if (pct >= min) return points;
  return 0;
}

export type ReportRow = {
  course: Course;
  /** "graded" = letter+percent+GPA; "completion" = Complete/Incomplete;
   *  "pass" = Pass/In progress (ministry participation). */
  kind: "graded" | "completion" | "pass";
  completed: boolean;
  pct: number | null;
  letter: string | null;
  points: number | null;
  credits: number;
};

export type ReportCard = {
  rows: ReportRow[];
  creditsByTrack: Record<string, number>;
  totalCredits: number;
  /** Average grade points across graded Biblical Studies courses. */
  gpa: number | null;
};

export function buildReportCard(
  gradebook: {
    course: Course;
    completedAt: Date | null;
    earned: number;
    possible: number;
  }[]
): ReportCard {
  const rows: ReportRow[] = gradebook.map(
    ({ course, completedAt, earned, possible }) => {
      if (course.track === "biblical-studies") {
        const hasGrade = possible > 0;
        const pct = hasGrade ? (earned / possible) * 100 : null;
        return {
          course,
          kind: "graded" as const,
          completed: Boolean(completedAt) || hasGrade,
          pct,
          letter: pct !== null ? letterGrade(pct) : null,
          points: pct !== null ? gradePoints(pct) : null,
          credits: completedAt || hasGrade ? CREDITS_PER_COURSE : 0,
        };
      }
      const kind =
        course.track === "ministry-participation" ? ("pass" as const) : ("completion" as const);
      return {
        course,
        kind,
        completed: Boolean(completedAt),
        pct: null,
        letter: null,
        points: null,
        credits: completedAt ? CREDITS_PER_COURSE : 0,
      };
    }
  );

  const creditsByTrack: Record<string, number> = {
    "biblical-studies": 0,
    "practical-skills": 0,
    "ministry-participation": 0,
  };
  for (const row of rows) {
    creditsByTrack[row.course.track] += row.credits;
  }

  const gradedPoints = rows
    .filter((r) => r.kind === "graded" && r.points !== null)
    .map((r) => r.points!);
  const gpa =
    gradedPoints.length > 0
      ? Math.round(
          (gradedPoints.reduce((a, b) => a + b, 0) / gradedPoints.length) * 100
        ) / 100
      : null;

  return {
    rows,
    creditsByTrack,
    totalCredits: rows.reduce((sum, r) => sum + r.credits, 0),
    gpa,
  };
}

/** How a row reads on the report card ("A- · 92%", "Complete", "Pass"). */
export function rowGradeLabel(row: ReportRow): string {
  if (row.kind === "graded") {
    if (row.pct === null) return row.completed ? "Complete" : "In progress";
    return `${row.letter} · ${Math.round(row.pct)}%`;
  }
  if (row.kind === "pass") return row.completed ? "Pass" : "In progress";
  return row.completed ? "Complete" : "Incomplete";
}
