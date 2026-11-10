"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  deleteArchivedStudents,
  restoreSchoolRoster,
  restoreStudent,
} from "@/app/actions/roster";

type ArchivedStudent = {
  id: string;
  firstName: string;
  lastName: string;
  grade: string;
};

export function StudentArchive({ students }: { students: ArchivedStudent[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [warnDelete, setWarnDelete] = useState(false);
  const [password, setPassword] = useState("");
  const [pending, start] = useTransition();
  const [message, setMessage] = useState("");

  if (!students.length && !message) return null;

  function closeWarn() {
    if (!pending) {
      setWarnDelete(false);
      setPassword("");
    }
  }

  function deleteAll() {
    start(async () => {
      const result = await deleteArchivedStudents(password);
      if (!result.ok) {
        setMessage(result.error);
        return;
      }
      setMessage(
        result.deleted
          ? `Permanently deleted ${result.deleted} archived student${result.deleted === 1 ? "" : "s"}.`
          : "Archive was already empty.",
      );
      setWarnDelete(false);
      setPassword("");
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <section className="rounded-2xl border border-line bg-card">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left"
        aria-expanded={open}
      >
        <span>
          <span className="font-serif text-2xl">Archive</span>
          <span className="ml-2 text-base text-muted">({students.length})</span>
        </span>
        <span className="text-sm font-semibold text-navy">
          {open ? "Hide" : "Show"}
        </span>
      </button>
      {open ? (
        <div className="border-t border-line px-5 pb-5">
          <p className="mt-3 text-muted">
            These students are hidden from Front Desk and Reports. Put back
            restores them. Delete all requires your sign-in password.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={pending || !students.length}
              onClick={() =>
                start(async () => {
                  const result = await restoreSchoolRoster();
                  setMessage(
                    result.ok
                      ? `Put ${result.restored} student${result.restored === 1 ? "" : "s"} back on the roster.`
                      : result.error,
                  );
                  router.refresh();
                })
              }
              className="rounded-xl border border-line px-4 py-2 text-sm font-semibold disabled:opacity-50"
            >
              {pending ? "Working…" : "Put all back"}
            </button>
            <button
              type="button"
              disabled={pending || !students.length}
              onClick={() => {
                setPassword("");
                setMessage("");
                setWarnDelete(true);
              }}
              className="rounded-xl border border-red px-4 py-2 text-sm font-semibold text-red disabled:opacity-50"
            >
              Delete all permanently
            </button>
          </div>
          {message ? <p className="mt-3 text-sm text-muted">{message}</p> : null}
          <ul className="mt-4 space-y-3">
            {students.map((student) => (
              <li
                key={student.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line px-4 py-3"
              >
                <div>
                  <div className="font-semibold text-navy">
                    {student.firstName} {student.lastName}
                  </div>
                  <div className="text-sm text-muted">
                    Grade {String(student.grade).replace(/^grade\s+/i, "")} ·
                    Archived
                  </div>
                </div>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() =>
                    start(async () => {
                      const result = await restoreStudent(student.id);
                      setMessage(
                        result.ok
                          ? `Put ${student.firstName} ${student.lastName} back on the roster.`
                          : result.error,
                      );
                      router.refresh();
                    })
                  }
                  className="rounded-full border border-line px-4 py-2 text-sm font-semibold"
                >
                  Put back
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {warnDelete ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-navy/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-archive-title"
          onClick={closeWarn}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-card p-5 shadow-lg"
            onClick={(event) => event.stopPropagation()}
          >
            <h3 id="delete-archive-title" className="font-serif text-2xl text-navy">
              Confirm with password
            </h3>
            <p className="mt-2 text-sm text-navy">
              This permanently deletes {students.length} archived student
              {students.length === 1 ? "" : "s"} and their bus plans. Enter your
              sign-in password to continue.
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
                onClick={deleteAll}
                className="rounded-xl bg-navy px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                {pending ? "Deleting…" : "Yes, delete permanently"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
