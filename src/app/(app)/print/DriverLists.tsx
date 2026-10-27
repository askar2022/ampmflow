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

export function DriverLists({
  riders,
  buses,
  vans,
}: {
  riders: DriverRider[];
  buses: string[];
  vans: DriverVan[];
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

  function choose(next: Selected) {
    setSelected(next);
    setMessage("");
    if (next?.kind === "bus") setQuery(`Bus ${next.id}`);
    if (next?.kind === "van") {
      const name = vans.find((van) => van.id === next.id)?.name || "Van";
      setQuery(name);
    }
  }

  return (
    <div className="space-y-4">
      <section className="no-print rounded-2xl border border-line bg-card p-4 shadow-sm">
        <label className="block text-xs font-semibold uppercase tracking-wider text-muted">
          Find a bus or van
          <input
            type="search"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setSelected(null);
              setMessage("");
            }}
            placeholder="Bus 1 or Van 1"
            className="mt-1 w-full rounded-xl border border-line bg-paper px-4 py-2.5 text-base font-medium text-navy outline-none focus:border-gold"
          />
        </label>
        <div className="mt-3 flex flex-wrap gap-2">
          {visibleBuses.map((number) => (
            <button
              key={`bus-${number}`}
              type="button"
              onClick={() => choose({ kind: "bus", id: number })}
              className={`rounded-full px-3 py-1.5 text-sm font-semibold ${
                active?.kind === "bus" && active.id === number
                  ? "bg-navy text-white"
                  : "border border-line bg-paper text-navy"
              }`}
            >
              Bus {number}
            </button>
          ))}
          {visibleVans.map((van) => (
            <button
              key={van.id}
              type="button"
              onClick={() => choose({ kind: "van", id: van.id })}
              className={`rounded-full px-3 py-1.5 text-sm font-semibold ${
                active?.kind === "van" && active.id === van.id
                  ? "bg-navy text-white"
                  : "border border-line bg-paper text-navy"
              }`}
            >
              {van.name}
            </button>
          ))}
        </div>
        {!buses.length && !vans.length ? (
          <p className="mt-3 text-sm text-muted">
            No bus or van assignments yet. Save a bus number on Front Desk, or
            assign a van, then search here.
          </p>
        ) : null}
      </section>

      {active ? (
        <section className="print-sheet rounded-2xl border border-line bg-card p-5">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="font-serif text-2xl">{title}</h2>
              <p className="text-sm text-muted">
                {rows.length} student{rows.length === 1 ? "" : "s"} · give this
                list to the driver
              </p>
            </div>
            <div className="no-print flex flex-wrap items-end gap-2">
              <label className="text-sm font-semibold text-navy">
                Email this {active.kind}
                <input
                  type="email"
                  value={to}
                  onChange={(event) => setTo(event.target.value)}
                  placeholder="Driver email"
                  className="mt-1 block w-full min-w-0 rounded-xl border border-line px-3 py-2 font-normal sm:w-64"
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
                className="rounded-xl bg-navy px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                {pending ? "Sending…" : "Email driver"}
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="rounded-xl border border-line px-4 py-2 text-sm font-semibold"
              >
                Print for driver
              </button>
            </div>
          </div>
          {message ? (
            <p className="no-print mt-3 text-sm text-muted">{message}</p>
          ) : null}
          <ul className="mt-4 divide-y divide-line">
            <li className="hidden py-2 text-[11px] font-semibold uppercase tracking-wide text-muted sm:grid sm:grid-cols-[minmax(0,1.1fr)_minmax(0,1.1fr)_minmax(8rem,0.9fr)_auto] sm:gap-3">
              <span>Student</span>
              <span>Parent</span>
              <span>Parent phone</span>
              <span>Grade</span>
            </li>
            {rows.map((rider) => {
              const call = phoneHref(rider.parentPhone);
              const parent =
                rider.parentName && rider.parentName !== "—"
                  ? rider.parentName
                  : "Not on file";
              return (
                <li
                  key={rider.id}
                  className="grid gap-2 py-3 text-sm sm:grid-cols-[minmax(0,1.1fr)_minmax(0,1.1fr)_minmax(8rem,0.9fr)_auto] sm:items-center sm:gap-3"
                >
                  <span>
                    <span className="block text-[11px] font-semibold uppercase tracking-wide text-muted sm:hidden">
                      Student
                    </span>
                    <span className="font-semibold">{rider.name}</span>
                  </span>
                  <span>
                    <span className="block text-[11px] font-semibold uppercase tracking-wide text-muted sm:hidden">
                      Parent
                    </span>
                    <span className="font-medium">{parent}</span>
                  </span>
                  <span>
                    <span className="block text-[11px] font-semibold uppercase tracking-wide text-muted sm:hidden">
                      Parent phone
                    </span>
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
                  </span>
                  <span className="text-muted">
                    Grade {rider.grade}
                    {rider.teacherName ? ` · ${rider.teacherName}` : ""}
                  </span>
                </li>
              );
            })}
          </ul>
          {!rows.length ? (
            <p className="mt-3 text-sm text-muted">
              No students on {title} yet.
            </p>
          ) : null}
        </section>
      ) : (
        <p className="no-print rounded-2xl border border-line bg-card px-4 py-6 text-sm text-muted">
          Type Bus 1 or click a bus or van. The student list for that vehicle
          shows here. Then print it or email that driver only.
        </p>
      )}
    </div>
  );
}
