"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import {
  lateAlertPreview,
  saveCompanyLateAlertStaff,
} from "@/app/actions/late-alert";
import type { CompanySchool } from "@/lib/company-access";
import {
  lateDelayOptions,
  type LateDelayMinutes,
  type LateRide,
} from "@/lib/late-alert";
import type { Trip } from "@/lib/types";
import { SmsCostButton } from "./SmsCostPopup";

type Preview = {
  rideLabel: string;
  minutes: number;
  familyCount: number;
  staffCount: number;
  studentCount: number;
  preview: string;
  smsReady: boolean;
  sendingEnabled?: boolean;
  estimatedCents: number;
  estimatedCostLabel: string;
};

export function LateAlertBoard({
  companyName,
  schools,
  schoolId,
  schoolName,
  rides,
  staffPhone1 = "",
  staffPhone2 = "",
}: {
  companyName: string;
  schools: CompanySchool[];
  schoolId: string;
  schoolName: string;
  rides: LateRide[];
  staffPhone1?: string;
  staffPhone2?: string;
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
  const [staffSaved, setStaffSaved] = useState("");
  const [phone1, setPhone1] = useState(staffPhone1);
  const [phone2, setPhone2] = useState(staffPhone2);
  const [staffVersion, setStaffVersion] = useState(0);
  const [previewPending, startPreview] = useTransition();
  const [staffPending, startStaff] = useTransition();

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
    startPreview(async () => {
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
  }, [selectedSchool, rideKey, minutes, trips, staffVersion]);

  function chooseSchool(id: string) {
    if (id === selectedSchool) return;
    window.location.assign(`/company/alerts?school=${id}`);
  }

  function saveStaffPhones() {
    setError("");
    setStaffSaved("");
    startStaff(async () => {
      const result = await saveCompanyLateAlertStaff({
        schoolId: selectedSchool,
        phone1,
        phone2,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setPhone1(result.phones.phone1);
      setPhone2(result.phones.phone2);
      setStaffSaved(
        "School staff phones saved. They will get the same late-bus text when sending is turned on.",
      );
      setStaffVersion((value) => value + 1);
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
          <div className="flex flex-wrap gap-2">
            <SmsCostButton schoolId={selectedSchool} refreshKey={0} />
            <Link
              href={`/company?school=${selectedSchool}`}
              className="rounded-full border border-line px-5 py-2.5 text-sm font-semibold"
            >
              Open requests
            </Link>
          </div>
        </div>
        <p className="mt-2 max-w-2xl text-muted">
          Preview late-bus texts here. Sending to parents is turned off until
          the bus company agrees to pay for SMS (8¢ each).
        </p>
        <div
          className="mt-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-950"
          role="status"
        >
          SMS send is disabled. Choosing a bus only updates the preview — it
          never texts parents.
        </div>
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

      <section className="rounded-2xl border border-line bg-card p-4">
        <h2 className="text-sm font-semibold text-navy">
          School staff texts (optional)
        </h2>
        <p className="mt-1 text-sm text-muted">
          Up to two phones can also get every late-bus text for {schoolName}
          once sending is turned on.
        </p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="block text-sm font-semibold text-navy">
            Staff phone 1
            <input
              type="tel"
              value={phone1}
              onChange={(event) => setPhone1(event.target.value)}
              placeholder="612-555-0100"
              className="mt-1 block min-h-[44px] w-full rounded-[12px] border border-line bg-white px-3 font-normal"
            />
          </label>
          <label className="block text-sm font-semibold text-navy">
            Staff phone 2
            <input
              type="tel"
              value={phone2}
              onChange={(event) => setPhone2(event.target.value)}
              placeholder="612-555-0101"
              className="mt-1 block min-h-[44px] w-full rounded-[12px] border border-line bg-white px-3 font-normal"
            />
          </label>
        </div>
        <button
          type="button"
          disabled={staffPending}
          onClick={saveStaffPhones}
          className="mt-3 rounded-full border border-line px-4 py-2 text-sm font-semibold disabled:opacity-60"
        >
          {staffPending ? "Saving…" : "Save staff phones"}
        </button>
        {staffSaved ? (
          <p className="mt-2 text-sm text-green-900">{staffSaved}</p>
        ) : null}
      </section>

      <section className="rounded-2xl border border-line bg-card p-5">
        <h2 className="text-sm font-semibold text-navy">1. Select bus</h2>
        {rides.length ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {rides.map((ride) => {
              const active = ride.key === rideKey;
              return (
                <button
                  key={ride.key}
                  type="button"
                  onClick={() => {
                    setError("");
                    setRideKey(ride.key);
                  }}
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

        {previewPending && !preview ? (
          <p className="mt-6 text-sm text-muted">Loading preview…</p>
        ) : null}

        {preview ? (
          <div className="mt-6 space-y-3">
            <div className="rounded-xl border border-navy/20 bg-navy/5 px-4 py-3 text-sm text-navy">
              <span className="font-extrabold">{preview.familyCount}</span>{" "}
              famil{preview.familyCount === 1 ? "y" : "ies"}
              {preview.staffCount
                ? ` + ${preview.staffCount} school staff`
                : ""}{" "}
              would receive a text for {preview.rideLabel}
              {preview.studentCount
                ? ` (${preview.studentCount} student${
                    preview.studentCount === 1 ? "" : "s"
                  })`
                : ""}
              {" · "}
              <span className="font-extrabold">
                {preview.estimatedCostLabel}
              </span>{" "}
              SMS cost (not sent).
            </div>
            <div className="rounded-xl border border-line bg-paper px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">
                Text preview
              </p>
              <pre className="mt-2 whitespace-pre-wrap font-sans text-sm text-navy">
                {preview.preview}
              </pre>
            </div>
          </div>
        ) : null}

        {error ? <p className="mt-4 text-sm text-red">{error}</p> : null}

        <button
          type="button"
          disabled
          aria-disabled="true"
          title="SMS sending is paused"
          className="mt-6 cursor-not-allowed rounded-full bg-navy/40 px-6 py-3 text-sm font-semibold text-white"
        >
          Send SMS Alert (disabled)
        </button>
        <p className="mt-2 text-sm text-muted">
          Tell us when the bus company agrees to pay for SMS and we will turn
          sending back on.
        </p>
      </section>
    </div>
  );
}
