import type { Metadata } from "next";
import { requireUser } from "@/lib/auth/session";
import { submitBugReport } from "@/lib/actions/bugs";
import PageHero from "@/components/PageHero";

export const metadata: Metadata = { title: "Report a Bug" };

export default async function ReportBugPage({
  searchParams,
}: {
  searchParams: Promise<{ sent?: string }>;
}) {
  await requireUser();
  const { sent } = await searchParams;

  return (
    <>
      <PageHero
        eyebrow="Found Something Off?"
        title="Report a Bug"
        intro="Tell us what happened — the more detail, the faster we can fix it."
      />
      <section className="bg-slate-50 px-4 py-12 sm:py-16">
        <div className="mx-auto max-w-xl">
          {sent && (
            <p className="mb-6 rounded-xl bg-green-50 p-4 text-sm font-medium text-green-800">
              Thanks — this has been sent to the site admin.
            </p>
          )}
          <form action={submitBugReport} className="rounded-2xl bg-white p-6 shadow-sm">
            <label className="block text-sm font-medium text-slate-700">
              What went wrong?
              <textarea
                name="description"
                required
                rows={6}
                placeholder="e.g. When I tried to turn in my homework on the Romans lesson, the page just showed a blank screen."
                className="mt-2 block w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 shadow-sm focus:border-brand-500"
              />
            </label>
            <input type="hidden" name="pageUrl" id="bug-page-url" />
            <button
              type="submit"
              className="mt-4 rounded-lg bg-brand-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-600"
            >
              Send Report
            </button>
          </form>
        </div>
      </section>
      {/* Best-effort context: which page they came from, filled in client-side. */}
      <script
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{
          __html: `document.getElementById('bug-page-url').value = document.referrer || '';`,
        }}
      />
    </>
  );
}
