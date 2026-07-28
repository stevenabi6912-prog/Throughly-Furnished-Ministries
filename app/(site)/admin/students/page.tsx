import type { Metadata } from "next";
import { asc, sql } from "drizzle-orm";
import { enrollments, getDb, submissions, users } from "@/lib/db";
import PageHero from "@/components/PageHero";
import StudentsTable, {
  type StudentRow,
} from "@/components/admin/StudentsTable";

export const metadata: Metadata = { title: "Admin · Students" };

export default async function AdminStudentsPage() {
  const db = await getDb();
  const [all, enrollCounts, subCounts] = await Promise.all([
    db.query.users.findMany({ orderBy: [asc(users.name)] }),
    db
      .select({
        userId: enrollments.userId,
        n: sql<number>`count(*)::int`,
      })
      .from(enrollments)
      .groupBy(enrollments.userId),
    db
      .select({
        userId: submissions.userId,
        n: sql<number>`count(*)::int`,
      })
      .from(submissions)
      .groupBy(submissions.userId),
  ]);
  const enrollByUser = new Map(enrollCounts.map((r) => [r.userId, r.n]));
  const subsByUser = new Map(subCounts.map((r) => [r.userId, r.n]));

  const rows: StudentRow[] = all.map((u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    active: u.active,
    enrollmentCount: enrollByUser.get(u.id) ?? 0,
    submissionCount: subsByUser.get(u.id) ?? 0,
  }));

  return (
    <>
      <PageHero
        eyebrow="Admin"
        title="Students"
        intro="Search, then select students to archive (they can no longer log in, but their records are kept) or delete permanently. The “No activity” filter finds accounts that never enrolled or submitted anything."
      />
      <section className="bg-slate-50 px-4 py-12">
        <div className="mx-auto max-w-5xl">
          <StudentsTable rows={rows} />
        </div>
      </section>
    </>
  );
}
