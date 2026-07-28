"use client";

import { useActionState } from "react";
import { saveCourse } from "@/lib/actions/admin";
import SubmitButton from "@/components/SubmitButton";
import type { Course } from "@/lib/db/schema";

const inputClass =
  "mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 shadow-sm focus:border-brand-500";

export default function CourseForm({ course }: { course?: Course }) {
  const [state, action] = useActionState(saveCourse, undefined);
  return (
    <form action={action} className="space-y-4">
      {course && <input type="hidden" name="id" value={course.id} />}
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm font-medium text-slate-700 sm:col-span-2">
          Title
          <input name="title" defaultValue={course?.title} required className={inputClass} />
        </label>
        <label className="block text-sm font-medium text-slate-700">
          Program track
          <select name="track" defaultValue={course?.track ?? "biblical-studies"} className={inputClass}>
            <option value="biblical-studies">Biblical Studies</option>
            <option value="practical-skills">Practical Skills</option>
            <option value="ministry-participation">Ministry Participation</option>
          </select>
        </label>
        <label className="block text-sm font-medium text-slate-700">
          Sort order
          <input
            name="sortOrder"
            type="number"
            defaultValue={course?.sortOrder ?? 0}
            className={inputClass}
          />
        </label>
        <label className="block text-sm font-medium text-slate-700 sm:col-span-2">
          Description
          <textarea
            name="description"
            rows={3}
            defaultValue={course?.description}
            className={inputClass}
          />
        </label>
      </div>
      <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
        <input
          type="checkbox"
          name="published"
          defaultChecked={course?.published ?? false}
          className="h-4 w-4 rounded border-slate-300 text-brand-500"
        />
        Published (visible to students)
      </label>
      {state?.error && (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.error}
        </p>
      )}
      <div className="flex items-center gap-3">
        <SubmitButton>{course ? "Save Course" : "Create Course"}</SubmitButton>
        {state?.ok && <span className="text-sm font-medium text-green-700">Saved ✓</span>}
      </div>
    </form>
  );
}
