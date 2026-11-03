"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { assignRequestedBus } from "@/app/actions/reception";
import type { Trip } from "@/lib/types";

export function ChangeRideAssign({
  studentId,
  studentName,
  morning,
  afternoon,
  vans = [],
  defaultTrips,
}: {
  studentId: string;
  studentName: string;
  morning?: string;
  afternoon?: string;
  vans?: { id: string; name: string }[];
  defaultTrips?: Trip[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<"bus" | "van">("bus");
  const [trips, setTrips] = useState<Trip[]>(
    defaultTrips?.length ? defaultTrips : ["PM"],
  );
  const [ride, setRide] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [pending, start] = useTransition();

  function close() {
    if (pending) return;
    setOpen(false);
    setError("");
  }

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
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setOpen(true);
          setError("");
          setMessage("");
        }}
        className="rounded-full bg-navy px-3 py-2 text-xs font-semibold text-white"
      >
        Update from company
      </button>
      {message ? (
        <p className="mt-2 max-w-[12rem] text-xs text-green-800">{message}</p>
      ) : null}

      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-navy/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby={`company-update-${studentId}`}
          onClick={close}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-card p-5 shadow-lg"
            onClick={(event) => event.stopPropagation()}
          >
            <h3
              id={`company-update-${studentId}`}
              className="font-serif text-2xl text-navy"
            >
              Update from the bus company
            </h3>
            <p className="mt-1 font-semibold text-navy">{studentName}</p>
            {morning ? (
              <p className="mt-2 text-sm text-muted">Morning: {morning}</p>
            ) : null}
            {afternoon ? (
              <p className="text-sm text-muted">Afternoon: {afternoon}</p>
            ) : null}
            <p className="mt-3 text-sm text-muted">
              Type the bus or van they sent. Parent, teacher, and the bus
              company will be notified.
            </p>

            <div className="mt-4 space-y-3">
              <div>
                <div className="text-xs font-semibold uppercase tracking-wider text-muted">
                  Bus or van
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
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
                        kind === value
                          ? "bg-navy text-white"
                          : "border border-line bg-paper"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <div className="text-xs font-semibold uppercase tracking-wider text-muted">
                  Trip
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
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
              <label className="block text-sm font-semibold">
                {kind === "van" ? "Van" : "Bus number"}
                <input
                  autoFocus
                  list={`company-vans-${studentId}`}
                  value={ride}
                  onChange={(event) => setRide(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      assign();
                    }
                  }}
                  placeholder={kind === "van" ? "Van 2" : "4"}
                  className="mt-1 w-full rounded-xl border border-line bg-paper px-3 py-2.5 text-base font-medium text-navy"
                />
              </label>
              {kind === "van" && vans.length ? (
                <datalist id={`company-vans-${studentId}`}>
                  {vans.map((van) => (
                    <option key={van.id} value={van.name} />
                  ))}
                </datalist>
              ) : null}
            </div>

            {error ? <p className="mt-3 text-sm text-red">{error}</p> : null}

            <div className="mt-5 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={pending}
                onClick={assign}
                className="rounded-full bg-navy px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
              >
                {pending ? "Saving…" : "Assign and notify"}
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={close}
                className="rounded-full border border-line px-5 py-2.5 text-sm font-semibold"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
