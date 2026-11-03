"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { assignRequestedBus } from "@/app/actions/reception";

export type WaitingStudent = {
  requestId?: string;
  studentId?: string;
  name: string;
  grade: string;
};

export function AssignBusList({
  rows,
  buses = [],
  vans = [],
}: {
  rows: WaitingStudent[];
  buses?: string[];
  vans?: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [busNumbers, setBusNumbers] = useState<Record<string, string>>({});
  const [vanNumbers, setVanNumbers] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [pendingKey, setPendingKey] = useState("");
  const [pending, start] = useTransition();

  function keyFor(row: WaitingStudent) {
    return row.requestId || row.studentId || row.name;
  }

  function assign(row: WaitingStudent) {
    const key = keyFor(row);
    const bus = (busNumbers[key] || "").trim();
    const van = (vanNumbers[key] || "").trim();
    if (bus && van) {
      setError("Type the bus or the van, not both.");
      return;
    }
    if (!bus && !van) {
      setError("Type the bus number or the van number.");
      return;
    }
    setError("");
    setMessage("");
    setPendingKey(key);
    start(async () => {
      const result = await assignRequestedBus({
        requestId: row.requestId,
        studentId: row.studentId,
        busNumber: bus || van,
        vehicle: van && !bus ? "van" : "bus",
      });
      setPendingKey("");
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setMessage(result.message);
      setBusNumbers((current) => ({ ...current, [key]: "" }));
      setVanNumbers((current) => ({ ...current, [key]: "" }));
      router.refresh();
    });
  }

  return (
    <section>
      {error ? (
        <p className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-sm text-red">{error}</p>
      ) : null}
      {message ? (
        <p className="mt-3 rounded-xl bg-green-50 px-3 py-2 text-sm text-green-900">
          {message}
        </p>
      ) : null}

      {rows.length ? (
        <div className="mt-3 overflow-x-auto rounded-2xl border border-line bg-card">
          <table className="w-full text-left text-sm">
            <thead className="bg-paper text-base font-bold text-navy">
              <tr>
                <th className="px-4 py-3">Student</th>
                <th>Grade</th>
                <th className="px-4">Bus number</th>
                <th className="px-4">Van number</th>
                <th className="px-4"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const key = keyFor(row);
                const busy = pending && pendingKey === key;
                return (
                  <tr key={key} className="row-red border-t border-line">
                    <td className="px-4 py-3 font-semibold">{row.name}</td>
                    <td>{row.grade.replace(/^grade\s+/i, "") || "—"}</td>
                    <td className="px-4 py-2">
                      <input
                        list="waiting-buses"
                        value={busNumbers[key] || ""}
                        onChange={(event) => {
                          const value = event.target.value;
                          setBusNumbers((current) => ({ ...current, [key]: value }));
                          if (value.trim()) {
                            setVanNumbers((current) => ({ ...current, [key]: "" }));
                          }
                        }}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") {
                            event.preventDefault();
                            assign(row);
                          }
                        }}
                        placeholder="4"
                        className="w-28 rounded-xl border border-line bg-paper px-3 py-2 font-medium"
                        aria-label={`Bus number for ${row.name}`}
                      />
                    </td>
                    <td className="px-4 py-2">
                      <input
                        list="waiting-vans"
                        value={vanNumbers[key] || ""}
                        onChange={(event) => {
                          const value = event.target.value;
                          setVanNumbers((current) => ({ ...current, [key]: value }));
                          if (value.trim()) {
                            setBusNumbers((current) => ({ ...current, [key]: "" }));
                          }
                        }}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") {
                            event.preventDefault();
                            assign(row);
                          }
                        }}
                        placeholder="2"
                        className="w-28 rounded-xl border border-line bg-paper px-3 py-2 font-medium"
                        aria-label={`Van number for ${row.name}`}
                      />
                    </td>
                    <td className="px-4 py-2">
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => assign(row)}
                        className="rounded-full bg-navy px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                      >
                        {busy ? "Saving…" : "Assign"}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {buses.length ? (
            <datalist id="waiting-buses">
              {buses.map((number) => (
                <option key={number} value={number} />
              ))}
            </datalist>
          ) : null}
          {vans.length ? (
            <datalist id="waiting-vans">
              {vans.map((van) => (
                <option key={van.id} value={van.name} />
              ))}
            </datalist>
          ) : null}
        </div>
      ) : (
        <p className="mt-3 rounded-2xl border border-line bg-card px-4 py-6 text-sm text-muted">
          No students waiting. After Front Desk sends a request, the name will
          show here.
        </p>
      )}
    </section>
  );
}
