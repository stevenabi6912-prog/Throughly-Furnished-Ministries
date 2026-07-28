import Link from "next/link";
import { requireAdmin } from "@/lib/auth/session";

const adminLinks = [
  { label: "Overview", href: "/admin" },
  { label: "Courses", href: "/admin/courses" },
  { label: "Grading", href: "/admin/grading" },
  { label: "Students", href: "/admin/students" },
];

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireAdmin();
  return (
    <>
      <div className="border-b border-slate-200 bg-white">
        <nav
          aria-label="Admin"
          className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-4 py-2"
        >
          {adminLinks.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="whitespace-nowrap rounded px-3 py-1.5 text-sm font-semibold text-slate-600 hover:bg-slate-100 hover:text-slate-900"
            >
              {l.label}
            </Link>
          ))}
        </nav>
      </div>
      {children}
    </>
  );
}
