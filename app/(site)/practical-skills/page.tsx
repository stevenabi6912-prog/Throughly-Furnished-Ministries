import type { Metadata } from "next";
import TrackPage from "@/components/TrackPage";

export const metadata: Metadata = {
  title: "Practical Skills",
  description:
    "TFM's Practical Skills program: first aid, construction, and the everyday skills of an effective missionary.",
};

export default function PracticalSkillsPage() {
  return (
    <TrackPage track="practical-skills" heroImage="/images/hero-woodwork.jpg">
      <p>
        A missionary&rsquo;s day rarely looks like a classroom. Buildings need
        repairing, wounds need dressing, and problems need solving with the
        materials at hand. The Practical Skills program teaches the everyday
        abilities that make a missionary <em>useful</em> — including{" "}
        <strong>first aid</strong> and <strong>basic construction</strong>.
      </p>
      <p>
        Training is hands-on: students practice the skills, document their
        work, and submit it for review. The goal is a servant who can step
        into a work project or an emergency and know what to do.
      </p>
    </TrackPage>
  );
}
