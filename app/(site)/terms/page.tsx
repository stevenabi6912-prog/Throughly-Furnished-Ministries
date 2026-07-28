import type { Metadata } from "next";
import PageHero from "@/components/PageHero";
import site from "@/content/site.json";

export const metadata: Metadata = { title: "Terms of Service" };

export default function TermsPage() {
  return (
    <>
      <PageHero title="Terms of Service" />
      <section className="bg-white px-4 py-14">
        <div className="prose prose-slate mx-auto max-w-3xl prose-a:text-brand-700">
          <p>
            This website is operated by {site.name}, a ministry of{" "}
            <a href={site.church.url}>{site.church.name}</a> in{" "}
            {site.church.city}. By creating an account you agree to these
            terms.
          </p>
          <ul>
            <li>
              Accounts are personal. Keep your password private and submit
              only your own work.
            </li>
            <li>
              Course materials on this site belong to TFM and its teachers.
              They are for enrolled students and may not be republished
              without permission.
            </li>
            <li>
              Work you submit remains yours; you give TFM permission to store
              it and review it as part of the training program.
            </li>
            <li>
              TFM may deactivate accounts that misuse the site or its
              materials.
            </li>
            <li>
              This site is provided as-is, without warranty; TFM does its best
              to keep it available and your data safe.
            </li>
          </ul>
        </div>
      </section>
    </>
  );
}
