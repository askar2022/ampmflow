"use client";

import { useState, useTransition } from "react";
import { resetUserPassword } from "@/app/actions/users";

export function UserPasswordField({ id }: { id: string }) {
  const [pending, start] = useTransition();
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");

  return (
    <form
      className="flex min-w-[14rem] flex-col gap-1"
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
      <div className="flex flex-wrap gap-2">
        <input
          type="password"
          value={password}
          onChange={(event) => {
            setPassword(event.target.value);
            setMessage("");
          }}
          required
          minLength={4}
          placeholder="New password"
          className="w-36 rounded-xl border border-line px-3 py-2"
        />
        <button
          type="submit"
          disabled={pending || password.length < 4}
          className="rounded-full bg-navy px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          {pending ? "Saving…" : "Set password"}
        </button>
      </div>
      {message ? <p className="text-xs text-muted">{message}</p> : null}
    </form>
  );
}
