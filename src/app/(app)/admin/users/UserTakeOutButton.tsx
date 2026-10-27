"use client";

import { useState, useTransition } from "react";
import { deleteUser } from "@/app/actions/users";

export function UserTakeOutButton({ id, name }: { id: string; name: string }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState("");

  return (
    <div>
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          if (
            !window.confirm(
              `Take out ${name}? They will be deleted and cannot sign in. This cannot be undone.`,
            )
          ) {
            return;
          }
          start(async () => {
            const result = await deleteUser(id);
            setError(result.ok ? "" : result.error);
          });
        }}
        className="rounded-full bg-red px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
      >
        {pending ? "Taking out…" : "Take out"}
      </button>
      {error ? <p className="mt-1 text-sm text-red">{error}</p> : null}
    </div>
  );
}
