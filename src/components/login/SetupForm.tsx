"use client";

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { createAccount } from "@/app/actions/setup";
import { fieldClass, SubmitButton } from "@/components/login/SignInForm";

export function SetupForm({
  error,
  showSchoolName = true,
}: {
  error?: string;
  showSchoolName?: boolean;
}) {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <form action={createAccount} className="space-y-5">
      {showSchoolName ? (
        <label className="block text-left text-sm font-medium text-navy">
          School name
          <input name="schoolName" required className={fieldClass} />
        </label>
      ) : null}
      <label className="block text-left text-sm font-medium text-navy">
        Your name
        <input name="name" required className={fieldClass} />
      </label>
      <label className="block text-left text-sm font-medium text-navy">
        Email
        <input name="email" type="email" required className={fieldClass} />
      </label>
      <label className="block text-left text-sm font-medium text-navy">
        Password
        <span className="relative mt-1.5 block">
          <input
            name="password"
            type={showPassword ? "text" : "password"}
            required
            minLength={8}
            className={`${fieldClass} mt-0 pr-11`}
          />
          <button
            type="button"
            onClick={() => setShowPassword((value) => !value)}
            className="absolute inset-y-0 right-0 grid w-11 place-items-center text-muted hover:text-navy"
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
      {error ? (
        <p role="alert" className="text-sm text-red">
          {error}
        </p>
      ) : null}
      <SubmitButton>Create account</SubmitButton>
    </form>
  );
}
