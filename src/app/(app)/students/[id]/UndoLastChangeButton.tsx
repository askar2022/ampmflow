"use client";

import { useState, useTransition } from "react";
import { undoLastChange } from "@/app/actions/transportation";

export function UndoLastChangeButton({ studentId }: { studentId: string }) {
  const [pending, start] = useTransition();
  const [message, setMessage] = useState("");

  return (
    <div>
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const result = await undoLastChange(studentId);
            setMessage(
              result.ok
                ? "Last change undone."
                : result.error || "Could not undo.",
            );
          })
        }
        className="rounded-full border-2 border-navy bg-card px-4 py-2 text-sm font-medium text-navy disabled:opacity-60"
      >
        {pending ? "Undoing…" : "Undo last change"}
      </button>
      {message ? <p className="mt-2 text-sm text-muted">{message}</p> : null}
    </div>
  );
}
