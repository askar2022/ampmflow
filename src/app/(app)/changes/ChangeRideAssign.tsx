"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { assignRequestedBus } from "@/app/actions/reception";
import type { Trip } from "@/lib/types";

type TripChoice = "AM" | "PM" | "BOTH";

function startingTrip(defaultTrips?: Trip[]): TripChoice {
  const am = defaultTrips?.includes("AM");
  const pm = defaultTrips?.includes("PM");
  if (am && pm) return "BOTH";
  if (am) return "AM";
  return "PM";
}

export function ChangeRideAssign({
  studentId,
  studentName,
  grade,
  buses = [],
  vans = [],
  defaultTrips,
}: {
  studentId: string;
  studentName: string;
  grade: string;
  buses?: string[];
  vans?: { id: string; name: string }[];
  defaultTrips?: Trip[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [trip, setTrip] = useState<TripChoice>(startingTrip(defaultTrips));
  const [busNumber, setBusNumber] = useState("");
  const [vanNumber, setVanNumber] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [pending, start] = useTransition();

  function close() {
    if (pending) return;
    setOpen(false);
    setError("");
  }

  function assign() {
    const bus = busNumber.trim();
    const van = vanNumber.trim();
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
    start(async () => {
      const result = await assignRequestedBus({
        studentId,
        busNumber: bus || van,
        vehicle: van && !bus ? "van" : "bus",
        trips: trip === "BOTH" ? ["AM", "PM"] : [trip],
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setMessage(result.message);
      setBusNumber("");
      setVanNumber("");
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
        className="rounded-full bg-navy px-4 py-2 text-sm font-semibold text-white"
      >
        Update
      </button>
      {message ? (
        <p className="mt-2 text-xs text-green-800">{message}</p>
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
            className="w-full max-w-lg rounded-2xl bg-card p-6 shadow-lg"
            onClick={(event) => event.stopPropagation()}
          >
            <h3
              id={`company-update-${studentId}`}
              className="font-serif text-3xl text-navy"
            >
              {studentName}
            </h3>
            <p className="mt-1 text-muted">Grade {grade}</p>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <label className="block text-sm font-semibold">
                Bus number
                <input
                  autoFocus
                  list={`company-buses-${studentId}`}
                  value={busNumber}
                  onChange={(event) => {
                    setBusNumber(event.target.value);
                    if (event.target.value.trim()) setVanNumber("");
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      assign();
                    }
                  }}
                  placeholder="4"
                  className="mt-1 w-full rounded-xl border border-line bg-paper px-3 py-3 text-base font-medium text-navy"
                />
              </label>
              <label className="block text-sm font-semibold">
                Van number
                <input
                  list={`company-vans-${studentId}`}
                  value={vanNumber}
                  onChange={(event) => {
                    setVanNumber(event.target.value);
                    if (event.target.value.trim()) setBusNumber("");
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      assign();
                    }
                  }}
                  placeholder="2"
                  className="mt-1 w-full rounded-xl border border-line bg-paper px-3 py-3 text-base font-medium text-navy"
                />
              </label>
            </div>
            {buses.length ? (
              <datalist id={`company-buses-${studentId}`}>
                {buses.map((number) => (
                  <option key={number} value={number} />
                ))}
              </datalist>
            ) : null}
            {vans.length ? (
              <datalist id={`company-vans-${studentId}`}>
                {vans.map((van) => (
                  <option key={van.id} value={van.name} />
                ))}
              </datalist>
            ) : null}

            <div className="mt-5">
              <div className="text-sm font-semibold">Trip</div>
              <div className="mt-2 flex flex-wrap gap-2">
                {(
                  [
                    ["AM", "Morning"],
                    ["PM", "Afternoon"],
                    ["BOTH", "Both"],
                  ] as const
                ).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setTrip(value)}
                    className={`rounded-full px-4 py-2 text-sm font-semibold ${
                      trip === value
                        ? "bg-navy text-white"
                        : "border border-line bg-paper"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {error ? <p className="mt-4 text-sm text-red">{error}</p> : null}

            <div className="mt-6 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={pending}
                onClick={assign}
                className="rounded-full bg-navy px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
              >
                {pending ? "Saving…" : "Assign"}
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
            <Link
              href={`/dashboard?student=${studentId}`}
              className="mt-4 inline-block text-xs text-muted underline"
            >
              Wrong student?
            </Link>
          </div>
        </div>
      ) : null}
    </>
  );
}
