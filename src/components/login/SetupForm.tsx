"use client";

import { useState } from "react";
import { createFirstAccount } from "@/app/actions/setup";
import { SubmitButton, fieldClass } from "@/components/login/SignInForm";

export function SetupForm({ error }: { error?: string }) {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <form action={createFirstAccount} className="space-y-4">
      <label className="block text-sm font-medium text-navy">
        School name
        <input name="schoolName" required className={fieldClass} />
      </label>
      <label className="block text-sm font-medium text-navy">
        Your name
        <input name="name" required className={fieldClass} />
      </label>
      <label className="block text-sm font-medium text-navy">
        Email
        <input name="email" type="email" required className={fieldClass} />
      </label>
      <label className="block text-sm font-medium text-navy">
        Password
        <input
          name="password"
          type={showPassword ? "text" : "password"}
          required
          minLength={8}
          className={fieldClass}
        />
      </label>
      <label className="inline-flex items-center gap-2 text-sm text-ink">
        <input
          type="checkbox"
          checked={showPassword}
          onChange={(event) => setShowPassword(event.target.checked)}
          className="size-4 rounded border-line text-teal focus:ring-teal"
        />
        Show password
      </label>
      {error ? (
        <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red">
          {error}
        </p>
      ) : null}
      <SubmitButton>Create account and continue</SubmitButton>
    </form>
  );
}
