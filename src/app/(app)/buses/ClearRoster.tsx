"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { clearSchoolRoster } from "@/app/actions/roster";

export function ClearRoster({
  schoolName,
  count,
}: {
  schoolName: string;
  count: number;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [message, setMessage] = useState("");
  const [pending, start] = useTransition();

  if (!count) return null;

  return (
    <section className="rounded-2xl border border-line bg-card p-5">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="text-sm font-semibold text-navy"
      >
        Wrong file? Remove students ({count})
      </button>
      {open ? (
        <div className="mt-3 space-y-3">
          <p className="text-sm text-muted">
            This removes every student on the {schoolName} roster, plus the
            teachers, buses, and vans that came from the file. The school and
            staff logins stay. Then load the correct Excel.
          </p>
          <label className="flex items-center gap-2 text-sm font-semibold">
            <input
              type="checkbox"
              checked={confirm}
              onChange={(event) => setConfirm(event.target.checked)}
            />
            Remove all students from this roster
          </label>
          <button
            type="button"
            disabled={!confirm || pending}
            onClick={() =>
              start(async () => {
                const result = await clearSchoolRoster();
                if (!result.ok) {
                  setMessage(result.error);
                  return;
                }
                setMessage(
                  result.removed
                    ? `Removed ${result.removed} student${result.removed === 1 ? "" : "s"}. Load the correct file.`
                    : "This roster was already empty.",
                );
                setConfirm(false);
                router.refresh();
              })
            }
            className="rounded-xl border border-red px-4 py-2 text-sm font-semibold text-red disabled:opacity-50"
          >
            {pending ? "Removing…" : "Remove students"}
          </button>
          {message ? <p className="text-sm text-muted">{message}</p> : null}
        </div>
      ) : null}
    </section>
  );
}
