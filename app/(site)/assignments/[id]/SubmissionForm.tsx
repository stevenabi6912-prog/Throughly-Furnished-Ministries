"use client";

import { useActionState } from "react";
import { submitAssignment } from "@/lib/actions/student";
import SubmitButton from "@/components/SubmitButton";

// Turn-in form: the completed worksheet (or exam) is the answer, so this
// is deliberately just a file upload — no confusing text box.
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
        Upload your completed worksheet
        <span className="block text-xs font-normal text-slate-500">
          PDF is best (type into the worksheet, save, upload). Photos or
          Word files work too — up to 25 MB.
        </span>
        <input
          name="file"
          type="file"
          required
          accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,.heic,.webp"
          className="mt-2 block w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-brand-500 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-brand-600"
        />
      </label>
      {state?.error && (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.error}
        </p>
      )}
      <SubmitButton>Turn In Homework</SubmitButton>
    </form>
  );
}
