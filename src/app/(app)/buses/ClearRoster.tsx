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
  const [warn, setWarn] = useState(false);
  const [message, setMessage] = useState("");
  const [pending, start] = useTransition();

  if (!count && !message) return null;

  function closeWarn() {
    if (!pending) setWarn(false);
  }

  function removeStudents() {
    start(async () => {
      const result = await clearSchoolRoster();
      if (!result.ok) {
        setMessage(result.error);
        setWarn(false);
        return;
      }
      setMessage(
        result.removed
          ? `Removed ${result.removed} student${result.removed === 1 ? "" : "s"}. Load the correct file.`
          : "This roster was already empty.",
      );
      setWarn(false);
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <section className="rounded-2xl border border-line bg-card p-5">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="text-sm font-semibold text-navy"
      >
        Wrong file? Remove students {count ? `(${count})` : ""}
      </button>
      {open ? (
        <div className="mt-3 space-y-3">
          <p className="text-sm text-muted">
            This removes every student on the {schoolName} roster, plus the
            teachers, buses, and vans that came from the file. The school and
            staff logins stay. Then load the correct Excel.
          </p>
          <button
            type="button"
            disabled={pending || !count}
            onClick={() => setWarn(true)}
            className="rounded-xl border border-red px-4 py-2 text-sm font-semibold text-red disabled:opacity-50"
          >
            Remove students
          </button>
        </div>
      ) : null}
      {message ? <p className="mt-3 text-sm text-muted">{message}</p> : null}

      {warn ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-navy/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="clear-roster-title"
          onClick={closeWarn}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-card p-5 shadow-lg"
            onClick={(event) => event.stopPropagation()}
          >
            <h3 id="clear-roster-title" className="font-serif text-2xl text-navy">
              Warning
            </h3>
            <p className="mt-2 text-sm text-navy">
              This cannot be undone. You will delete {count} student
              {count === 1 ? "" : "s"} from {schoolName}, including their
              teacher, bus, and van. If this is the wrong school or the right
              file is already loaded, press Cancel.
            </p>
            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                disabled={pending}
                onClick={closeWarn}
                className="rounded-xl border border-line px-4 py-2 text-sm font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={removeStudents}
                className="rounded-xl bg-red px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                {pending ? "Removing…" : "Yes, remove them"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
