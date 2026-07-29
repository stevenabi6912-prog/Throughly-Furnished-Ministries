import type { Metadata } from "next";
import { requireUser } from "@/lib/auth/session";
import { getGradebook } from "@/lib/data";
import PageHero from "@/components/PageHero";
import ReportCard from "@/components/ReportCard";

export const metadata: Metadata = { title: "Report Card" };

export default async function GradesPage() {
  const user = await requireUser();
  const gradebook = await getGradebook(user.id);

  return (
    <>
      <PageHero
        eyebrow="Your Record"
        title="Report Card"
        intro="Every course you've taken — letter grades and GPA for Biblical Studies, completion for Practical Skills, and your Ministry Participation record. Click a course to see the work behind the grade."
      />
      <section className="bg-slate-50 px-4 py-12 sm:py-16">
        <div className="mx-auto max-w-3xl">
          <ReportCard
            studentName={user.name}
            gradebook={gradebook}
            linkAssignments
          />
        </div>
      </section>
    </>
  );
}
