"use client";

import { useFormStatus } from "react-dom";

// Submit button that disables itself while the server action runs.
export default function SubmitButton({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className={
        className ??
        "rounded-lg bg-brand-500 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-600 disabled:cursor-wait disabled:opacity-60"
      }
    >
      {pending ? "Working…" : children}
    </button>
  );
}
