"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { assignRequestedBus } from "@/app/actions/reception";
import type { Trip } from "@/lib/types";

type RosterStudent = {
  id: string;
  name: string;
  grade: string;
  morning: string;
  afternoon: string;
};

export function CompanyUpdateSearch({
  students,
  vans = [],
}: {
  students: RosterStudent[];
  vans?: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState<"bus" | "van">("bus");
  const [trips, setTrips] = useState<Trip[]>(["AM", "PM"]);
  const [ride, setRide] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [pendingId, setPendingId] = useState("");
  const [pending, start] = useTransition();

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return students
      .filter((student) =>
        `${student.name} ${student.grade}`.toLowerCase().includes(q),
      )
      .slice(0, 8);
  }, [query, students]);

  function toggleTrip(trip: Trip) {
    setTrips((current) => {
      if (current.includes(trip)) {
        return current.filter((item) => item !== trip);
      }
      return [...current, trip];
    });
  }

  function assign(student: RosterStudent) {
    if (!trips.length) {
      setError("Choose morning, afternoon, or both.");
      return;
    }
    setError("");
    setMessage("");
    setPendingId(student.id);
    start(async () => {
      const result = await assignRequestedBus({
        studentId: student.id,
        busNumber: ride,
        vehicle: kind,
        trips,
      });
      setPendingId("");
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setMessage(result.message);
      setRide("");
      router.refresh();
    });
  }

  return (
    <section className="rounded-2xl border border-line bg-card p-5">
      <h2 className="font-serif text-2xl">Different bus or van</h2>
      <p className="mt-1 text-sm text-muted">
        Use this when a student is already on a route, then the company assigns
        another bus or van because they go to daycare or moved. Search the
        name, choose Bus or Van, morning and/or afternoon, type the number, and
        Assign. Parent, teacher, and the bus company are notified.
      </p>

      <div className="mt-4 flex flex-wrap items-end gap-3">
        <label className="block min-w-[12rem] flex-1 text-xs font-semibold uppercase tracking-wider text-muted sm:max-w-sm">
          Search student already on the list
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Student name"
            className="mt-1 w-full rounded-xl border border-line bg-paper px-3 py-2.5 text-sm font-medium text-navy"
          />
        </label>
        <div className="flex flex-wrap gap-2">
          {(
            [
              ["bus", "Bus"],
              ["van", "Van"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setKind(value)}
              className={`rounded-full px-4 py-2 text-sm font-semibold ${
                kind === value ? "bg-navy text-white" : "border border-line bg-paper"
              }`}
            >
              {label}
            </button>
          ))}
          {(["AM", "PM"] as const).map((trip) => (
            <button
              key={trip}
              type="button"
              onClick={() => toggleTrip(trip)}
              className={`rounded-full px-4 py-2 text-sm font-semibold ${
                trips.includes(trip)
                  ? "bg-navy text-white"
                  : "border border-line bg-paper"
              }`}
            >
              {trip === "AM" ? "Morning" : "Afternoon"}
            </button>
          ))}
        </div>
      </div>

      {error ? (
        <p className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-sm text-red">{error}</p>
      ) : null}
      {message ? (
        <p className="mt-3 rounded-xl bg-green-50 px-3 py-2 text-sm text-green-900">
          {message}
        </p>
      ) : null}

      {query.trim() && !matches.length ? (
        <p className="mt-3 text-sm text-muted">No student matches that name.</p>
      ) : null}

      {matches.length ? (
        <ul className="mt-3 divide-y divide-line rounded-xl border border-line">
          {matches.map((student) => {
            const busy = pending && pendingId === student.id;
            return (
              <li key={student.id} className="space-y-3 px-4 py-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <div className="font-medium text-navy">{student.name}</div>
                    {student.grade ? (
                      <div className="text-xs text-muted">Grade {student.grade}</div>
                    ) : null}
                    <div className="mt-1 text-sm text-muted">
                      Morning: {student.morning}
                    </div>
                    <div className="text-sm text-muted">
                      Afternoon: {student.afternoon}
                    </div>
                  </div>
                  <Link
                    href={`/dashboard?student=${student.id}`}
                    className="rounded-full border border-line px-3 py-2 text-xs font-semibold"
                  >
                    Also change daycare or address
                  </Link>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    list={kind === "van" ? "change-vans" : undefined}
                    value={ride}
                    onChange={(event) => setRide(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        assign(student);
                      }
                    }}
                    placeholder={kind === "van" ? "Van 2" : "4"}
                    className="w-28 rounded-xl border border-line bg-paper px-3 py-2 text-sm font-medium"
                    aria-label={`${kind === "van" ? "Van" : "Bus number"} for ${student.name}`}
                  />
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => assign(student)}
                    className="rounded-full bg-navy px-3 py-2 text-xs font-semibold text-white disabled:opacity-60"
                  >
                    {busy ? "Saving…" : "Assign"}
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      ) : null}
      {kind === "van" && vans.length ? (
        <datalist id="change-vans">
          {vans.map((van) => (
            <option key={van.id} value={van.name} />
          ))}
        </datalist>
      ) : null}
    </section>
  );
}
