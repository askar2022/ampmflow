"use client";

import { useTransition } from "react";
import { setBusCheckIn } from "@/app/actions/operations";
import { planSummary } from "@/lib/format";
import type { EffectiveStudent } from "@/lib/types";

type Row = {
  student: EffectiveStudent;
  checkIn: { status: string } | null;
};

function markLabel(status?: string | null) {
  if (status === "ON_BUS") return "On bus";
  if (status === "MISSING") return "Missing";
  if (status === "UNASSIGNED") return "Not assigned";
  if (status === "WRONG") return "Wrong assignment";
  return "Not marked";
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
  const [pending, start] = useTransition();
  const onBus = rows.filter((row) => row.checkIn?.status === "ON_BUS").length;
  const missing = rows.filter((row) => row.checkIn?.status === "MISSING").length;
  const unassigned = rows.filter(
    (row) =>
      row.checkIn?.status === "UNASSIGNED" || row.checkIn?.status === "WRONG",
  ).length;

  return (
    <div className="space-y-4">
      <div className="sticky top-0 z-10 rounded-2xl bg-navy px-4 py-3 text-white">
        <div className="font-serif text-2xl">{title}</div>
        <div className="text-sm text-white/80">
          {rows.length} on this list · {onBus} on bus · {missing} missing ·{" "}
          {unassigned} not assigned
        </div>
      </div>
      {rows.length === 0 ? (
        <p className="rounded-2xl border border-line bg-card p-5 text-sm text-muted">
          No students on this bus today.
        </p>
      ) : null}
      <div className="space-y-3">
        {rows.map(({ student, checkIn }) => {
          const phone = student.parentPhone.replace(/[^\d+]/g, "");
          return (
            <article
              key={student.id}
              className={`rounded-2xl border bg-card p-4 ${
                changeNotes[student.id]
                  ? "row-red border-red border-l-4"
                  : "border-line"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-xl font-semibold">{student.fullName}</h2>
                  <p className="text-sm text-muted">
                    Grade {student.grade} · {student.teacherName}
                  </p>
                  <p className="text-sm">
                    Today: {planSummary(student.pm, "PM")}
                  </p>
                  {changeNotes[student.id] ? (
                    <p className="mt-1 text-sm font-medium text-red">
                      {changeNotes[student.id]}
                    </p>
                  ) : null}
                  <p className="text-sm">{student.homeAddress}</p>
                </div>
                <span className="text-sm font-semibold">{markLabel(checkIn?.status)}</span>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={pending}
                  onClick={() =>
                    start(async () => {
                      await setBusCheckIn(student.id, "ON_BUS");
                    })
                  }
                  className="rounded-full bg-green px-3 py-1.5 text-sm text-white"
                >
                  On Bus
                </button>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() =>
                    start(async () => {
                      await setBusCheckIn(student.id, "MISSING");
                    })
                  }
                  className="rounded-full bg-red px-3 py-1.5 text-sm text-white"
                >
                  Missing
                </button>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() =>
                    start(async () => {
                      await setBusCheckIn(student.id, "UNASSIGNED");
                    })
                  }
                  className="rounded-full border border-line px-3 py-1.5 text-sm"
                >
                  Not assigned
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
            </article>
          );
        })}
      </div>
    </div>
  );
}
