"use client";

import Link from "next/link";
import { useFormStatus } from "react-dom";
import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { loginAction } from "@/app/actions/auth";

export const fieldClass =
  "mt-1 min-h-11 w-full rounded-[8px] border border-[#d8dce2] bg-white px-3.5 py-2.5 text-[16px] text-navy outline-none transition placeholder:text-[#b0b6be] focus:border-navy focus:ring-2 focus:ring-navy/10 disabled:cursor-not-allowed disabled:opacity-60";

export function SignInForm({
  authError,
  notice,
}: {
  authError?: string;
  notice?: string;
}) {
  const [showPassword, setShowPassword] = useState(false);
  const invalid = Boolean(authError);

  return (
    <form action={loginAction} className="space-y-3 short-h:space-y-2.5" aria-labelledby="login-heading">
      <label className="block text-left text-sm font-semibold text-navy" htmlFor="login-email">
        Email
        <input
          id="login-email"
          name="email"
          type="email"
          required
          autoComplete="username"
          placeholder="Enter your email"
          aria-invalid={invalid}
          aria-describedby="login-error"
          className={fieldClass}
        />
      </label>
      <label className="block text-left text-sm font-semibold text-navy" htmlFor="login-password">
        Password
        <span className="relative mt-1 block">
          <input
            id="login-password"
            name="password"
            type={showPassword ? "text" : "password"}
            required
            autoComplete="current-password"
            placeholder="Enter your password"
            aria-invalid={invalid}
            aria-describedby="login-error"
            className={`${fieldClass} mt-0 pr-11`}
          />
          <button
            type="button"
            onClick={() => setShowPassword((value) => !value)}
            className="absolute inset-y-0 right-0 grid w-11 place-items-center text-[#8b939c] hover:text-navy focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy"
            aria-label={showPassword ? "Hide password" : "Show password"}
          >
            {showPassword ? (
              <EyeOff className="h-4 w-4" aria-hidden="true" />
            ) : (
              <Eye className="h-4 w-4" aria-hidden="true" />
            )}
          </button>
        </span>
      </label>
      <div className="flex flex-nowrap items-center justify-between gap-3 text-sm">
        <label className="inline-flex items-center gap-2 text-navy">
          <input
            name="remember"
            value="1"
            type="checkbox"
            className="size-4 rounded border-[#d8dce2] text-navy focus:ring-2 focus:ring-navy"
          />
          Remember me
        </label>
        <Link
          href="/login/forgot"
          className="font-medium text-teal hover:text-teal-deep focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy"
        >
          Forgot password?
        </Link>
      </div>
      <p
        id="login-error"
        role="alert"
        aria-live="polite"
        aria-atomic="true"
        className={`min-h-5 text-sm ${notice && !authError ? "text-teal-deep" : "text-red"}`}
      >
        {authError || notice || "\u00a0"}
      </p>
      <SubmitButton>Sign in</SubmitButton>
      <p className="text-center text-sm text-navy">
        Need an account?{" "}
        <Link href="/login/create" className="font-medium text-teal hover:text-teal-deep">
          Join a school
        </Link>
        {" · "}
        <Link href="/login/create?kind=new" className="font-medium text-teal hover:text-teal-deep">
          Start a new school
        </Link>
      </p>
    </form>
  );
}

export function SubmitButton({
  children,
  pendingLabel,
}: {
  children: React.ReactNode;
  pendingLabel?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      aria-busy={pending}
      className="min-h-11 w-full rounded-[8px] bg-navy px-4 py-2.5 text-[16px] font-semibold text-white transition hover:bg-navy-deep focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? pendingLabel || "Signing in…" : children}
    </button>
  );
}
