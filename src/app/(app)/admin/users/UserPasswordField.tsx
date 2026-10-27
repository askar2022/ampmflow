"use client";

import { useState, useTransition } from "react";
import { resetUserPassword } from "@/app/actions/users";

export function UserPasswordField({ id }: { id: string }) {
  const [pending, start] = useTransition();
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");

  return (
    <form
      className="space-y-2"
      onSubmit={(event) => {
        event.preventDefault();
        const data = new FormData();
        data.set("id", id);
        data.set("password", password);
        start(async () => {
          await resetUserPassword(data);
          setPassword("");
          setMessage("Password saved. Tell them the new one.");
        });
      }}
    >
      <label className="block text-sm font-semibold text-navy">
        Change password
        <input
          type="password"
          value={password}
          onChange={(event) => {
            setPassword(event.target.value);
            setMessage("");
          }}
          required
          minLength={4}
          placeholder="Type a new password"
          className="mt-1 w-full rounded-xl border border-line px-3 py-2.5 text-base font-normal"
        />
      </label>
      <button
        type="submit"
        disabled={pending || password.length < 4}
        className="min-h-11 w-full rounded-xl bg-navy px-4 py-2.5 text-base font-semibold text-white disabled:opacity-50 sm:w-auto"
      >
        {pending ? "Saving…" : "Save new password"}
      </button>
      {message ? <p className="text-sm font-medium text-teal-deep">{message}</p> : null}
    </form>
  );
}
