"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import {
  lateAlertPreview,
  saveCompanyLateAlertStaff,
  sendLateBusAlert,
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
  const [message, setMessage] = useState("");
  const [staffSaved, setStaffSaved] = useState("");
  const [phone1, setPhone1] = useState(staffPhone1);
  const [phone2, setPhone2] = useState(staffPhone2);
  const [costRefresh, setCostRefresh] = useState(0);
  const [staffVersion, setStaffVersion] = useState(0);
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
  }, [selectedSchool, rideKey, minutes, trips, staffVersion]);

  function chooseSchool(id: string) {
    if (id === selectedSchool) return;
    window.location.assign(`/company/alerts?school=${id}`);
  }

  function send() {
    if (!rideKey) {
      setError("Choose a bus.");
      return;
    }
    setError("");
    setMessage("");
    setStaffSaved("");
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
      setCostRefresh((value) => value + 1);
    });
  }

  function saveStaffPhones() {
    setError("");
    setMessage("");
    setStaffSaved("");
    start(async () => {
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
      setStaffSaved("School staff phones saved. They get the same late-bus text.");
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
            <SmsCostButton
              schoolId={selectedSchool}
              refreshKey={costRefresh}
            />
            <Link
              href={`/company?school=${selectedSchool}`}
              className="rounded-full border border-line px-5 py-2.5 text-sm font-semibold"
            >
              Today’s Changes
            </Link>
          </div>
        </div>
        <p className="mt-2 max-w-2xl text-muted">
          Text parents when a bus is running late. Aim uses Bus 4, Bus 5, and
          the 3rd bus only. Each text is 8¢ — open SMS cost for this week and
          month by bus.
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

      <section className="rounded-2xl border border-line bg-card p-4">
        <h2 className="text-sm font-semibold text-navy">
          School staff texts (optional)
        </h2>
        <p className="mt-1 text-sm text-muted">
          Up to two phones also get every late-bus text for {schoolName}, so
          school staff know when parents are notified.
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
          disabled={pending}
          onClick={saveStaffPhones}
          className="mt-3 rounded-full border border-line px-4 py-2 text-sm font-semibold disabled:opacity-60"
        >
          {pending ? "Saving…" : "Save staff phones"}
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
            No Aim buses are on file yet for {schoolName}.
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
              famil{preview.familyCount === 1 ? "y" : "ies"}
              {preview.staffCount
                ? ` + ${preview.staffCount} school staff`
                : ""}{" "}
              will receive a text for {preview.rideLabel}
              {preview.studentCount
                ? ` (${preview.studentCount} student${
                    preview.studentCount === 1 ? "" : "s"
                  })`
                : ""}
              {" · "}
              <span className="font-extrabold">
                {preview.estimatedCostLabel}
              </span>{" "}
              SMS cost.
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
                Texting is not set up yet, so the alert cannot send.
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
