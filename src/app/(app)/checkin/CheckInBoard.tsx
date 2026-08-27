"use client";

import { useEffect, useState, useTransition } from "react";
import { reportLeftSchool, setBusCheckIn } from "@/app/actions/operations";
import { planSummary } from "@/lib/format";
import type { EffectiveStudent } from "@/lib/types";

type CheckStatus =
  | "ON_BUS"
  | "MISSING"
  | "WRONG"
  | "UNASSIGNED"
  | "LEFT_SCHOOL";

type Row = {
  student: EffectiveStudent;
  checkIn: { status: string } | null;
};

function markLabel(status?: string | null) {
  if (status === "ON_BUS") return "On bus";
  if (status === "MISSING") return "Missing";
  if (status === "UNASSIGNED") return "Not assigned";
  if (status === "WRONG") return "Wrong assignment";
  if (status === "LEFT_SCHOOL") return "Left school";
  return "Not selected yet";
}

function StudentCard({
  student,
  status,
  changeNote,
}: {
  student: EffectiveStudent;
  status?: string | null;
  changeNote?: string;
}) {
  const [current, setCurrent] = useState(status ?? "");
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const phone = student.parentPhone.replace(/[^\d+]/g, "");

  useEffect(() => {
    setCurrent(status ?? "");
  }, [status]);

  function mark(next: CheckStatus) {
    const previous = current;
    setError("");
    setCurrent(next);
    start(async () => {
      const result =
        next === "LEFT_SCHOOL"
          ? await reportLeftSchool(student.id)
          : await setBusCheckIn(student.id, next);
      if (!result?.ok) {
        setCurrent(previous);
        setError(result?.error || "Could not save. Try again.");
      }
    });
  }

  return (
    <article
      className={`rounded-2xl border bg-card p-4 ${
        changeNote ? "row-red border-red border-l-4" : "border-line"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">{student.fullName}</h2>
          <p className="text-sm text-muted">
            Grade {student.grade} · {student.teacherName}
          </p>
          <p className="text-sm">Today: {planSummary(student.pm, "PM")}</p>
          {changeNote ? (
            <p className="mt-1 text-sm font-medium text-red">{changeNote}</p>
          ) : null}
          <p className="text-sm">{student.homeAddress}</p>
        </div>
        <span className="text-sm font-semibold">{markLabel(current)}</span>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={() => mark("ON_BUS")}
          className={`rounded-full px-3 py-1.5 text-sm text-white ${
            current === "ON_BUS" ? "bg-green ring-2 ring-navy" : "bg-green"
          }`}
        >
          On Bus
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => mark("MISSING")}
          className={`rounded-full px-3 py-1.5 text-sm text-white ${
            current === "MISSING" ? "bg-red ring-2 ring-navy" : "bg-red"
          }`}
        >
          Missing
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => mark("UNASSIGNED")}
          className={`rounded-full border px-3 py-1.5 text-sm ${
            current === "UNASSIGNED" || current === "WRONG"
              ? "border-navy bg-paper"
              : "border-line"
          }`}
        >
          Not assigned
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => mark("LEFT_SCHOOL")}
          className={`rounded-full border px-3 py-1.5 text-sm ${
            current === "LEFT_SCHOOL" ? "border-navy bg-paper" : "border-line"
          }`}
        >
          Left school
        </button>
        {phone ? (
          <a
            href={`tel:${phone}`}
            className="rounded-full border border-line px-3 py-1.5 text-sm"
          >
            Call Parent
          </a>
        ) : null}
      </div>
      {error ? <p className="mt-2 text-sm text-red">{error}</p> : null}
    </article>
  );
}

export function CheckInBoard({
  title,
  rows,
  changeNotes = {},
}: {
  title: string;
  rows: Row[];
  changeNotes?: Record<string, string>;
}) {
  const onBus = rows.filter((row) => row.checkIn?.status === "ON_BUS").length;
  const missing = rows.filter((row) => row.checkIn?.status === "MISSING").length;
  const unassigned = rows.filter(
    (row) =>
      row.checkIn?.status === "UNASSIGNED" || row.checkIn?.status === "WRONG",
  ).length;
  const leftSchool = rows.filter(
    (row) => row.checkIn?.status === "LEFT_SCHOOL",
  ).length;

  return (
    <div className="space-y-4">
      <div className="sticky top-0 z-10 rounded-2xl bg-navy px-4 py-3 text-white">
        <div className="font-serif text-2xl">{title}</div>
        <div className="text-sm text-white/80">
          {rows.length} on this list · {onBus} on bus · {missing} missing ·{" "}
          {unassigned} not assigned
          {leftSchool ? ` · ${leftSchool} left school` : ""}
        </div>
      </div>
      {rows.length === 0 ? (
        <p className="rounded-2xl border border-line bg-card p-5 text-sm text-muted">
          No students on this bus today.
        </p>
      ) : null}
      <div className="space-y-3">
        {rows.map(({ student, checkIn }) => (
          <StudentCard
            key={student.id}
            student={student}
            status={checkIn?.status}
            changeNote={changeNotes[student.id]}
          />
        ))}
      </div>
    </div>
  );
}
