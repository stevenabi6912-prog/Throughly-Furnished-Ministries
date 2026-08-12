import Link from "next/link";
import type { Assignment, Course, EnrollmentScore, Submission } from "@/lib/db/schema";
import { buildReportCard, rowGradeLabel, type ReportRow } from "@/lib/grades";
import StatusBadge from "@/components/StatusBadge";

type GradebookEntry = {
  course: Course;
  completedAt: Date | null;
  rows: { assignment: Assignment; submission: Submission | null }[];
  archivedScores?: EnrollmentScore[];
  earned: number;
  possible: number;
};

const TRACK_SECTIONS: {
  track: string;
  title: string;
  creditLabel: string;
  columns: string;
}[] = [
  {
    track: "biblical-studies",
    title: "Biblical Studies",
    creditLabel: "BSC Credits",
    columns: "graded",
  },
  {
    track: "practical-skills",
    title: "Practical Skills",
    creditLabel: "PSC Credits",
    columns: "status",
  },
  {
    track: "ministry-participation",
    title: "Ministry Participation",
    creditLabel: "MPA Credits",
    columns: "status",
  },
];

/**
 * The TFM report card, matching the paper one: Biblical Studies courses
 * carry letter grades and GPA, Practical Skills are Complete/Incomplete,
 * Ministry Participation terms are Pass — 2 credits each, GPA over the
 * Biblical Studies courses. `linkAssignments` shows expandable assignment
 * detail (used on the student's own page, not the printable admin view).
 */
export default function ReportCard({
  studentName,
  gradebook,
  linkAssignments = false,
}: {
  studentName: string;
  gradebook: GradebookEntry[];
  linkAssignments?: boolean;
}) {
  const card = buildReportCard(gradebook);
  const rowsByCourseId = new Map(gradebook.map((g) => [g.course.id, g]));

  return (
    <div className="overflow-hidden rounded-2xl bg-white shadow-sm">
      {/* Header, like the top-left block of the spreadsheet */}
      <div className="bg-slate-900 px-6 py-6 text-white">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-400">
              Throughly Furnished Ministries · Report Card
            </p>
            <h2 className="mt-1 text-2xl">{studentName}</h2>
          </div>
          <div className="flex gap-6 text-center">
            <div>
              <p className="font-display text-3xl text-brand-400">
                {card.gpa !== null ? card.gpa.toFixed(2) : "—"}
              </p>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Overall BSC GPA
              </p>
            </div>
            <div>
              <p className="font-display text-3xl text-white">{card.totalCredits}</p>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Total Credits
              </p>
            </div>
          </div>
        </div>
        <dl className="mt-4 flex flex-wrap gap-x-8 gap-y-1 text-sm">
          {TRACK_SECTIONS.map((s) => (
            <div key={s.track} className="flex gap-2">
              <dt className="text-slate-400">{s.creditLabel}:</dt>
              <dd className="font-semibold text-white">
                {card.creditsByTrack[s.track] ?? 0}
              </dd>
            </div>
          ))}
        </dl>
      </div>

      {/* One section per program, like the course table on the sheet */}
      {TRACK_SECTIONS.map((section) => {
        const rows = card.rows.filter((r) => r.course.track === section.track);
        if (rows.length === 0) return null;
        return (
          <div key={section.track} className="border-t border-slate-100">
            <h3 className="bg-slate-50 px-6 py-2.5 text-xs font-semibold uppercase tracking-wider text-slate-500">
              {section.title}
            </h3>
            <table className="w-full text-left text-sm">
              <thead className="sr-only">
                <tr>
                  <th>Course</th>
                  <th>Grade</th>
                  {section.columns === "graded" && <th>Grade points</th>}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <ReportRowView
                    key={row.course.id}
                    row={row}
                    graded={section.columns === "graded"}
                    detail={linkAssignments ? rowsByCourseId.get(row.course.id) : undefined}
                  />
                ))}
              </tbody>
            </table>
          </div>
        );
      })}
      {card.rows.length === 0 && (
        <p className="px-6 py-8 text-center text-sm text-slate-600">
          Coursework will appear here as it&rsquo;s completed.
        </p>
      )}
    </div>
  );
}

function ReportRowView({
  row,
  graded,
  detail,
}: {
  row: ReportRow;
  graded: boolean;
  detail?: GradebookEntry;
}) {
  const label = rowGradeLabel(row);
  const hasLiveDetail = detail && detail.rows.length > 0;
  const hasArchivedDetail = detail && !hasLiveDetail && (detail.archivedScores?.length ?? 0) > 0;
  return (
    <>
      <tr className="border-t border-slate-100">
        <td className="px-6 py-3 font-semibold text-slate-900">
          {hasLiveDetail ? (
            <details>
              <summary className="cursor-pointer">{row.course.title}</summary>
              <ul className="mt-2 space-y-1 pl-4 font-normal">
                {detail.rows.map(({ assignment, submission }) => (
                  <li
                    key={assignment.id}
                    className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600"
                  >
                    <Link
                      href={`/assignments/${assignment.id}`}
                      className="hover:text-brand-700 hover:underline"
                    >
                      {assignment.title}
                    </Link>
                    <span className="flex items-center gap-2">
                      {submission?.status === "approved" &&
                        submission.score !== null && (
                          <span className="font-semibold text-slate-800">
                            {submission.score}/{assignment.points}
                          </span>
                        )}
                      <StatusBadge status={submission?.status ?? "notsubmitted"} />
                    </span>
                  </li>
                ))}
              </ul>
            </details>
          ) : hasArchivedDetail ? (
            <details>
              <summary className="cursor-pointer">{row.course.title}</summary>
              <ul className="mt-2 space-y-1 pl-4 font-normal">
                {detail!.archivedScores!.map((score) => (
                  <li
                    key={score.id}
                    className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600"
                  >
                    <span>{score.label}</span>
                    <span className="font-semibold text-slate-800">{score.score}</span>
                  </li>
                ))}
              </ul>
            </details>
          ) : (
            row.course.title
          )}
        </td>
        <td className="whitespace-nowrap px-4 py-3 text-right font-semibold text-slate-900">
          {label}
        </td>
        {graded && (
          <td className="w-24 whitespace-nowrap px-6 py-3 text-right text-slate-600">
            {row.points !== null ? row.points.toFixed(2) : "—"}
          </td>
        )}
      </tr>
    </>
  );
}
