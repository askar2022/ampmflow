"use client";

import { useState } from "react";
import type { CoordinatorAnalytics } from "@/lib/analytics";

const TABS = ["Overview", "Changes", "Requests"] as const;

function Dot({ color, label, value }: { color: string; label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-line bg-card px-4 py-5 text-center">
      <div
        className={`mx-auto h-3.5 w-3.5 rounded-full ${color}`}
        aria-hidden
      />
      <div className="mt-3 font-serif text-3xl">{value}</div>
      <div className="mt-1 text-[11px] font-semibold uppercase tracking-wide text-muted">
        {label}
      </div>
    </div>
  );
}

function vehicleLabel(kind: "bus" | "van", name: string) {
  if (kind === "bus") {
    return /^bus\b/i.test(name) ? name : `Bus ${name}`;
  }
  return /van/i.test(name) ? name : `Van ${name}`;
}

function RiderTable({ data }: { data: CoordinatorAnalytics }) {
  const rows = [
    ...data.busCounts.map((row) => ({
      key: `bus-${row.name}`,
      name: vehicleLabel("bus", row.name),
      riders: row.riders,
    })),
    ...data.vanCounts.map((row) => ({
      key: `van-${row.name}`,
      name: vehicleLabel("van", row.name),
      riders: row.riders,
    })),
  ];
  if (!rows.length) return null;
  return (
    <div className="rounded-2xl border border-line bg-card p-5">
      <div className="text-sm font-semibold">Each bus and van</div>
      <p className="mt-1 text-xs text-muted">
        Which routes have more students and which have fewer.
      </p>
      <table className="mt-3 w-full text-sm">
        <thead>
          <tr className="text-left text-muted">
            <th className="pb-2 font-medium">Bus or van</th>
            <th className="pb-2 text-right font-medium">Riders</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.key} className="border-t border-line">
              <td className="py-2">{row.name}</td>
              <td className="py-2 text-right font-semibold">{row.riders}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Card({ label, value, note }: { label: string; value: number; note?: string }) {
  return (
    <div className="rounded-2xl border border-line bg-card p-5">
      <div className="text-sm text-muted">{label}</div>
      <div className="mt-2 font-serif text-3xl">{value}</div>
      {note ? <div className="mt-1 text-xs text-muted">{note}</div> : null}
    </div>
  );
}

function WeekChart({
  weeks,
  showChanges,
  showRequests,
}: {
  weeks: CoordinatorAnalytics["weeks"];
  showChanges: boolean;
  showRequests: boolean;
}) {
  const max = Math.max(
    1,
    ...weeks.flatMap((week) => [
      showChanges ? week.changes : 0,
      showRequests ? week.requests : 0,
    ]),
  );
  return (
    <div className="rounded-2xl border border-line bg-card p-5">
      <div className="text-sm font-semibold">Last four weeks</div>
      <p className="mt-1 text-xs text-muted">
        Taller bars mean more activity that week.
      </p>
      <div className="mt-4 flex items-end justify-around gap-3">
        {weeks.map((week) => (
          <div key={week.start} className="flex flex-1 flex-col items-center gap-2">
            <div className="flex h-28 items-end justify-center gap-1">
              {showChanges ? (
                <div
                  title={`${week.changes} bus changes`}
                  className={`w-4 rounded-t-md bg-blue ${week.changes ? "" : "opacity-30"}`}
                  style={{
                    height: week.changes
                      ? `${Math.max(8, (week.changes / max) * 100)}%`
                      : "4px",
                  }}
                />
              ) : null}
              {showRequests ? (
                <div
                  title={`${week.requests} route requests`}
                  className={`w-4 rounded-t-md bg-teal ${week.requests ? "" : "opacity-30"}`}
                  style={{
                    height: week.requests
                      ? `${Math.max(8, (week.requests / max) * 100)}%`
                      : "4px",
                  }}
                />
              ) : null}
            </div>
            <div className="text-center text-[11px] text-muted">{week.label}</div>
          </div>
        ))}
      </div>
      <div className="mt-4 flex flex-wrap gap-4 text-xs text-muted">
        {showChanges ? (
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm bg-blue" /> Bus changes
          </span>
        ) : null}
        {showRequests ? (
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm bg-teal" /> New route requests
          </span>
        ) : null}
      </div>
    </div>
  );
}

export function AnalyticsBoard({ data }: { data: CoordinatorAnalytics }) {
  const [tab, setTab] = useState<(typeof TABS)[number]>("Overview");

  return (
    <div className="space-y-8">
      <section>
        <h2 className="font-serif text-2xl">Today</h2>
        <p className="mt-1 text-sm text-muted">
          What is on the roster right now.
        </p>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Dot color="bg-blue" label="Students" value={data.students} />
          <Dot color="bg-navy" label="Bus riders" value={data.busRiders} />
          <Dot color="bg-teal" label="Van riders" value={data.vanRiders} />
          <Dot color="bg-green" label="Waiting for a bus" value={data.waiting} />
        </div>
        <div className="mt-4">
          <RiderTable data={data} />
        </div>
      </section>

      <section>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="font-serif text-2xl">This week and month</h2>
            <p className="mt-1 text-sm text-muted">
              {data.weekLabel}. How often staff change a bus or request a new
              route.
            </p>
          </div>
        </div>
        <div className="mt-4 inline-flex flex-wrap gap-1 rounded-full bg-navy-deep p-1 text-white">
          {TABS.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setTab(item)}
              className={`rounded-full px-3 py-1.5 text-sm font-medium ${
                tab === item
                  ? "bg-nav-active text-teal-deep"
                  : "text-white hover:bg-white/10"
              }`}
            >
              {item}
            </button>
          ))}
        </div>

        {tab === "Overview" ? (
          <div className="mt-4 space-y-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <Card
                label="Bus changes this week"
                value={data.changesWeek}
                note={data.weekLabel}
              />
              <Card
                label="New route requests this week"
                value={data.requestsWeek}
                note={data.weekLabel}
              />
              <Card
                label="Still waiting"
                value={data.pendingRequests}
                note="On Request for Route"
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Card
                label="Bus changes this month"
                value={data.changesMonth}
                note={data.monthLabel}
              />
              <Card
                label="New route requests this month"
                value={data.requestsMonth}
                note={data.monthLabel}
              />
            </div>
            <WeekChart weeks={data.weeks} showChanges showRequests />
          </div>
        ) : null}

        {tab === "Changes" ? (
          <div className="mt-4 space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <Card label="This week" value={data.changesWeek} note={data.weekLabel} />
              <Card label="This month" value={data.changesMonth} note={data.monthLabel} />
            </div>
            <WeekChart weeks={data.weeks} showChanges showRequests={false} />
          </div>
        ) : null}

        {tab === "Requests" ? (
          <div className="mt-4 space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <Card label="This week" value={data.requestsWeek} note={data.weekLabel} />
              <Card label="This month" value={data.requestsMonth} note={data.monthLabel} />
            </div>
            <WeekChart weeks={data.weeks} showChanges={false} showRequests />
          </div>
        ) : null}
      </section>
    </div>
  );
}
