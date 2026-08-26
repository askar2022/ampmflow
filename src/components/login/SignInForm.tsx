"use client";

import Link from "next/link";
import { useFormStatus } from "react-dom";
import { useState } from "react";
import { loginAction } from "@/app/actions/auth";

const fieldClass =
  "mt-1.5 w-full rounded-xl border border-line bg-white px-3.5 py-2.5 text-[16px] text-ink outline-none transition placeholder:text-muted/70 focus:border-teal focus:ring-2 focus:ring-teal/20 disabled:cursor-not-allowed disabled:bg-paper disabled:opacity-60";

export function SignInForm({ authError }: { authError?: string }) {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <form action={loginAction} className="space-y-3">
      <label className="block text-sm font-medium text-navy">
        Email
        <input
          name="email"
          type="email"
          required
          autoComplete="username"
          className={fieldClass}
        />
      </label>
      <label className="block text-sm font-medium text-navy">
        Password
        <input
          name="password"
          type={showPassword ? "text" : "password"}
          required
          autoComplete="current-password"
          className={fieldClass}
        />
      </label>
      <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
        <label className="inline-flex items-center gap-2 text-ink">
          <input
            type="checkbox"
            checked={showPassword}
            onChange={(event) => setShowPassword(event.target.checked)}
            className="size-4 rounded border-line text-teal focus:ring-teal"
          />
          Show password
        </label>
        <label className="inline-flex items-center gap-2 text-ink">
          <input
            name="remember"
            value="1"
            type="checkbox"
            className="size-4 rounded border-line text-teal focus:ring-teal"
          />
          Remember me
        </label>
      </div>
      <div className="flex justify-end">
        <Link
          href="/login/forgot"
          className="text-sm font-medium text-teal hover:text-teal-deep"
        >
          Forgot password
        </Link>
      </div>
      {authError ? (
        <p
          role="alert"
          className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red"
        >
          {authError}
        </p>
      ) : null}
      <SubmitButton>Sign in</SubmitButton>
    </form>
  );
}

export function SubmitButton({ children }: { children: React.ReactNode }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded-xl bg-teal px-4 py-2.5 text-[16px] font-semibold text-white transition hover:bg-teal-deep focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? "Signing in…" : children}
    </button>
  );
}

export { fieldClass };
