"use client";

import { useActionState } from "react";
import { saveLesson } from "@/lib/actions/admin";
import SubmitButton from "@/components/SubmitButton";
import type { Lesson } from "@/lib/db/schema";

const inputClass =
  "mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 shadow-sm focus:border-brand-500";

export default function LessonForm({
  courseId,
  lesson,
}: {
  courseId: number;
  lesson?: Lesson;
}) {
  const [state, action] = useActionState(saveLesson, undefined);
  return (
    <form action={action} className="space-y-4">
      {lesson && <input type="hidden" name="id" value={lesson.id} />}
      <input type="hidden" name="courseId" value={courseId} />
      <div className="grid gap-4 sm:grid-cols-[1fr_8rem]">
        <label className="block text-sm font-medium text-slate-700">
          Title
          <input name="title" defaultValue={lesson?.title} required className={inputClass} />
        </label>
        <label className="block text-sm font-medium text-slate-700">
          Sort order
          <input
            name="sortOrder"
            type="number"
            defaultValue={lesson?.sortOrder ?? 0}
            className={inputClass}
          />
        </label>
      </div>
      <label className="block text-sm font-medium text-slate-700">
        Lesson content{" "}
        <span className="font-normal text-slate-500">(HTML is fine — headings, lists, images, YouTube embeds)</span>
        <textarea
          name="contentHtml"
          rows={10}
          defaultValue={lesson?.contentHtml}
          className={`${inputClass} font-mono text-sm`}
        />
      </label>
      <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
        <input
          type="checkbox"
          name="published"
          defaultChecked={lesson?.published ?? true}
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
        <SubmitButton>{lesson ? "Save Lesson" : "Add Lesson"}</SubmitButton>
        {state?.ok && <span className="text-sm font-medium text-green-700">Saved ✓</span>}
      </div>
    </form>
  );
}
