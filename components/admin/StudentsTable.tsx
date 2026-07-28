"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { bulkStudents } from "@/lib/actions/admin";

export type StudentRow = {
  id: number;
  name: string;
  email: string;
  role: "student" | "admin";
  active: boolean;
  enrollmentCount: number;
  submissionCount: number;
};

type Filter = "active" | "archived" | "no-activity" | "all";

const filterLabels: Record<Filter, string> = {
  active: "Active",
  archived: "Archived",
  "no-activity": "No activity",
  all: "Everyone",
};

// The roster with search, filters, and bulk archive/delete. Admins can't
// be bulk-selected — they're managed one at a time on their detail page.
export default function StudentsTable({ rows }: { rows: StudentRow[] }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("active");
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [pending, startTransition] = useTransition();

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      if (filter === "active" && !r.active) return false;
      if (filter === "archived" && r.active) return false;
      if (
        filter === "no-activity" &&
        (r.enrollmentCount > 0 || r.submissionCount > 0 || !r.active)
      )
        return false;
      if (q && !r.name.toLowerCase().includes(q) && !r.email.toLowerCase().includes(q))
        return false;
      return true;
    });
  }, [rows, query, filter]);

  const selectable = visible.filter((r) => r.role === "student");
  const allVisibleSelected =
    selectable.length > 0 && selectable.every((r) => selected.has(r.id));

  const toggleAll = () => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allVisibleSelected) selectable.forEach((r) => next.delete(r.id));
      else selectable.forEach((r) => next.add(r.id));
      return next;
    });
  };
  const toggleOne = (id: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const run = (op: "archive" | "restore" | "delete") => {
    const count = selected.size;
    if (count === 0) return;
    if (
      op === "delete" &&
      !window.confirm(
        `Permanently delete ${count} account${count === 1 ? "" : "s"}? Their enrollments, submissions, and grades are deleted too. This cannot be undone.`
      )
    )
      return;
    const fd = new FormData();
    fd.set("op", op);
    fd.set("ids", [...selected].join(","));
    startTransition(async () => {
      await bulkStudents(fd);
      setSelected(new Set());
    });
  };

  return (
    <div>
      {/* Search + filters */}
      <div className="flex flex-wrap items-center gap-3">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search name or email…"
          className="w-64 rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-brand-500"
        />
        <div className="flex gap-1">
          {(Object.keys(filterLabels) as Filter[]).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                filter === f
                  ? "bg-slate-900 text-white"
                  : "bg-white text-slate-600 hover:bg-slate-100"
              }`}
            >
              {filterLabels[f]}
            </button>
          ))}
        </div>
        <span className="text-sm text-slate-500">
          {visible.length} shown
        </span>
      </div>

      {/* Bulk action bar */}
      {selected.size > 0 && (
        <div className="mt-4 flex flex-wrap items-center gap-3 rounded-xl bg-slate-900 px-4 py-3 text-white">
          <span className="text-sm font-semibold">
            {selected.size} selected
          </span>
          <button
            type="button"
            disabled={pending}
            onClick={() => run("archive")}
            className="rounded-lg bg-white/10 px-3 py-1.5 text-sm font-semibold hover:bg-white/20 disabled:opacity-50"
          >
            Archive
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => run("restore")}
            className="rounded-lg bg-white/10 px-3 py-1.5 text-sm font-semibold hover:bg-white/20 disabled:opacity-50"
          >
            Restore
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => run("delete")}
            className="rounded-lg bg-red-500 px-3 py-1.5 text-sm font-semibold hover:bg-red-600 disabled:opacity-50"
          >
            Delete permanently
          </button>
          {pending && <span className="text-sm text-slate-300">Working…</span>}
        </div>
      )}

      {/* Table */}
      <div className="mt-4 overflow-hidden rounded-2xl bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-xs uppercase tracking-wider text-slate-500">
                <th className="w-10 px-4 py-3">
                  <input
                    type="checkbox"
                    aria-label="Select all shown students"
                    checked={allVisibleSelected}
                    onChange={toggleAll}
                    className="h-4 w-4 rounded border-slate-300"
                  />
                </th>
                <th className="px-2 py-3 font-semibold">Name</th>
                <th className="px-4 py-3 font-semibold">Email</th>
                <th className="px-4 py-3 text-center font-semibold">Courses</th>
                <th className="px-4 py-3 text-center font-semibold">Graded work</th>
                <th className="px-6 py-3 font-semibold" />
              </tr>
            </thead>
            <tbody>
              {visible.map((u) => (
                <tr
                  key={u.id}
                  className={`border-b border-slate-100 last:border-0 ${
                    selected.has(u.id) ? "bg-brand-500/5" : ""
                  }`}
                >
                  <td className="px-4 py-3">
                    {u.role === "student" && (
                      <input
                        type="checkbox"
                        aria-label={`Select ${u.name}`}
                        checked={selected.has(u.id)}
                        onChange={() => toggleOne(u.id)}
                        className="h-4 w-4 rounded border-slate-300"
                      />
                    )}
                  </td>
                  <td className="px-2 py-3 font-semibold text-slate-900">
                    {u.name}
                    {u.role === "admin" && (
                      <span className="ml-2 rounded-full bg-brand-500/10 px-2 py-0.5 text-xs font-semibold text-brand-700">
                        admin
                      </span>
                    )}
                    {!u.active && (
                      <span className="ml-2 rounded-full bg-slate-200 px-2 py-0.5 text-xs font-semibold text-slate-600">
                        Archived
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{u.email}</td>
                  <td className="px-4 py-3 text-center text-slate-600">
                    {u.enrollmentCount || "—"}
                  </td>
                  <td className="px-4 py-3 text-center text-slate-600">
                    {u.submissionCount || "—"}
                  </td>
                  <td className="px-6 py-3 text-right">
                    <Link
                      href={`/admin/students/${u.id}`}
                      className="font-semibold text-brand-700 hover:underline"
                    >
                      View →
                    </Link>
                  </td>
                </tr>
              ))}
              {visible.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-slate-500">
                    No one matches this filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
