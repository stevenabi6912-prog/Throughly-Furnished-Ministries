import type { Metadata } from "next";
import TrackPage from "@/components/TrackPage";

export const metadata: Metadata = {
  title: "Ministry Participation",
  description:
    "TFM's Ministry Participation program: hands-on service in the ministries of Faith Baptist Church, alongside mentors.",
};

export default function MinistryParticipationPage() {
  return (
    <TrackPage track="ministry-participation" heroImage="/images/hero-evangelism.jpg">
      <p>
        Knowledge without practice doesn&rsquo;t make a minister. Every TFM
        student serves actively in the ministries of Faith Baptist Church —
        teaching, music, outreach, children&rsquo;s work, and more — putting
        classroom truth to work in real ministry, under the eye of mentors who
        have done it themselves.
      </p>
      <p>
        Participation is tracked like any other course: students record their
        ministry involvement, reflect on it in written assignments, and receive
        feedback and encouragement from their mentors.
      </p>
    </TrackPage>
  );
}
