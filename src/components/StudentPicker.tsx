"use client";

import { useMemo, useState } from "react";

export type StudentOption = {
  id: string;
  firstName: string;
  lastName: string;
  studentId: string;
  grade: string;
};

export function StudentPicker({
  students,
  name = "studentId",
  defaultId = "",
}: {
  students: StudentOption[];
  name?: string;
  defaultId?: string;
}) {
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState(defaultId);
  const [open, setOpen] = useState(!defaultId);

  const selected = students.find((student) => student.id === selectedId);
  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q
      ? students.filter((student) => {
          const hay = [
            student.firstName,
            student.lastName,
            student.studentId,
            student.grade,
          ]
            .join(" ")
            .toLowerCase();
          return hay.includes(q);
        })
      : students;
    return list.slice(0, 25);
  }, [query, students]);

  function choose(student: StudentOption) {
    setSelectedId(student.id);
    setQuery(`${student.firstName} ${student.lastName}`);
    setOpen(false);
  }

  return (
    <div className="relative">
      <input type="hidden" name={name} value={selectedId} />
      <input
        type="search"
        value={query}
        onChange={(event) => {
          const value = event.target.value;
          setQuery(value);
          setOpen(true);
          const q = value.trim().toLowerCase();
          const exact = students.filter((student) => {
            const hay = [
              student.firstName,
              student.lastName,
              student.studentId,
            ]
              .join(" ")
              .toLowerCase();
            return hay === q || student.studentId.toLowerCase() === q;
          });
          if (exact.length === 1) {
            choose(exact[0]);
          } else if (selectedId) {
            setSelectedId("");
          }
        }}
        onFocus={() => setOpen(true)}
        placeholder="Type a name or student ID, then click the student"
        className="mt-1 w-full rounded-xl border border-line px-3 py-2"
        autoComplete="off"
      />
      <p className="mt-2 text-sm text-navy">
        {selected
          ? `Selected: ${selected.firstName} ${selected.lastName} (${selected.studentId})`
          : "Click a student in the list. Typing the name is not enough."}
      </p>
      {open ? (
        <ul className="relative z-20 mt-2 max-h-48 overflow-auto rounded-xl border border-line bg-white shadow-sm">
          {matches.length === 0 ? (
            <li className="px-3 py-2 text-sm text-muted">No matching student.</li>
          ) : (
            matches.map((student) => {
              const active = student.id === selectedId;
              return (
                <li key={student.id}>
                  <button
                    type="button"
                    onClick={() => choose(student)}
                    className={`flex w-full items-center justify-between px-3 py-2 text-left text-sm ${
                      active ? "bg-gold/30 font-semibold text-navy" : "hover:bg-paper"
                    }`}
                  >
                    <span>
                      {student.lastName}, {student.firstName}
                    </span>
                    <span className="text-muted">
                      {student.studentId} · Grade {student.grade}
                    </span>
                  </button>
                </li>
              );
            })
          )}
        </ul>
      ) : null}
    </div>
  );
}
