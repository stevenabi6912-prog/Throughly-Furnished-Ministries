import type { Metadata } from "next";
import { desc, eq } from "drizzle-orm";
import { bugReports, getDb, users } from "@/lib/db";
import { setBugResolved } from "@/lib/actions/bugs";
import { formatEastern } from "@/lib/time";
import PageHero from "@/components/PageHero";

export const metadata: Metadata = { title: "Admin · Bug Reports" };

export default async function AdminBugsPage() {
  const db = await getDb();
  const reports = await db
    .select({ report: bugReports, reporter: users })
    .from(bugReports)
    .innerJoin(users, eq(bugReports.userId, users.id))
    .orderBy(desc(bugReports.createdAt));

  const open = reports.filter((r) => !r.report.resolved);
  const resolved = reports.filter((r) => r.report.resolved);

  return (
    <>
      <PageHero
        eyebrow="Admin"
        title="Bug Reports"
        intro={
          open.length > 0
            ? `${open.length} open report${open.length === 1 ? "" : "s"}.`
            : "Nothing open right now."
        }
      />
      <section className="bg-slate-50 px-4 py-12">
        <div className="mx-auto max-w-3xl space-y-8">
          {reports.length === 0 && (
            <p className="text-slate-600">No bug reports yet.</p>
          )}

          {open.length > 0 && (
            <div>
              <h2 className="text-xl font-bold text-slate-900">Open</h2>
              <ul className="mt-4 space-y-3">
                {open.map(({ report, reporter }) => (
                  <BugRow key={report.id} report={report} reporter={reporter} />
                ))}
              </ul>
            </div>
          )}

          {resolved.length > 0 && (
            <div>
              <h2 className="text-xl font-bold text-slate-900">Resolved</h2>
              <ul className="mt-4 space-y-3">
                {resolved.map(({ report, reporter }) => (
                  <BugRow key={report.id} report={report} reporter={reporter} />
                ))}
              </ul>
            </div>
          )}
        </div>
      </section>
    </>
  );
}

function BugRow({
  report,
  reporter,
}: {
  report: typeof bugReports.$inferSelect;
  reporter: typeof users.$inferSelect;
}) {
  return (
    <li className="rounded-2xl bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-900">
            {reporter.name} <span className="font-normal text-slate-500">· {formatEastern(report.createdAt)}</span>
          </p>
          {report.pageUrl && (
            <p className="mt-0.5 truncate text-xs text-slate-500">{report.pageUrl}</p>
          )}
        </div>
        <form action={setBugResolved}>
          <input type="hidden" name="id" value={report.id} />
          <input type="hidden" name="resolved" value={report.resolved ? "0" : "1"} />
          <button
            type="submit"
            className={`rounded-lg border px-3 py-1.5 text-xs font-semibold ${
              report.resolved
                ? "border-slate-300 text-slate-600 hover:bg-slate-50"
                : "border-green-500 text-green-700 hover:bg-green-50"
            }`}
          >
            {report.resolved ? "Reopen" : "Mark Resolved"}
          </button>
        </form>
      </div>
      <p className="mt-3 whitespace-pre-wrap text-sm text-slate-700">{report.description}</p>
    </li>
  );
}
