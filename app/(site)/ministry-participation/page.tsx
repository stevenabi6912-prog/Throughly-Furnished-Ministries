import type { Metadata } from "next";
import TrackPage from "@/components/TrackPage";

export const metadata: Metadata = {
  title: "Ministry Participation",
  description:
    "TFM's Ministry Participation program: hands-on service in the ministries of Faith Baptist Church, alongside teachers.",
};

const AREAS_OF_SERVICE = [
  "Audio",
  "Video",
  "Financial Counting",
  "Teaching",
  "Class Helper",
  "Greeter",
  "Nursery",
  "Maintenance",
];

export default function MinistryParticipationPage() {
  return (
    <TrackPage
      track="ministry-participation"
      heroImage="/images/hero-evangelism.jpg"
      areasOfService={AREAS_OF_SERVICE}
    >
      <p>
        Knowledge without practice doesn&rsquo;t make a minister. Every TFM
        student serves actively in the ministries of Faith Baptist Church —
        putting classroom truth to work in real ministry, under the eye of
        teachers who have done it themselves.
      </p>
      <p>
        Participation is tracked term by term: each term a student serves —
        in audio, video, financial counting, teaching, as a class helper,
        greeter, in the nursery, or in maintenance — is recorded as Pass on
        their report card.
      </p>
    </TrackPage>
  );
}
