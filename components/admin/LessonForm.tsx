"use client";

import { useActionState } from "react";
import { saveLesson } from "@/lib/actions/admin";
import SubmitButton from "@/components/SubmitButton";
import type { Lesson } from "@/lib/db/schema";

const inputClass =
  "mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 shadow-sm focus:border-brand-500";

// The standard TFM lesson: title, YouTube video, fillable PDF worksheet,
// and a homework turn-in. Content HTML is optional extra material.
export default function LessonForm({
  courseId,
  lesson,
  hasAssignment,
}: {
  courseId: number;
  lesson?: Lesson;
  hasAssignment?: boolean;
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
        YouTube video link{" "}
        <span className="font-normal text-slate-500">(the teaching video for this lesson)</span>
        <input
          name="videoUrl"
          type="url"
          placeholder="https://www.youtube.com/watch?v=…"
          defaultValue={lesson?.videoUrl ?? ""}
          className={inputClass}
        />
      </label>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm font-medium text-slate-700">
          Worksheet PDF{" "}
          <span className="font-normal text-slate-500">(upload the fillable PDF)</span>
          <input
            name="worksheetFile"
            type="file"
            accept=".pdf,application/pdf"
            className="mt-1 block w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-100 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-slate-700 hover:file:bg-slate-200"
          />
        </label>
        <label className="block text-sm font-medium text-slate-700">
          …or worksheet link
          <input
            name="worksheetUrl"
            type="url"
            placeholder="https://…/worksheet.pdf"
            defaultValue={lesson?.worksheetUrl ?? ""}
            className={inputClass}
          />
        </label>
      </div>
      <label className="block text-sm font-medium text-slate-700">
        Extra lesson content{" "}
        <span className="font-normal text-slate-500">(optional — HTML is fine)</span>
        <textarea
          name="contentHtml"
          rows={6}
          defaultValue={lesson?.contentHtml}
          className={`${inputClass} font-mono text-sm`}
        />
      </label>
      <div className="flex flex-wrap gap-6">
        <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
          <input
            type="checkbox"
            name="hasHomework"
            defaultChecked={hasAssignment ?? true}
            className="h-4 w-4 rounded border-slate-300 text-brand-500"
          />
          Homework turn-in on this lesson
          {hasAssignment && (
            <span className="font-normal text-slate-500">(already set up)</span>
          )}
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
      </div>
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
