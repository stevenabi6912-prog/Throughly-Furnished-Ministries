"use client";

import { useActionState } from "react";
import { saveAssignment } from "@/lib/actions/admin";
import SubmitButton from "@/components/SubmitButton";
import type { Assignment, Lesson } from "@/lib/db/schema";

const inputClass =
  "mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 shadow-sm focus:border-brand-500";

export default function AssignmentForm({
  courseId,
  lessons,
  assignment,
}: {
  courseId: number;
  lessons: Lesson[];
  assignment?: Assignment;
}) {
  const [state, action] = useActionState(saveAssignment, undefined);
  const due = assignment?.dueAt
    ? new Date(
        assignment.dueAt.getTime() -
          assignment.dueAt.getTimezoneOffset() * 60000
      )
        .toISOString()
        .slice(0, 10)
    : "";
  return (
    <form action={action} className="space-y-4">
      {assignment && <input type="hidden" name="id" value={assignment.id} />}
      <input type="hidden" name="courseId" value={courseId} />
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm font-medium text-slate-700 sm:col-span-2">
          Title
          <input name="title" defaultValue={assignment?.title} required className={inputClass} />
        </label>
        <label className="block text-sm font-medium text-slate-700">
          Attached to lesson
          <select
            name="lessonId"
            defaultValue={assignment?.lessonId ?? ""}
            className={inputClass}
          >
            <option value="">— whole course —</option>
            {lessons.map((l) => (
              <option key={l.id} value={l.id}>
                {l.title}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm font-medium text-slate-700">
          Points
          <input
            name="points"
            type="number"
            min={1}
            defaultValue={assignment?.points ?? 100}
            className={inputClass}
          />
        </label>
        <label className="block text-sm font-medium text-slate-700">
          Due date <span className="font-normal text-slate-500">(optional)</span>
          <input name="dueAt" type="date" defaultValue={due} className={inputClass} />
        </label>
      </div>
      <label className="block text-sm font-medium text-slate-700">
        Instructions{" "}
        <span className="font-normal text-slate-500">(HTML is fine)</span>
        <textarea
          name="instructionsHtml"
          rows={6}
          defaultValue={assignment?.instructionsHtml}
          className={`${inputClass} font-mono text-sm`}
        />
      </label>
      <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
        <input
          type="checkbox"
          name="published"
          defaultChecked={assignment?.published ?? true}
          className="h-4 w-4 rounded border-slate-300 text-brand-500"
        />
        Published
      </label>
      {state?.error && (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.error}
        </p>
      )}
      <div className="flex items-center gap-3">
        <SubmitButton>
          {assignment ? "Save Assignment" : "Add Assignment"}
        </SubmitButton>
        {state?.ok && <span className="text-sm font-medium text-green-700">Saved ✓</span>}
      </div>
    </form>
  );
}
