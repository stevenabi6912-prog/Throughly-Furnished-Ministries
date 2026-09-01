"use server";

import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { bugReports, getDb } from "@/lib/db";
import { requireUser, requireAdmin } from "@/lib/auth/session";

export async function submitBugReport(formData: FormData): Promise<void> {
  const user = await requireUser();
  const description = String(formData.get("description") ?? "").trim();
  const pageUrl = String(formData.get("pageUrl") ?? "").trim() || null;
  if (!description) redirect("/report-bug");

  const db = await getDb();
  await db.insert(bugReports).values({ userId: user.id, description, pageUrl });
  redirect("/report-bug?sent=1");
}

export async function setBugResolved(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = Number(formData.get("id"));
  const resolved = formData.get("resolved") === "1";
  const db = await getDb();
  await db.update(bugReports).set({ resolved }).where(eq(bugReports.id, id));
}
