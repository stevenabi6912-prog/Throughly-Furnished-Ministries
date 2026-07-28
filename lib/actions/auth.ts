"use server";

import { redirect } from "next/navigation";
import { eq, sql } from "drizzle-orm";
import { getDb, users } from "@/lib/db";
import {
  hashPassword,
  verifyLegacyWordPressHash,
  verifyPassword,
} from "@/lib/auth/password";
import { createSession, destroySession } from "@/lib/auth/session";

export type FormState = { error?: string } | undefined;

export async function login(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  if (!email || !password) return { error: "Enter your email and password." };

  const db = await getDb();
  const user = await db.query.users.findFirst({
    where: eq(users.email, email),
  });
  const failed = { error: "That email and password don't match." };
  if (!user || !user.active) return failed;

  let ok = false;
  if (user.passwordHash) {
    ok = verifyPassword(password, user.passwordHash);
  } else if (user.legacyHash) {
    // Imported from the old LearnDash site — verify the WordPress hash,
    // then silently upgrade the account to bcrypt.
    ok = verifyLegacyWordPressHash(password, user.legacyHash);
    if (ok) {
      await db
        .update(users)
        .set({ passwordHash: hashPassword(password), legacyHash: null })
        .where(eq(users.id, user.id));
    }
  }
  if (!ok) return failed;

  await createSession(user.id);
  redirect(user.role === "admin" ? "/admin" : "/dashboard");
}

export async function register(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!name) return { error: "Enter your name." };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    return { error: "Enter a valid email address." };
  if (password.length < 8)
    return { error: "Password must be at least 8 characters." };

  const db = await getDb();
  const existing = await db.query.users.findFirst({
    where: eq(users.email, email),
  });
  if (existing)
    return { error: "An account with that email already exists — try logging in." };

  // The very first account becomes the admin; everyone after is a student.
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(users);
  const [user] = await db
    .insert(users)
    .values({
      name,
      email,
      passwordHash: hashPassword(password),
      role: count === 0 ? "admin" : "student",
    })
    .returning();

  await createSession(user.id);
  redirect(user.role === "admin" ? "/admin" : "/dashboard");
}

export async function logout(): Promise<void> {
  await destroySession();
  redirect("/");
}
