import type { Metadata } from "next";
import TrackPage from "@/components/TrackPage";

export const metadata: Metadata = {
  title: "Biblical Studies",
  description:
    "TFM's Biblical Studies program: biblical doctrine, biblical principles, and biblical church practice for future missionaries and Christian servants.",
};

export default function BiblicalStudiesPage() {
  return (
    <TrackPage track="biblical-studies" heroImage="/images/hero-teaching.jpg">
      <p>
        Everything a missionary builds stands on the foundation of the Word of
        God. The Biblical Studies program grounds each student in{" "}
        <strong>biblical doctrine</strong>, <strong>biblical principles</strong>,
        and <strong>biblical church practice</strong> — the truths they will
        teach, defend, and live out on the field.
      </p>
      <p>
        Courses move verse by verse and doctrine by doctrine, with written
        assignments that push students to study for themselves rather than
        repeat what they&rsquo;ve heard. Teachers read and respond to every
        assignment personally.
      </p>
    </TrackPage>
  );
}
