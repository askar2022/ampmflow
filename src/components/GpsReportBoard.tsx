"use client";

import { useEffect, useState, useTransition } from "react";
import { loadGpsReportDay } from "@/app/actions/gps";
import { formatGpsClock } from "@/lib/gps-log";

type TripRow = {
  busLabel: string;
  company: string;
  trip: string;
  dayKey: string;
  firstPickupAt: string | null;
  arrivedSchoolAt: string | null;
  leftSchoolAt: string | null;
  lastStopAt: string | null;
};

export function GpsReportBoard({
  schoolName,
  schoolId,
  initialDayKey,
  initialDays,
  initialRows,
  embedded = false,
}: {
  schoolName: string;
  schoolId: string;
  initialDayKey: string;
  initialDays: Array<{ dayKey: string; count: number }>;
  initialRows: TripRow[];
  embedded?: boolean;
}) {
  const [dayKey, setDayKey] = useState(initialDayKey);
  const [days, setDays] = useState(initialDays);
  const [rows, setRows] = useState(initialRows);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();

  const dayOptions = [
    ...new Map(
      [{ dayKey: initialDayKey, count: 0 }, ...days].map((d) => [d.dayKey, d]),
    ).values(),
  ].sort((a, b) => b.dayKey.localeCompare(a.dayKey));

  function loadDay(next: string) {
    setDayKey(next);
    start(async () => {
      const result = await loadGpsReportDay({ schoolId, dayKey: next });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setRows(result.rows);
      setDays(result.days);
      setError("");
    });
  }

  useEffect(() => {
    loadDay(dayKey || initialDayKey);
    const timer = window.setInterval(() => {
      loadDay(dayKey || initialDayKey);
    }, 30000);
    return () => window.clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schoolId]);

  return (
    <div id="gps-report" className="space-y-5 scroll-mt-24">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          {embedded ? (
            <h2 className="font-serif text-2xl text-navy">GPS Report</h2>
          ) : (
            <h1 className="font-serif text-4xl text-navy">GPS Report</h1>
          )}
          <p className="mt-1 text-muted">
            {/aim/i.test(schoolName)
              ? `${schoolName} · Minnehaha’s 3 Aim buses only (Bus 4, Bus 5, 3rd bus)`
              : `${schoolName} · GPS history for this school only`}
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <label className="text-sm font-semibold text-navy">
            History day
            <select
              className="ml-2 min-h-[40px] rounded-lg border border-line bg-white px-3 py-2 font-medium"
              value={dayKey}
              onChange={(e) => loadDay(e.target.value)}
            >
              {dayOptions.map((day) => (
                <option key={day.dayKey} value={day.dayKey}>
                  {day.dayKey}
                  {day.count ? ` · ${day.count} events` : ""}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            disabled={pending}
            onClick={() => loadDay(dayKey || initialDayKey)}
            className="min-h-[40px] rounded-lg border border-line bg-white px-3 py-2 text-sm font-semibold text-navy disabled:opacity-60"
          >
            {pending ? "Updating…" : "Refresh times"}
          </button>
        </div>
      </div>

      <p className="rounded-2xl border border-line bg-paper px-4 py-3 text-sm text-muted">
        Each bus is timed on its own. A bus parked at headquarters does not
        count as a pickup. When a bus reaches school (like Bus 5 drop-off),
        Arrived school fills in. First pickup and last stop only after the bus
        really moves on the route.
        {pending ? " Updating…" : ""}
      </p>

      {error ? (
        <p className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          {error}
        </p>
      ) : null}

      <div className="overflow-x-auto rounded-2xl border border-line bg-card shadow-sm">
        <table className="w-full min-w-[52rem] text-left text-sm">
          <thead>
            <tr className="border-b border-line bg-paper text-navy">
              <th className="px-4 py-3 font-bold">Bus</th>
              <th className="px-3 py-3 font-bold">Trip</th>
              <th className="px-3 py-3 font-bold">First stop pickup</th>
              <th className="px-3 py-3 font-bold">Arrived school</th>
              <th className="px-3 py-3 font-bold">Left school (drop-off)</th>
              <th className="px-3 py-3 font-bold">Last student stop</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={`${row.busLabel}-${row.trip}`}
                className="border-b border-line last:border-0"
              >
                <td className="px-4 py-3 font-semibold text-navy">
                  {row.company} · {row.busLabel}
                </td>
                <td className="px-3 py-3">{row.trip}</td>
                <td className="px-3 py-3">
                  {formatGpsClock(row.firstPickupAt)}
                </td>
                <td className="px-3 py-3">
                  {formatGpsClock(row.arrivedSchoolAt)}
                </td>
                <td className="px-3 py-3">
                  {formatGpsClock(row.leftSchoolAt)}
                </td>
                <td className="px-3 py-3">{formatGpsClock(row.lastStopAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
