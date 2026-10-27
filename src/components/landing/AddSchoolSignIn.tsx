"use client";

import { useState } from "react";
import { loginAction } from "@/app/actions/auth";
import { fieldClass } from "@/components/login/SignInForm";

export function AddSchoolSignIn({ error }: { error?: string }) {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <form action={loginAction} className="mt-5 space-y-3">
      <input type="hidden" name="next" value="schools" />
      <label className="block text-left text-sm font-semibold text-navy">
        Email
        <input
          name="email"
          type="email"
          required
          autoComplete="username"
          placeholder="Your AMPM Flow email"
          className={fieldClass}
        />
      </label>
      <label className="block text-left text-sm font-semibold text-navy">
        Password
        <span className="relative mt-1 block">
          <input
            name="password"
            type={showPassword ? "text" : "password"}
            required
            autoComplete="current-password"
            placeholder="Password"
            className={`${fieldClass} mt-0 pr-24`}
          />
          <button
            type="button"
            onClick={() => setShowPassword((value) => !value)}
            className="absolute inset-y-0 right-2 text-sm font-semibold text-navy"
          >
            {showPassword ? "Hide" : "Show"}
          </button>
        </span>
      </label>
      {error ? <p className="text-sm text-red">{error}</p> : null}
      <button className="min-h-11 w-full rounded-[8px] bg-navy px-4 py-2.5 text-[16px] font-semibold text-white hover:bg-navy-deep">
        Sign in and add schools
      </button>
    </form>
  );
}
