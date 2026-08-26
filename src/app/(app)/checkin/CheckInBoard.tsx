"use client";

import { useTransition } from "react";
import { setBusCheckIn } from "@/app/actions/operations";
import type { EffectiveStudent } from "@/lib/types";

type Row = {
  student: EffectiveStudent;
  checkIn: { status: string } | null;
};

export function CheckInBoard({
  busNumber,
  rows,
}: {
  busNumber: string;
  rows: Row[];
}) {
  const [pending, start] = useTransition();
  const onBus = rows.filter((row) => row.checkIn?.status === "ON_BUS").length;
  const missing = rows.filter((row) => row.checkIn?.status === "MISSING").length;

  return (
    <div className="space-y-4">
      <div className="sticky top-0 z-10 rounded-2xl bg-navy px-4 py-3 text-white">
        <div className="font-serif text-2xl">Bus {busNumber}</div>
        <div className="text-sm text-white/80">
          {rows.length} expected · {onBus} checked in · {missing} missing
        </div>
      </div>
      <div className="space-y-3">
        {rows.map(({ student, checkIn }) => (
          <article key={student.id} className="rounded-2xl border border-line bg-card p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold">{student.fullName}</h2>
                <p className="text-sm text-muted">
                  Grade {student.grade} · {student.teacherName}
                </p>
                <p className="text-sm">{student.homeAddress}</p>
                <p className="text-sm">
                  Parent: {student.parentName} · {student.parentPhone}
                </p>
              </div>
              <span className="text-sm font-semibold">
                {checkIn?.status === "ON_BUS"
                  ? "On bus"
                  : checkIn?.status === "MISSING"
                    ? "Missing"
                    : checkIn?.status === "WRONG"
                      ? "Wrong assignment"
                      : "Not marked"}
              </span>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                disabled={pending}
                onClick={() => start(async () => { await setBusCheckIn(student.id, "ON_BUS"); })}
                className="rounded-full bg-green px-3 py-1.5 text-sm text-white"
              >
                On Bus
              </button>
              <button
                disabled={pending}
                onClick={() => start(async () => { await setBusCheckIn(student.id, "MISSING"); })}
                className="rounded-full bg-red px-3 py-1.5 text-sm text-white"
              >
                Missing / Not Present
              </button>
              <button
                disabled={pending}
                onClick={() => start(async () => { await setBusCheckIn(student.id, "WRONG"); })}
                className="rounded-full border border-line px-3 py-1.5 text-sm"
              >
                Wrong Assignment
              </button>
              <a
                href={`tel:${student.parentPhone.replace(/[^\d+]/g, "")}`}
                className="rounded-full border border-line px-3 py-1.5 text-sm"
              >
                Call Parent
              </a>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
