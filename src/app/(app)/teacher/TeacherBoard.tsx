"use client";

import { useMemo, useState, useTransition } from "react";
import {
  acknowledgeAllMine,
  acknowledgeChange,
  reportTeacherConcern,
} from "@/app/actions/operations";
import { planSummary, planTone } from "@/lib/format";
import { StatusBadge } from "@/components/StatusBadge";
import type { EffectiveStudent } from "@/lib/types";

type Pending = {
  id: string;
  studentName: string;
  at: string;
  by: string;
  from: string;
  to: string;
};

export function TeacherBoard({
  heading,
  students,
  pending,
}: {
  heading: string;
  students: EffectiveStudent[];
  pending: Pending[];
}) {
  const [filter, setFilter] = useState<"all" | "bus" | "pickup" | "changes">("all");
  const [pendingAction, start] = useTransition();

  const groups = useMemo(() => {
    const buses = new Map<string, number>();
    let pickup = 0;
    for (const student of students) {
      if (student.pm.type === "PARENT") pickup += 1;
      if (student.pm.busNumber) {
        buses.set(student.pm.busNumber, (buses.get(student.pm.busNumber) ?? 0) + 1);
      }
    }
    return { buses: [...buses.entries()].sort((a, b) => Number(a[0]) - Number(b[0])), pickup };
  }, [students]);

  const visible = students
    .filter((student) => {
      if (filter === "pickup") return student.pm.type === "PARENT";
      if (filter === "bus") return student.pm.type === "BUS";
      if (filter === "changes") {
        return student.pm.source === "TODAY" || student.pm.source === "DATE_RANGE";
      }
      return true;
    })
    .sort((a, b) => {
      const aChange = a.pm.source === "TODAY" || a.pm.source === "DATE_RANGE" ? 0 : 1;
      const bChange = b.pm.source === "TODAY" || b.pm.source === "DATE_RANGE" ? 0 : 1;
      return aChange - bChange || a.lastName.localeCompare(b.lastName);
    });

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <div>
        <h1 className="font-serif text-3xl">{heading}</h1>
        <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
          {groups.buses.map(([number, count]) => (
            <div key={number} className="rounded-xl bg-card px-3 py-2 border border-line">
              Bus {number}: {count} students
            </div>
          ))}
          <div className="rounded-xl border border-line bg-card px-3 py-2">
            Parent pickup: {groups.pickup} students
          </div>
          <div className="rounded-xl border border-line bg-card px-3 py-2">
            Changes today: {pending.length} students
          </div>
        </div>
      </div>

      {pending.length ? (
        <section className="rounded-2xl border border-orange-400 bg-orange-50 p-4">
          <h2 className="font-semibold">⚠️ Last-minute change not yet acknowledged</h2>
          {pending.map((item) => (
            <p key={item.id} className="mt-2 text-sm">
              Changed at {item.at} by {item.by}: {item.studentName} · {item.from} → {item.to}
            </p>
          ))}
          <button
            disabled={pendingAction}
            onClick={() => start(async () => { await acknowledgeAllMine(); })}
            className="mt-3 rounded-full bg-navy px-4 py-2 text-sm font-semibold text-white"
          >
            Acknowledge changes
          </button>
        </section>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {(
          [
            ["all", "All students"],
            ["changes", "Changes today"],
            ["bus", "View bus groups"],
            ["pickup", "View parent pickup"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={`rounded-full px-3 py-1.5 text-sm ${
              filter === key ? "bg-navy text-white" : "border border-line bg-card"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {visible.map((student) => {
          const change = pending.find((item) => item.studentName === student.fullName);
          const tone = change ? "orange" : planTone(student.pm);
          return (
            <article
              key={student.id}
              className={`row-${tone} rounded-2xl border border-line p-4`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-xl font-semibold">{student.fullName}</h2>
                  <p className="text-sm text-muted">
                    Grade {student.grade} · {planSummary(student.pm, "PM")}
                  </p>
                </div>
                <StatusBadge tone={tone} />
              </div>
              {change ? (
                <p className="mt-2 text-sm font-medium">
                  Changed at {change.at} by {change.by}
                </p>
              ) : null}
              <div className="mt-3 flex flex-wrap gap-2">
                <a
                  href="tel:"
                  className="rounded-full border border-line bg-white px-3 py-1.5 text-sm"
                >
                  Call Office
                </a>
                {change ? (
                  <button
                    onClick={() => start(async () => { await acknowledgeChange(change.id); })}
                    className="rounded-full bg-navy px-3 py-1.5 text-sm text-white"
                  >
                    Acknowledged
                  </button>
                ) : null}
              </div>
            </article>
          );
        })}
      </div>

      <form action={reportTeacherConcern} className="rounded-2xl border border-line bg-card p-4">
        <h2 className="font-serif text-xl">Report a problem</h2>
        <select name="studentId" className="mt-2 w-full rounded-xl border border-line px-3 py-2">
          <option value="">Whole class / not sure</option>
          {students.map((s) => (
            <option key={s.id} value={s.id}>
              {s.fullName}
            </option>
          ))}
        </select>
        <textarea
          name="details"
          required
          rows={3}
          className="mt-2 w-full rounded-xl border border-line px-3 py-2"
          placeholder="Tell the coordinator what you are seeing."
        />
        <button className="mt-3 rounded-full bg-navy px-4 py-2 text-sm font-semibold text-white">
          Send to coordinator
        </button>
      </form>
    </div>
  );
}
