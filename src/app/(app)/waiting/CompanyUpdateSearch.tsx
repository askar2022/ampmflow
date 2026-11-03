"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

export function CompanyUpdateSearch({
  students,
}: {
  students: { id: string; name: string; grade: string }[];
}) {
  const [query, setQuery] = useState("");
  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return students
      .filter((student) =>
        `${student.name} ${student.grade}`.toLowerCase().includes(q),
      )
      .slice(0, 8);
  }, [query, students]);

  return (
    <section className="rounded-2xl border border-line bg-card p-5">
      <h2 className="font-serif text-2xl">Daycare or new address</h2>
      <p className="mt-1 text-sm text-muted">
        When the company emails that a student’s daycare or drop-off address
        changed, search the name here. Front Desk opens Change Transportation.
        Choose Daycare bus or New address, save, and parent, teacher, and the
        bus company are notified.
      </p>
      <label className="mt-4 block text-xs font-semibold uppercase tracking-wider text-muted">
        Search student already on the roster
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Student name"
          className="mt-1 w-full rounded-xl border border-line bg-paper px-3 py-2.5 text-sm font-medium text-navy sm:max-w-sm"
        />
      </label>
      {query.trim() && !matches.length ? (
        <p className="mt-3 text-sm text-muted">No student matches that name.</p>
      ) : null}
      {matches.length ? (
        <ul className="mt-3 divide-y divide-line rounded-xl border border-line">
          {matches.map((student) => (
            <li
              key={student.id}
              className="flex flex-wrap items-center justify-between gap-2 px-4 py-3"
            >
              <div>
                <div className="font-medium text-navy">{student.name}</div>
                {student.grade ? (
                  <div className="text-xs text-muted">Grade {student.grade}</div>
                ) : null}
              </div>
              <Link
                href={`/dashboard?student=${student.id}`}
                className="rounded-full bg-navy px-3 py-2 text-xs font-semibold text-white"
              >
                Change daycare or address
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
