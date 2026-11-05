"use client";

import { useEffect, useState, useTransition } from "react";
import { loadSmsCostPopup } from "@/app/actions/late-alert";
import {
  formatSmsMoney,
  type SmsCostReport,
} from "@/lib/sms-cost";

export function SmsCostButton({
  schoolId,
  refreshKey = 0,
}: {
  schoolId: string;
  refreshKey?: number;
}) {
  const [open, setOpen] = useState(false);
  const [report, setReport] = useState<SmsCostReport | null>(null);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    start(async () => {
      const result = await loadSmsCostPopup(schoolId);
      if (cancelled) return;
      if (!result.ok) {
        setError(result.error);
        setReport(null);
        return;
      }
      setError("");
      setReport(result.report);
    });
    return () => {
      cancelled = true;
    };
  }, [open, schoolId, refreshKey]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-full border border-line px-4 py-2.5 text-sm font-semibold"
      >
        SMS cost
      </button>
      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-navy/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="sms-cost-title"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-sm rounded-2xl bg-card p-5 shadow-lg"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3
                  id="sms-cost-title"
                  className="font-serif text-2xl text-navy"
                >
                  SMS cost
                </h3>
                <p className="mt-1 text-sm text-muted">
                  8¢ per text · late alerts for this school
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-full border border-line px-3 py-1 text-sm font-semibold"
              >
                Close
              </button>
            </div>

            {pending && !report ? (
              <p className="mt-4 text-sm text-muted">Loading…</p>
            ) : null}
            {error ? <p className="mt-4 text-sm text-red">{error}</p> : null}

            {report ? (
              <div className="mt-4 space-y-3">
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="rounded-xl border border-line bg-paper px-3 py-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted">
                      This week
                    </p>
                    <p className="mt-1 font-extrabold text-navy">
                      {report.weekCount} · {formatSmsMoney(report.weekCents)}
                    </p>
                  </div>
                  <div className="rounded-xl border border-line bg-paper px-3 py-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted">
                      This month
                    </p>
                    <p className="mt-1 font-extrabold text-navy">
                      {report.monthCount} · {formatSmsMoney(report.monthCents)}
                    </p>
                  </div>
                </div>

                {report.rides.length ? (
                  <div className="max-h-56 overflow-auto rounded-xl border border-line">
                    <table className="w-full text-left text-sm">
                      <thead className="sticky top-0 bg-paper text-xs uppercase tracking-wide text-muted">
                        <tr>
                          <th className="px-3 py-2 font-semibold">Bus / van</th>
                          <th className="px-3 py-2 font-semibold">Week</th>
                          <th className="px-3 py-2 font-semibold">Month</th>
                        </tr>
                      </thead>
                      <tbody>
                        {report.rides.map((ride) => (
                          <tr
                            key={ride.rideLabel}
                            className="border-t border-line"
                          >
                            <td className="px-3 py-2 font-semibold text-navy">
                              {ride.rideLabel}
                            </td>
                            <td className="px-3 py-2 text-muted">
                              {ride.weekCount || "—"}
                              {ride.weekCount
                                ? ` · ${formatSmsMoney(
                                    ride.weekCount * report.centsEach,
                                  )}`
                                : ""}
                            </td>
                            <td className="px-3 py-2 text-muted">
                              {ride.monthCount} ·{" "}
                              {formatSmsMoney(
                                ride.monthCount * report.centsEach,
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-sm text-muted">
                    No late-alert texts yet this month.
                  </p>
                )}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </>
  );
}
