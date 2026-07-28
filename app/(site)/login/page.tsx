import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import LoginForm from "./LoginForm";

export const metadata: Metadata = { title: "Log In" };

export default async function LoginPage() {
  const user = await getCurrentUser();
  if (user) redirect(user.role === "admin" ? "/admin" : "/dashboard");

  return (
    <section className="bg-slate-50 px-4 py-16 sm:py-24">
      <div className="mx-auto max-w-md rounded-2xl bg-white p-8 shadow-sm">
        <h1 className="text-3xl">Log In</h1>
        <p className="mt-2 text-sm text-slate-600">
          Welcome back. Log in to continue your training.
        </p>
        <LoginForm />
        <p className="mt-6 text-sm text-slate-600">
          New to TFM?{" "}
          <Link href="/register" className="font-semibold text-brand-700 hover:underline">
            Create an account
          </Link>
        </p>
      </div>
    </section>
  );
}
