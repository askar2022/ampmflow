"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { assignRequestedBus } from "@/app/actions/reception";

export type WaitingStudent = {
  requestId?: string;
  studentId?: string;
  name: string;
  grade: string;
  details: string;
};

export function AssignBusList({ rows }: { rows: WaitingStudent[] }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [buses, setBuses] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [pendingKey, setPendingKey] = useState("");
  const [pending, start] = useTransition();

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((row) =>
      `${row.name} ${row.grade} ${row.details}`.toLowerCase().includes(q),
    );
  }, [query, rows]);

  function keyFor(row: WaitingStudent) {
    return row.requestId || row.studentId || row.name;
  }

  function assign(row: WaitingStudent) {
    const key = keyFor(row);
    const busNumber = (buses[key] || "").trim();
    setError("");
    setMessage("");
    setPendingKey(key);
    start(async () => {
      const result = await assignRequestedBus({
        requestId: row.requestId,
        studentId: row.studentId,
        busNumber,
      });
      setPendingKey("");
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setMessage(result.message);
      setBuses((current) => ({ ...current, [key]: "" }));
      router.refresh();
    });
  }

  return (
    <section>
      <h2 className="font-serif text-2xl">Waiting for a bus or van</h2>
      <p className="mt-1 text-sm text-muted">
        When the bus company emails that a student is on bus 4, search the name
        and type 4.
      </p>

      <label className="mt-3 block text-xs font-semibold uppercase tracking-wider text-muted">
        Search student
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Student name"
          className="mt-1 w-full rounded-xl border border-line bg-card px-3 py-2.5 text-sm font-medium text-navy sm:max-w-sm"
        />
      </label>

      {error ? (
        <p className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-sm text-red">{error}</p>
      ) : null}
      {message ? (
        <p className="mt-3 rounded-xl bg-green-50 px-3 py-2 text-sm text-green-900">
          {message}
        </p>
      ) : null}

      {matches.length ? (
        <div className="mt-3 overflow-x-auto rounded-2xl border border-line bg-card">
          <table className="w-full min-w-[36rem] text-left text-sm">
            <thead className="bg-paper text-muted">
              <tr>
                <th className="px-4 py-3">Student</th>
                <th>Details</th>
                <th className="px-4">Bus number</th>
              </tr>
            </thead>
            <tbody>
              {matches.map((row) => {
                const key = keyFor(row);
                const busy = pending && pendingKey === key;
                return (
                  <tr key={key} className="row-red border-t border-line">
                    <td className="px-4 py-3 font-medium">
                      {row.name}
                      {row.grade ? (
                        <div className="text-xs text-muted">Grade {row.grade}</div>
                      ) : null}
                    </td>
                    <td className="max-w-md text-muted">{row.details}</td>
                    <td className="px-4 py-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <input
                          value={buses[key] || ""}
                          onChange={(event) =>
                            setBuses((current) => ({
                              ...current,
                              [key]: event.target.value,
                            }))
                          }
                          onKeyDown={(event) => {
                            if (event.key === "Enter") {
                              event.preventDefault();
                              assign(row);
                            }
                          }}
                          placeholder="4"
                          className="w-20 rounded-xl border border-line bg-paper px-3 py-2 font-medium"
                          aria-label={`Bus number for ${row.name}`}
                        />
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => assign(row)}
                          className="rounded-full bg-navy px-3 py-2 text-xs font-semibold text-white disabled:opacity-60"
                        >
                          {busy ? "Saving…" : "Assign"}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="mt-3 rounded-2xl border border-line bg-card px-4 py-6 text-sm text-muted">
          {rows.length
            ? "No student on this list matches that name."
            : "No submitted requests yet."}
        </p>
      )}
    </section>
  );
}
