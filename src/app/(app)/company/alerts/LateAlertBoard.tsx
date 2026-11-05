"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import {
  lateAlertPreview,
  sendLateBusAlert,
} from "@/app/actions/late-alert";
import type { CompanySchool } from "@/lib/company-access";
import {
  lateDelayOptions,
  type LateDelayMinutes,
  type LateRide,
} from "@/lib/late-alert";
import type { Trip } from "@/lib/types";

type Preview = {
  rideLabel: string;
  minutes: number;
  familyCount: number;
  studentCount: number;
  preview: string;
  smsReady: boolean;
};

export function LateAlertBoard({
  companyName,
  schools,
  schoolId,
  schoolName,
  rides,
}: {
  companyName: string;
  schools: CompanySchool[];
  schoolId: string;
  schoolName: string;
  rides: LateRide[];
}) {
  const delays = lateDelayOptions();
  const [selectedSchool, setSelectedSchool] = useState(schoolId);
  const [rideKey, setRideKey] = useState(rides[0]?.key || "");
  const [minutes, setMinutes] = useState<LateDelayMinutes>(
    delays[1]?.minutes || 10,
  );
  const [trip, setTrip] = useState<"PM" | "AM" | "BOTH">("PM");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [pending, start] = useTransition();

  const trips: Trip[] = useMemo(
    () => (trip === "BOTH" ? ["AM", "PM"] : [trip]),
    [trip],
  );

  useEffect(() => {
    if (!rideKey) {
      setPreview(null);
      return;
    }
    let cancelled = false;
    setError("");
    start(async () => {
      const result = await lateAlertPreview({
        schoolId: selectedSchool,
        rideKey,
        minutes,
        trips,
      });
      if (cancelled) return;
      if (!result.ok) {
        setPreview(null);
        setError(result.error);
        return;
      }
      setPreview(result);
    });
    return () => {
      cancelled = true;
    };
  }, [selectedSchool, rideKey, minutes, trips]);

  function chooseSchool(id: string) {
    if (id === selectedSchool) return;
    window.location.assign(`/company/alerts?school=${id}`);
  }

  function send() {
    if (!rideKey) {
      setError("Choose a bus or van.");
      return;
    }
    setError("");
    setMessage("");
    start(async () => {
      const result = await sendLateBusAlert({
        schoolId: selectedSchool,
        rideKey,
        minutes,
        trips,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setMessage(result.message);
    });
  }

  return (
    <div className="space-y-6">
      <div>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="font-serif text-4xl text-navy">{companyName}</h1>
            <p className="mt-1 text-lg font-semibold text-navy">
              Late Bus Alert
            </p>
          </div>
          <Link
            href={`/company?school=${selectedSchool}`}
            className="rounded-full border border-line px-5 py-2.5 text-sm font-semibold"
          >
            Today’s Changes
          </Link>
        </div>
        <p className="mt-2 max-w-2xl text-muted">
          Text parents when a bus or van is running late. Uses the same Twilio
          texts parents already get for transportation changes.
        </p>
        <label className="mt-4 block max-w-md text-sm font-semibold text-navy">
          School
          <select
            value={selectedSchool}
            onChange={(event) => chooseSchool(event.target.value)}
            className="mt-2 block min-h-[44px] w-full rounded-[12px] border border-line bg-white px-3"
          >
            {schools.map((school) => (
              <option key={school.id} value={school.id}>
                {school.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <section className="rounded-2xl border border-line bg-card p-5">
        <h2 className="text-sm font-semibold text-navy">1. Select bus or van</h2>
        {rides.length ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {rides.map((ride) => {
              const active = ride.key === rideKey;
              return (
                <button
                  key={ride.key}
                  type="button"
                  onClick={() => setRideKey(ride.key)}
                  className={`rounded-xl border px-4 py-3 text-sm font-semibold ${
                    active
                      ? "border-navy bg-navy text-white"
                      : "border-line bg-paper text-navy"
                  }`}
                >
                  {ride.label}
                </button>
              );
            })}
          </div>
        ) : (
          <p className="mt-3 text-sm text-muted">
            No buses or vans are on file yet for {schoolName}.
          </p>
        )}

        <h2 className="mt-6 text-sm font-semibold text-navy">2. Select delay</h2>
        <label className="mt-2 block max-w-sm text-sm">
          <select
            value={minutes}
            onChange={(event) =>
              setMinutes(Number(event.target.value) as LateDelayMinutes)
            }
            className="mt-1 block min-h-[44px] w-full rounded-[12px] border border-line bg-white px-3"
          >
            {delays.map((option) => (
              <option key={option.minutes} value={option.minutes}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <h2 className="mt-6 text-sm font-semibold text-navy">3. Trip</h2>
        <div className="mt-2 flex flex-wrap gap-2">
          {(
            [
              ["PM", "Afternoon"],
              ["AM", "Morning"],
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

        {preview ? (
          <div className="mt-6 space-y-3">
            <div className="rounded-xl border border-navy/20 bg-navy/5 px-4 py-3 text-sm text-navy">
              <span className="font-extrabold">{preview.familyCount}</span>{" "}
              famil{preview.familyCount === 1 ? "y" : "ies"} will receive a
              text for {preview.rideLabel}
              {preview.studentCount
                ? ` (${preview.studentCount} student${
                    preview.studentCount === 1 ? "" : "s"
                  })`
                : ""}
              .
            </div>
            <div className="rounded-xl border border-line bg-paper px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">
                Text preview
              </p>
              <pre className="mt-2 whitespace-pre-wrap font-sans text-sm text-navy">
                {preview.preview}
              </pre>
            </div>
            {!preview.smsReady ? (
              <p className="text-sm text-red">
                Twilio is not set, so the alert cannot send yet.
              </p>
            ) : null}
          </div>
        ) : null}

        {error ? <p className="mt-4 text-sm text-red">{error}</p> : null}
        {message ? (
          <p className="mt-4 rounded-xl bg-green-50 px-3 py-2 text-sm text-green-900">
            {message}
          </p>
        ) : null}

        <button
          type="button"
          disabled={pending || !rideKey || !preview?.familyCount}
          onClick={send}
          className="mt-6 rounded-full bg-navy px-6 py-3 text-sm font-semibold text-white disabled:opacity-60"
        >
          {pending ? "Sending…" : "Send SMS Alert"}
        </button>
      </section>
    </div>
  );
}
