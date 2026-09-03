"use client";

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { createAccount } from "@/app/actions/setup";
import { fieldClass, SubmitButton } from "@/components/login/SignInForm";

export function SetupForm({
  error,
  showSchoolName = true,
  mode = "first-admin",
}: {
  error?: string;
  showSchoolName?: boolean;
  mode?: "first-admin" | "request" | "new-school";
}) {
  const [showPassword, setShowPassword] = useState(false);
  const intent =
    mode === "new-school" ? "new-school" : mode === "request" ? "join" : "join";

  return (
    <form action={createAccount} className="space-y-3 short-h:space-y-2.5">
      <input type="hidden" name="intent" value={mode === "new-school" ? "new-school" : intent} />
      {showSchoolName ? (
        <label className="block text-left text-sm font-medium text-navy">
          School name
          <input
            name="schoolName"
            required
            className={fieldClass}
            placeholder={
              mode === "new-school"
                ? "Your school name"
                : "Type the school name exactly"
            }
          />
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
        <span className="relative mt-1 block">
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
      <p
        role="alert"
        aria-live="polite"
        aria-atomic="true"
        className="min-h-5 text-sm text-red"
      >
        {error || "\u00a0"}
      </p>
      <SubmitButton
        pendingLabel={
          mode === "request"
            ? "Sending request…"
            : mode === "new-school"
              ? "Creating school…"
              : "Creating account…"
        }
      >
        {mode === "request"
          ? "Request to join this school"
          : mode === "new-school"
            ? "Create my school"
            : "Create account"}
      </SubmitButton>
    </form>
  );
}
