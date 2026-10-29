"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { restoreSchoolRoster, restoreStudent } from "@/app/actions/roster";

type ArchivedStudent = {
  id: string;
  firstName: string;
  lastName: string;
  grade: string;
};

export function StudentArchive({ students }: { students: ArchivedStudent[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [message, setMessage] = useState("");

  if (!students.length) return null;

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
            restores them.
          </p>
          <div className="mt-3">
            <button
              type="button"
              disabled={pending}
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
              className="rounded-xl border border-line px-4 py-2 text-sm font-semibold"
            >
              {pending ? "Working…" : "Put all back"}
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
    </section>
  );
}
