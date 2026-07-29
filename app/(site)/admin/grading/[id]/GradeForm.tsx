"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { gradeSubmission } from "@/lib/actions/admin";

function GradeButtons() {
  const { pending } = useFormStatus();
  return (
    <div className="grid gap-2">
      <button
        type="submit"
        name="status"
        value="approved"
        disabled={pending}
        className="w-full rounded-lg bg-green-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-green-700 disabled:cursor-wait disabled:opacity-60"
      >
        {pending ? "Working…" : "✓ Approve with Score"}
      </button>
      <button
        type="submit"
        name="status"
        value="returned"
        disabled={pending}
        className="w-full rounded-lg border border-amber-500 px-5 py-2.5 text-sm font-semibold text-amber-700 transition-colors hover:bg-amber-50 disabled:cursor-wait disabled:opacity-60"
      >
        ↩ Return for Revision
      </button>
    </div>
  );
}

export default function GradeForm({
  submissionId,
  maxPoints,
  lateWeeks = 0,
}: {
  submissionId: number;
  maxPoints: number;
  lateWeeks?: number;
}) {
  const [state, action] = useActionState(gradeSubmission, undefined);
  const penalty = Math.round(maxPoints * 0.1 * lateWeeks);
  return (
    <form action={action} className="mt-4 space-y-4">
      <input type="hidden" name="id" value={submissionId} />
      {lateWeeks > 0 && (
        <div className="rounded-lg bg-red-50 p-3">
          <p className="text-sm font-semibold text-red-700">
            Turned in {lateWeeks} week{lateWeeks === 1 ? "" : "s"} late
          </p>
          <label className="mt-2 flex items-center gap-2 text-sm text-red-800">
            <input
              type="checkbox"
              name="applyLatePenalty"
              defaultChecked
              className="h-4 w-4 rounded border-red-300"
            />
            Apply the late penalty (−{penalty} points — 10% per week)
          </label>
        </div>
      )}
      <label className="block text-sm font-medium text-slate-700">
        Score
        <input
          name="score"
          type="number"
          min={0}
          max={maxPoints}
          className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 shadow-sm focus:border-brand-500"
        />
      </label>
      <label className="block text-sm font-medium text-slate-700">
        Feedback for the student
        <textarea
          name="feedback"
          rows={5}
          className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 shadow-sm focus:border-brand-500"
          placeholder="What was done well, what to work on…"
        />
      </label>
      {state?.error && (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.error}
        </p>
      )}
      <GradeButtons />
    </form>
  );
}
