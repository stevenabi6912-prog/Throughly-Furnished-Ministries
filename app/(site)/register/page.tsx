import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import RegisterForm from "./RegisterForm";

export const metadata: Metadata = { title: "Register" };

export default async function RegisterPage() {
  const user = await getCurrentUser();
  if (user) redirect(user.role === "admin" ? "/admin" : "/dashboard");

  return (
    <section className="bg-slate-50 px-4 py-16 sm:py-24">
      <div className="mx-auto max-w-md rounded-2xl bg-white p-8 shadow-sm">
        <h1 className="text-3xl">Register</h1>
        <p className="mt-2 text-sm text-slate-600">
          Create your account to enroll in TFM courses, submit assignments,
          and track your progress.
        </p>
        <RegisterForm requireKeyword={Boolean(process.env.REGISTRATION_CODE)} />
        <p className="mt-6 text-sm text-slate-600">
          Already have an account?{" "}
          <Link href="/login" className="font-semibold text-brand-700 hover:underline">
            Log in
          </Link>
        </p>
      </div>
    </section>
  );
}
