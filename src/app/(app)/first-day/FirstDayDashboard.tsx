"use client";

import { useState, useTransition } from "react";
import { emailLeadershipAction } from "@/app/actions/gate";
import type { GateCounts } from "@/lib/gate";

function Card({
  label,
  value,
  detail,
  tone,
}: {
  label: string;
  value: string | number;
  detail?: string;
  tone?: "red" | "orange" | "yellow" | "green" | "blue" | "navy";
}) {
  const tones = {
    red: "border-red bg-red-50",
    orange: "border-orange bg-orange-50",
    yellow: "border-yellow bg-yellow-50",
    green: "border-green bg-green-50",
    blue: "border-blue bg-blue-50",
    navy: "border-line bg-card",
  };
  return (
    <div className={`rounded-2xl border p-5 ${tones[tone || "navy"]}`}>
      <div className="text-sm font-semibold">{label}</div>
      <div className="mt-2 font-serif text-3xl">{value}</div>
      {detail ? <div className="mt-1 text-sm text-muted">{detail}</div> : null}
    </div>
  );
}

function Bar({
  label,
  value,
  max,
  tone,
}: {
  label: string;
  value: number;
  max: number;
  tone: string;
}) {
  const width = max ? Math.max(6, Math.round((value / max) * 100)) : 6;
  return (
    <div>
      <div className="flex justify-between text-sm">
        <span>{label}</span>
        <span className="font-semibold">{value}</span>
      </div>
      <div className="mt-1 h-3 rounded-full bg-line">
        <div
          className={`h-3 rounded-full tone-bar-${tone}`}
          style={{ width: `${width}%` }}
        />
      </div>
    </div>
  );
}

export function FirstDayDashboard({
  counts,
  lastUpdated,
}: {
  counts: GateCounts;
  lastUpdated: string;
}) {
  const [pending, start] = useTransition();
  const [emailTo, setEmailTo] = useState("");
  const [message, setMessage] = useState("");
  const amMax = Math.max(
    counts.parentDropOff,
    counts.busDropOff,
    counts.notCheckedIn,
    counts.confirmedAbsences,
    1,
  );
  const pmMax = Math.max(
    counts.parentPickupConfirmed.students,
    counts.pickupTodayBusTomorrow.students,
    counts.confirmedBus.students,
    counts.notConfirmed.students,
    1,
  );

  return (
    <div className="space-y-8">
      <div className="no-print flex flex-wrap gap-2">
        <button
          type="button"
          className="action-button-secondary rounded-xl px-4 py-2 text-sm font-bold"
          onClick={() => window.print()}
        >
          Print Dashboard
        </button>
        <a
          className="action-button-secondary rounded-xl px-4 py-2 text-sm font-bold"
          href="/first-day/export"
        >
          Export Dashboard
        </a>
        <input
          className="min-h-10 rounded-xl border border-line px-3 text-sm"
          placeholder="Extra email (optional)"
          value={emailTo}
          onChange={(e) => setEmailTo(e.target.value)}
        />
        <button
          type="button"
          className="action-button rounded-xl px-4 py-2 text-sm font-bold"
          disabled={pending}
          onClick={() => {
            start(async () => {
              const result = await emailLeadershipAction(emailTo);
              setMessage(
                result.ok
                  ? `Emailed leadership: ${result.to.join(", ")}.`
                  : result.error || "Email failed.",
              );
            });
          }}
        >
          Email Leadership
        </button>
      </div>
      <p className="text-sm text-muted">Last updated {lastUpdated}</p>
      {counts.parentDropOff +
        counts.busDropOff +
        counts.notCheckedIn +
        counts.confirmedAbsences !==
        counts.totalStudents ||
      counts.parentPickupConfirmed.students +
        counts.pickupTodayBusTomorrow.students +
        counts.confirmedBus.students +
        counts.notConfirmed.students !==
        counts.totalStudents ? (
        <p className="text-sm font-semibold text-red">
          Category totals do not match the master list. Refresh and review The
          Gate.
        </p>
      ) : (
        <p className="text-sm text-muted">
          AM and PM category totals match the {counts.totalStudents} students on
          the master list.
        </p>
      )}
      {message ? <p className="text-sm font-semibold">{message}</p> : null}

      <section>
        <h2 className="font-serif text-2xl">Enrollment and attendance</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card label="Total students" value={counts.totalStudents} />
          <Card label="Unique families" value={counts.totalFamilies} />
          <Card
            label="Returning"
            value={counts.returning}
            detail={`${counts.newApplication} new applications`}
          />
          <Card label="Students checked in" value={counts.checkedIn} tone="green" />
          <Card
            label="Not checked in"
            value={counts.notCheckedIn}
            tone="yellow"
          />
          <Card
            label="Confirmed absences"
            value={counts.confirmedAbsences}
            tone="red"
          />
          <Card label="Arriving late" value={counts.arrivingLate} tone="orange" />
          <Card
            label="Absent because of no bus"
            value={counts.absentNoBus}
            tone="orange"
          />
          <Card label="Absent because of illness" value={counts.absentSick} />
          <Card
            label="Transferred to another school"
            value={counts.transferred}
          />
          <Card
            label="Unable to reach family"
            value={counts.unableToReach}
            tone="red"
          />
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-line bg-card p-5 print-sheet">
          <h2 className="font-serif text-2xl">AM Arrival</h2>
          <div className="mt-4 space-y-3">
            <Bar label="Parent Drop-Off" value={counts.parentDropOff} max={amMax} tone="green" />
            <Bar label="Bus Drop-Off" value={counts.busDropOff} max={amMax} tone="blue" />
            <Bar label="Not Checked In" value={counts.notCheckedIn} max={amMax} tone="yellow" />
            <Bar
              label="Absent—Confirmed"
              value={counts.confirmedAbsences}
              max={amMax}
              tone="red"
            />
          </div>
        </div>
        <div className="rounded-2xl border border-line bg-card p-5 print-sheet">
          <h2 className="font-serif text-2xl">PM Dismissal</h2>
          <div className="mt-4 space-y-3">
            <Bar
              label={`Parent Pickup—Confirmed · ${counts.parentPickupConfirmed.families} families`}
              value={counts.parentPickupConfirmed.students}
              max={pmMax}
              tone="blue"
            />
            <Bar
              label={`Bus Needed Tomorrow · ${counts.pickupTodayBusTomorrow.families} families`}
              value={counts.pickupTodayBusTomorrow.students}
              max={pmMax}
              tone="orange"
            />
            <Bar
              label={`Confirmed Bus · ${counts.confirmedBus.families} families`}
              value={counts.confirmedBus.students}
              max={pmMax}
              tone="green"
            />
            <Bar
              label={`Not Confirmed · ${counts.notConfirmed.families} families`}
              value={counts.notConfirmed.students}
              max={pmMax}
              tone="yellow"
            />
          </div>
          <p className="mt-4 font-semibold text-orange">
            Bus Needed Tomorrow: {counts.pickupTodayBusTomorrow.students} students
            from {counts.pickupTodayBusTomorrow.families} families
          </p>
        </div>
      </section>
    </div>
  );
}
