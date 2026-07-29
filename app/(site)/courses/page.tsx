import { redirect } from "next/navigation";

// TFM runs one course at a time — the dashboard IS the course view, so
// the old catalog just forwards there.
export default function CoursesIndexPage() {
  redirect("/dashboard");
}
