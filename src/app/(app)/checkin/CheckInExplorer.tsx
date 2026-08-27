"use client";

import { useMemo, useState } from "react";
import type { EffectiveStudent } from "@/lib/types";
import { CheckInBoard } from "./CheckInBoard";

type Row = {
  student: EffectiveStudent;
  checkIn: { status: string } | null;
};

function busKey(row: Row) {
  return row.student.pm.busNumber || "No bus yet";
}

function matchesSearch(student: EffectiveStudent, query: string) {
  if (!query) return true;
  const hay = [
    student.fullName,
    student.firstName,
    student.lastName,
    student.studentId,
    student.grade,
    student.parentName,
    student.teacherName,
    student.homeAddress,
    student.pm.busNumber,
  ]
    .join(" ")
    .toLowerCase();
  return hay.includes(query);
}

export function CheckInExplorer({
  rows,
  changeNotes = {},
  initialBus = "",
}: {
  rows: Row[];
  changeNotes?: Record<string, string>;
  initialBus?: string;
}) {
  const [query, setQuery] = useState("");
  const [bus, setBus] = useState(initialBus);

  const buses = useMemo(() => {
    const numbers = [
      ...new Set(
        rows
          .map((row) => row.student.pm.busNumber)
          .filter((number): number is string => Boolean(number)),
      ),
    ];
    return numbers.sort((a, b) => Number(a) - Number(b) || a.localeCompare(b));
  }, [rows]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((row) => {
      if (bus && row.student.pm.busNumber !== bus) return false;
      return matchesSearch(row.student, q);
    });
  }, [rows, query, bus]);

  const groups = useMemo(() => {
    const byBus = new Map<string, Row[]>();
    for (const row of filtered) {
      const number = busKey(row);
      const list = byBus.get(number) ?? [];
      list.push(row);
      byBus.set(number, list);
    }
    return [...byBus.entries()].sort(
      ([a], [b]) => Number(a) - Number(b) || a.localeCompare(b),
    );
  }, [filtered]);

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search a name, student ID, or parent"
          className="w-full rounded-xl border border-line bg-card px-3 py-2.5"
        />
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setBus("")}
            className={`rounded-full px-3 py-1.5 text-sm ${
              bus === ""
                ? "bg-navy text-white"
                : "border border-line bg-card"
            }`}
          >
            All buses
          </button>
          {buses.map((number) => (
            <button
              type="button"
              key={number}
              onClick={() => setBus(number)}
              className={`rounded-full px-3 py-1.5 text-sm ${
                bus === number
                  ? "bg-navy text-white"
                  : "border border-line bg-card"
              }`}
            >
              Bus {number}
            </button>
          ))}
        </div>
        <p className="text-sm text-muted">
          Showing {filtered.length} of {rows.length} students
          {bus ? ` on Bus ${bus}` : ""}.
        </p>
      </div>

      {groups.length === 0 ? (
        <p className="rounded-2xl border border-line bg-card p-5 text-sm text-muted">
          No students match. Clear the search or tap All buses.
        </p>
      ) : null}

      {groups.map(([number, groupRows]) => (
        <CheckInBoard
          key={number}
          title={number === "No bus yet" ? "Waiting for a bus" : `Bus ${number}`}
          rows={groupRows}
          changeNotes={changeNotes}
        />
      ))}
    </div>
  );
}
