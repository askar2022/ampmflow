"use client";

import Link from "next/link";
import { useFormStatus } from "react-dom";
import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { loginAction } from "@/app/actions/auth";

export const fieldClass =
  "mt-1.5 w-full rounded-[8px] border border-[#d8dce2] bg-white px-3.5 py-2.5 text-[16px] text-navy outline-none transition placeholder:text-[#b0b6be] focus:border-navy focus:ring-2 focus:ring-navy/10 disabled:cursor-not-allowed disabled:opacity-60";

export function SignInForm({ authError }: { authError?: string }) {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <form action={loginAction} className="space-y-5">
      <label className="block text-left text-sm font-semibold text-navy">
        Email
        <input
          name="email"
          type="email"
          required
          autoComplete="username"
          placeholder="Enter your email"
          className={fieldClass}
        />
      </label>
      <label className="block text-left text-sm font-semibold text-navy">
        Password
        <span className="relative mt-1.5 block">
          <input
            name="password"
            type={showPassword ? "text" : "password"}
            required
            autoComplete="current-password"
            placeholder="Enter your password"
            className={`${fieldClass} mt-0 pr-11`}
          />
          <button
            type="button"
            onClick={() => setShowPassword((value) => !value)}
            className="absolute inset-y-0 right-0 grid w-11 place-items-center text-[#8b939c] hover:text-navy"
            aria-label={showPassword ? "Hide password" : "Show password"}
          >
            {showPassword ? (
              <EyeOff className="h-4 w-4" />
            ) : (
              <Eye className="h-4 w-4" />
            )}
          </button>
        </span>
      </label>
      <div className="flex items-center justify-between text-sm">
        <label className="inline-flex items-center gap-2 text-navy">
          <input
            name="remember"
            value="1"
            type="checkbox"
            className="size-4 rounded border-[#d8dce2] text-navy focus:ring-navy"
          />
          Remember me
        </label>
        <Link
          href="/login/forgot"
          className="font-medium text-teal hover:text-teal-deep"
        >
          Forgot password?
        </Link>
      </div>
      {authError ? (
        <p role="alert" className="text-sm text-red">
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
      className="w-full rounded-[8px] bg-navy px-4 py-2.5 text-[16px] font-semibold text-white transition hover:bg-navy-deep focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? "Signing in…" : children}
    </button>
  );
}
