"use client";

import { useMemo, useState, useTransition } from "react";
import { emailDriverList } from "@/app/actions/ridership";
import type { DriverRider, DriverVan } from "@/lib/ridership";

type Selected =
  | { kind: "bus"; id: string }
  | { kind: "van"; id: string }
  | null;

function norm(value: string) {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

function vehicleLabel(kind: "bus" | "van", id: string, vans: DriverVan[]) {
  if (kind === "bus") return `Bus ${id}`;
  return vans.find((van) => van.id === id)?.name || "Van";
}

function phoneHref(value: string) {
  const digits = value.replace(/[^\d+]/g, "");
  return digits.length >= 7 ? `tel:${digits}` : "";
}

function hasParentPhone(value: string) {
  return Boolean(phoneHref(value));
}

function gradeOnly(value: string) {
  return value.replace(/^grade\s+/i, "").trim() || value;
}

function BusIcon() {
  return (
    <svg
      viewBox="0 0 64 40"
      className="mx-auto h-14 w-20 text-navy"
      aria-hidden="true"
    >
      <rect x="4" y="8" width="48" height="22" rx="4" fill="#087f6b" />
      <rect x="10" y="12" width="12" height="8" rx="1" fill="#ffffff" />
      <rect x="26" y="12" width="12" height="8" rx="1" fill="#ffffff" />
      <rect x="42" y="12" width="6" height="8" rx="1" fill="#f4d35e" />
      <rect x="52" y="16" width="8" height="14" rx="2" fill="#0b2942" />
      <circle cx="16" cy="32" r="5" fill="#0b2942" />
      <circle cx="16" cy="32" r="2" fill="#f4d35e" />
      <circle cx="44" cy="32" r="5" fill="#0b2942" />
      <circle cx="44" cy="32" r="2" fill="#f4d35e" />
    </svg>
  );
}

export function DriverLists({
  riders,
  buses,
  vans,
  busDrivers = {},
  aimSchool = false,
}: {
  riders: DriverRider[];
  buses: string[];
  vans: DriverVan[];
  busDrivers?: Record<string, string>;
  aimSchool?: boolean;
}) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Selected>(null);
  const [to, setTo] = useState("");
  const [message, setMessage] = useState("");
  const [pending, start] = useTransition();

  const q = norm(query);
  const visibleBuses = buses.filter((number) => {
    if (!q) return true;
    const label = `bus ${number}`;
    return label.includes(q) || number.includes(q) || q.includes(number);
  });
  const visibleVans = vans.filter((van) => {
    if (!q) return true;
    return norm(van.name).includes(q) || q.includes(norm(van.name));
  });

  const namedStudents = useMemo(() => {
    if (!q || q.startsWith("bus") || q.startsWith("van") || /^\d/.test(q)) {
      return [];
    }
    return riders.filter((rider) =>
      [
        rider.name,
        rider.studentId,
        rider.grade,
        rider.teacherName,
        rider.parentName,
        rider.parentPhone,
      ]
        .join(" ")
        .toLowerCase()
        .includes(q),
    );
  }, [q, riders]);

  const active: Selected =
    selected ||
    (visibleBuses.length === 1 && visibleVans.length === 0 && q
      ? { kind: "bus", id: visibleBuses[0] }
      : visibleVans.length === 1 && visibleBuses.length === 0 && q
        ? { kind: "van", id: visibleVans[0].id }
        : namedStudents.length && namedStudents[0].buses[0]
          ? { kind: "bus", id: namedStudents[0].buses[0] }
          : namedStudents.length && namedStudents[0].vanId
            ? { kind: "van", id: namedStudents[0].vanId }
            : null);

  const rows = active
    ? riders.filter((rider) =>
        active.kind === "bus"
          ? rider.buses.includes(active.id)
          : rider.vanId === active.id,
      )
    : [];
  const title = active ? vehicleLabel(active.kind, active.id, vans) : "";
  const driverName = active
    ? active.kind === "bus"
      ? busDrivers[active.id] || ""
      : vans.find((van) => van.id === active.id)?.driverName || ""
    : "";

  function choose(next: Selected) {
    setSelected(next);
    setMessage("");
    if (next?.kind === "bus") setQuery(`Bus ${next.id}`);
    if (next?.kind === "van") {
      const name = vans.find((van) => van.id === next.id)?.name || "Van";
      setQuery(name);
    }
  }

  function vehicleButtonClass(on: boolean) {
    return `min-h-[44px] rounded-[12px] px-4 text-[14px] font-semibold ${
      on
        ? "bg-teal-deep text-white"
        : "border border-line bg-paper text-navy"
    }`;
  }

  return (
    <div className="space-y-5">
      <section className="no-print rounded-[12px] border border-line bg-card p-5 shadow-sm">
        <label className="block text-xs font-semibold uppercase tracking-wider text-muted">
          Select a Vehicle
          <input
            type="search"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setSelected(null);
              setMessage("");
            }}
            placeholder={
              aimSchool ? "Bus 4, Bus 5, or 3rd bus" : "Bus 1 or Van 1"
            }
            className="mt-2 min-h-[44px] w-full rounded-[12px] border border-line bg-paper px-4 text-base font-medium text-navy outline-none focus:border-teal"
          />
        </label>
        <div className="mt-4 flex flex-wrap gap-2">
          {visibleBuses.map((number) => (
            <button
              key={`bus-${number}`}
              type="button"
              onClick={() => choose({ kind: "bus", id: number })}
              className={vehicleButtonClass(
                Boolean(active?.kind === "bus" && active.id === number),
              )}
            >
              Bus {number}
            </button>
          ))}
          {visibleVans.map((van) => (
            <button
              key={van.id}
              type="button"
              onClick={() => choose({ kind: "van", id: van.id })}
              className={vehicleButtonClass(
                Boolean(active?.kind === "van" && active.id === van.id),
              )}
            >
              {van.name}
            </button>
          ))}
        </div>
        {!buses.length && !vans.length ? (
          <p className="mt-3 text-sm text-muted">
            {aimSchool
              ? "No bus assignments yet. Assign students to Bus 4, Bus 5, or the 3rd bus, then search here."
              : "No bus or van assignments yet. Save a bus number on Front Desk, or assign a van, then search here."}
          </p>
        ) : null}
      </section>

      {active ? (
        <section className="print-sheet rounded-[12px] border border-line bg-card p-5 shadow-sm sm:p-6">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 className="font-serif text-3xl text-navy">{title}</h2>
              <p className="mt-1 text-sm text-muted">
                Driver {driverName || "not on file"}
              </p>
              <p className="mt-1 text-sm font-semibold text-navy">
                {rows.length} student{rows.length === 1 ? "" : "s"}
              </p>
            </div>
            <div className="no-print flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:items-end">
              <label className="text-sm font-semibold text-navy">
                Driver email
                <input
                  type="email"
                  value={to}
                  onChange={(event) => setTo(event.target.value)}
                  placeholder="Driver email"
                  className="mt-1 block min-h-[44px] w-full min-w-0 rounded-[12px] border border-line px-3 font-normal sm:w-64"
                />
              </label>
              <button
                type="button"
                disabled={pending}
                onClick={() =>
                  start(async () => {
                    const result = await emailDriverList({
                      to,
                      bus: active.kind === "bus" ? active.id : undefined,
                      van: active.kind === "van" ? active.id : undefined,
                    });
                    setMessage(
                      result.ok
                        ? `Emailed ${title} to ${result.recipients.join(", ")}.`
                        : result.error,
                    );
                  })
                }
                className="min-h-[44px] rounded-[12px] bg-teal px-5 text-sm font-semibold text-white disabled:opacity-50"
              >
                {pending ? "Sending…" : "Email Driver"}
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="min-h-[44px] rounded-[12px] border border-navy/20 bg-white px-5 text-sm font-semibold text-navy"
              >
                Print Roster
              </button>
            </div>
          </div>
          {message ? (
            <p className="no-print mt-3 text-sm text-muted">{message}</p>
          ) : null}
          <div className="mt-5 overflow-x-auto rounded-[12px] border border-line">
            <table className="w-full min-w-[40rem] table-fixed text-left text-sm">
              <colgroup>
                <col className="w-[22%]" />
                <col className="w-[22%]" />
                <col className="w-[20%]" />
                <col className="w-[24%]" />
                <col className="w-[12%]" />
              </colgroup>
              <thead>
                <tr className="border-b border-line bg-paper text-base font-bold text-navy">
                  <th className="px-4 py-3">Student name</th>
                  <th className="py-3 pr-3">Parent name</th>
                  <th className="py-3 pr-3">Primary 1 / 2 phone</th>
                  <th className="py-3 pr-3">Teacher</th>
                  <th className="py-3 pr-4">Grade</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((rider) => {
                  const call = phoneHref(rider.parentPhone);
                  const parent =
                    rider.parentName && rider.parentName !== "—"
                      ? rider.parentName
                      : "Not on file";
                  return (
                    <tr key={rider.id} className="border-b border-line last:border-0">
                      <td className="px-4 py-3 font-semibold">{rider.name}</td>
                      <td className="py-3 pr-3">{parent}</td>
                      <td className="py-3 pr-3">
                        {hasParentPhone(rider.parentPhone) && call ? (
                          <a
                            href={call}
                            className="font-semibold text-navy underline-offset-2 hover:underline"
                          >
                            {rider.parentPhone}
                          </a>
                        ) : (
                          <span className="text-muted">Not on file</span>
                        )}
                        {hasParentPhone(rider.parentPhone2) ? (
                          <span className="mt-0.5 block">
                            <a
                              href={phoneHref(rider.parentPhone2)}
                              className="font-semibold text-navy underline-offset-2 hover:underline"
                            >
                              {rider.parentPhone2}
                            </a>
                          </span>
                        ) : null}
                      </td>
                      <td className="py-3 pr-3">{rider.teacherName || "—"}</td>
                      <td className="py-3 pr-4">{gradeOnly(rider.grade)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {!rows.length ? (
            <p className="mt-3 text-sm text-muted">
              No students on {title} yet.
            </p>
          ) : null}
        </section>
      ) : (
        <section className="no-print rounded-[12px] border border-dashed border-line bg-card px-6 py-14 text-center shadow-sm">
          <BusIcon />
          <h2 className="mt-4 font-serif text-2xl text-navy">
            No vehicle selected
          </h2>
          <p className="mt-2 text-sm text-muted">
            {aimSchool
              ? "Choose Bus 4, Bus 5, or the 3rd bus above to view its student roster."
              : "Choose a bus or van above to view its student roster."}
          </p>
        </section>
      )}
    </div>
  );
}
