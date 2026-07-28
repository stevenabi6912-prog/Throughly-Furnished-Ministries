import type { Metadata } from "next";
import PageHero from "@/components/PageHero";
import site from "@/content/site.json";

export const metadata: Metadata = { title: "Privacy Policy" };

export default function PrivacyPage() {
  return (
    <>
      <PageHero title="Privacy Policy" />
      <section className="bg-white px-4 py-14">
        <div className="prose prose-slate mx-auto max-w-3xl prose-a:text-brand-700">
          <p>
            {site.name} (&ldquo;TFM&rdquo;) collects only the information
            needed to run its training program: your name, email address, and
            the coursework you submit through this site.
          </p>
          <h2>What we collect and why</h2>
          <ul>
            <li>
              <strong>Account details</strong> (name, email, password) — to
              sign you in and identify your coursework. Passwords are stored
              only as secure one-way hashes.
            </li>
            <li>
              <strong>Coursework</strong> (assignment submissions, grades,
              lesson progress) — so mentors can review your work and track
              your training.
            </li>
          </ul>
          <h2>What we don&rsquo;t do</h2>
          <ul>
            <li>We do not sell or share your information with anyone.</li>
            <li>We do not use advertising or tracking cookies — the only cookie is the one that keeps you signed in.</li>
          </ul>
          <h2>Your coursework and grades</h2>
          <p>
            Submissions and grades are visible to you and to TFM mentors and
            administrators. They are kept as a record of your training.
          </p>
          <h2>Questions or removal</h2>
          <p>
            To ask a question about your data, or to have your account and its
            data removed, contact the leadership of{" "}
            <a href={site.church.url}>{site.church.name}</a>.
          </p>
        </div>
      </section>
    </>
  );
}
