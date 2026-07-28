// Colored pill for a submission's place in the grading pipeline.
const styles: Record<string, { label: string; className: string }> = {
  submitted: {
    label: "Waiting for grade",
    className: "bg-amber-100 text-amber-800",
  },
  approved: { label: "Approved", className: "bg-green-100 text-green-800" },
  returned: { label: "Returned", className: "bg-red-100 text-red-700" },
  notsubmitted: { label: "Not submitted", className: "bg-slate-100 text-slate-600" },
};

export default function StatusBadge({ status }: { status: string }) {
  const s = styles[status] ?? styles.notsubmitted;
  return (
    <span
      className={`inline-block whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ${s.className}`}
    >
      {s.label}
    </span>
  );
}
