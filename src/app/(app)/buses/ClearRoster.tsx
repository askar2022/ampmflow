"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { archiveSchoolRoster } from "@/app/actions/roster";

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
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [pending, start] = useTransition();

  if (!count && !message) return null;

  function closeWarn() {
    if (!pending) {
      setWarn(false);
      setPassword("");
    }
  }

  function archiveStudents() {
    start(async () => {
      const result = await archiveSchoolRoster(password);
      if (!result.ok) {
        setMessage(result.error);
        return;
      }
      setMessage(
        result.archived
          ? `Moved ${result.archived} student${result.archived === 1 ? "" : "s"} to Archive. They are still saved.`
          : "This roster was already empty.",
      );
      setWarn(false);
      setPassword("");
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
        Wrong file? Move students to Archive {count ? `(${count})` : ""}
      </button>
      {open ? (
        <div className="mt-3 space-y-3">
          <p className="mt-1 text-sm text-muted">
            This hides every student on the {schoolName} roster from Front Desk
            and Reports. They go to Archive so the data is still safe. Your
            sign-in password is required so a desk left open cannot archive the
            list.
          </p>
          <button
            type="button"
            disabled={pending || !count}
            onClick={() => {
              setPassword("");
              setMessage("");
              setWarn(true);
            }}
            className="rounded-xl border border-red px-4 py-2 text-sm font-semibold text-red disabled:opacity-50"
          >
            Move to Archive
          </button>
        </div>
      ) : null}
      {message ? <p className="mt-3 text-sm text-muted">{message}</p> : null}

      {warn ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-navy/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="archive-roster-title"
          onClick={closeWarn}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-card p-5 shadow-lg"
            onClick={(event) => event.stopPropagation()}
          >
            <h3 id="archive-roster-title" className="font-serif text-2xl text-navy">
              Confirm with password
            </h3>
            <p className="mt-2 text-sm text-navy">
              {count} student{count === 1 ? "" : "s"} on {schoolName} will leave
              Front Desk and Reports and go to Archive. Enter your sign-in
              password to continue.
            </p>
            <label className="mt-4 block text-sm font-semibold text-navy">
              Your password
              <input
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="mt-1 w-full rounded-xl border border-line bg-white px-3 py-2 font-normal"
                placeholder="Sign-in password"
              />
            </label>
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
                disabled={pending || !password.trim()}
                onClick={archiveStudents}
                className="rounded-xl bg-navy px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                {pending ? "Moving…" : "Yes, move to Archive"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
