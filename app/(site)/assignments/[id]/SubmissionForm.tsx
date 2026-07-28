"use client";

import { useActionState } from "react";
import { submitAssignment } from "@/lib/actions/student";
import SubmitButton from "@/components/SubmitButton";

export default function SubmissionForm({
  assignmentId,
}: {
  assignmentId: number;
}) {
  const [state, action] = useActionState(submitAssignment, undefined);

  return (
    <form action={action} className="mt-4 space-y-4">
      <input type="hidden" name="assignmentId" value={assignmentId} />
      <label className="block text-sm font-medium text-slate-700">
        Written answer
        <textarea
          name="text"
          rows={8}
          className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 shadow-sm focus:border-brand-500"
          placeholder="Type your work here…"
        />
      </label>
      <label className="block text-sm font-medium text-slate-700">
        Attach a file <span className="font-normal text-slate-500">(optional — PDF, Word, photos, audio… up to 25 MB)</span>
        <input
          name="file"
          type="file"
          className="mt-1 block w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-100 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-slate-700 hover:file:bg-slate-200"
        />
      </label>
      {state?.error && (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.error}
        </p>
      )}
      <SubmitButton>Turn In Assignment</SubmitButton>
    </form>
  );
}
