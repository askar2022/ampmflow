"use client";

import { useTransition } from "react";
import { toggleUser } from "@/app/actions/users";

export function UserRemoveButton({
  id,
  active,
}: {
  id: string;
  active: boolean;
}) {
  const [pending, start] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => start(() => toggleUser(id))}
      className="relative z-10 rounded-full border border-red px-4 py-2 text-sm font-semibold text-red hover:bg-red hover:text-white disabled:opacity-50"
    >
      {pending ? "Working…" : active ? "Remove" : "Put back"}
    </button>
  );
}
