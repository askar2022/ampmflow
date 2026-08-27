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

  return (
    <div>
      <input type="hidden" name={name} value={selectedId} />
      <input
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Type a name or student ID"
        className="mt-1 w-full rounded-xl border border-line px-3 py-2"
        autoComplete="off"
      />
      <p className="mt-2 text-sm text-navy">
        {selected
          ? `Selected: ${selected.firstName} ${selected.lastName} (${selected.studentId})`
          : "No student selected yet."}
      </p>
      <ul className="mt-2 max-h-48 overflow-auto rounded-xl border border-line bg-white">
        {matches.length === 0 ? (
          <li className="px-3 py-2 text-sm text-muted">No matching student.</li>
        ) : (
          matches.map((student) => {
            const active = student.id === selectedId;
            return (
              <li key={student.id}>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedId(student.id);
                    setQuery(`${student.firstName} ${student.lastName}`);
                  }}
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
    </div>
  );
}
