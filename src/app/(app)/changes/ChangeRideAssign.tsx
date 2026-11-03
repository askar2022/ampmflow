"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { assignRequestedBus } from "@/app/actions/reception";
import type { Trip } from "@/lib/types";

export function ChangeRideAssign({
  studentId,
  vans = [],
  defaultTrips,
}: {
  studentId: string;
  vans?: { id: string; name: string }[];
  defaultTrips?: Trip[];
}) {
  const router = useRouter();
  const [kind, setKind] = useState<"bus" | "van">("bus");
  const [trips, setTrips] = useState<Trip[]>(
    defaultTrips?.length ? defaultTrips : ["PM"],
  );
  const [ride, setRide] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [pending, start] = useTransition();

  function toggleTrip(trip: Trip) {
    setTrips((current) => {
      if (current.includes(trip)) {
        return current.filter((item) => item !== trip);
      }
      return [...current, trip];
    });
  }

  function assign() {
    if (!trips.length) {
      setError("Choose morning, afternoon, or both.");
      return;
    }
    setError("");
    setMessage("");
    start(async () => {
      const result = await assignRequestedBus({
        studentId,
        busNumber: ride,
        vehicle: kind,
        trips,
      });
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
    <div className="min-w-[16rem] space-y-2">
      <div className="flex flex-wrap gap-1">
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
            className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
              kind === value ? "bg-navy text-white" : "border border-line bg-card"
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
            className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
              trips.includes(trip)
                ? "bg-navy text-white"
                : "border border-line bg-card"
            }`}
          >
            {trip === "AM" ? "AM" : "PM"}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <input
          list={`change-vans-${studentId}`}
          value={ride}
          onChange={(event) => setRide(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              assign();
            }
          }}
          placeholder={kind === "van" ? "Van 2" : "4"}
          className="w-20 rounded-xl border border-line bg-paper px-2 py-1.5 text-sm"
          aria-label="Bus or van the company assigned"
        />
        <button
          type="button"
          disabled={pending}
          onClick={assign}
          className="rounded-full bg-navy px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
        >
          {pending ? "Saving…" : "Assign"}
        </button>
      </div>
      {kind === "van" && vans.length ? (
        <datalist id={`change-vans-${studentId}`}>
          {vans.map((van) => (
            <option key={van.id} value={van.name} />
          ))}
        </datalist>
      ) : null}
      {error ? <p className="text-xs text-red">{error}</p> : null}
      {message ? <p className="text-xs text-green-800">{message}</p> : null}
    </div>
  );
}
