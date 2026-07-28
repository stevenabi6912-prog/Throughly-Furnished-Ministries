"use client";

import { useActionState } from "react";
import { register } from "@/lib/actions/auth";
import SubmitButton from "@/components/SubmitButton";

const inputClass =
  "mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 shadow-sm focus:border-brand-500";

export default function RegisterForm() {
  const [state, action] = useActionState(register, undefined);
  return (
    <form action={action} className="mt-6 space-y-4">
      <label className="block text-sm font-medium text-slate-700">
        Full name
        <input name="name" type="text" autoComplete="name" required className={inputClass} />
      </label>
      <label className="block text-sm font-medium text-slate-700">
        Email
        <input name="email" type="email" autoComplete="email" required className={inputClass} />
      </label>
      <label className="block text-sm font-medium text-slate-700">
        Password
        <input
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          className={inputClass}
        />
        <span className="mt-1 block text-xs font-normal text-slate-500">
          At least 8 characters.
        </span>
      </label>
      {state?.error && (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.error}
        </p>
      )}
      <SubmitButton className="w-full rounded-lg bg-brand-500 px-5 py-2.5 font-semibold text-white transition-colors hover:bg-brand-600 disabled:cursor-wait disabled:opacity-60">
        Create Account
      </SubmitButton>
    </form>
  );
}
