"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveParentChange, type ParentChangeKind } from "@/app/actions/parent-change";
import { planSummary } from "@/lib/format";
import type { DurationType, EffectiveStudent, Trip } from "@/lib/types";

export function ParentChangeCard({
  student,
  buses,
  allowPermanent,
  onClose,
}: {
  student: EffectiveStudent;
  buses: string[];
  allowPermanent: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [kind, setKind] = useState<ParentChangeKind>("HOME_PICKUP");
  const [trips, setTrips] = useState<Trip[]>(["PM"]);
  const [duration, setDuration] = useState<DurationType>("TODAY");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [customAddress, setCustomAddress] = useState("");
  const [customCity, setCustomCity] = useState("");
  const [customZip, setCustomZip] = useState("");
  const [daycareName, setDaycareName] = useState(student.daycareName || "");
  const [daycareAddress, setDaycareAddress] = useState("");
  const [daycareCity, setDaycareCity] = useState("");
  const [daycareZip, setDaycareZip] = useState("");
  const [busNumber, setBusNumber] = useState("");
  const [parentAtDaycare, setParentAtDaycare] = useState(false);
  const [busToCustom, setBusToCustom] = useState(false);
  const [note, setNote] = useState("");
  const [applyFamily, setApplyFamily] = useState(false);
  const [confirmPermanent, setConfirmPermanent] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  function pickKind(next: ParentChangeKind) {
    setKind(next);
    setError("");
    if (next === "HOME_PICKUP") setTrips(["PM"]);
    if (next === "CUSTOM_DROP") setTrips(["AM"]);
    if (next === "DAYCARE") setTrips(["PM"]);
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    start(async () => {
      const result = await saveParentChange({
        studentId: student.id,
        kind,
        trips,
        duration,
        startDate,
        endDate,
        customAddress,
        customCity,
        customZip,
        daycareName,
        daycareAddress,
        daycareCity,
        daycareZip,
        busNumber,
        parentAtDaycare,
        busToCustom,
        note,
        applyFamily,
        confirmPermanent,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.refresh();
      onClose();
    });
  }

  return (
    <div className="change-card-back" onClick={onClose}>
      <form
        className="change-card"
        onClick={(event) => event.stopPropagation()}
        onSubmit={submit}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-muted">Parent called</p>
            <h2 className="font-serif text-3xl text-navy">{student.fullName}</h2>
            <p className="mt-1 text-sm text-muted">
              {student.grade} · {student.parentName} · {student.parentPhone}
            </p>
            <p className="mt-1 text-sm">
              Now: AM {planSummary(student.am, "AM")} · PM {planSummary(student.pm, "PM")}
            </p>
          </div>
          <button type="button" className="gate-link" onClick={onClose}>
            Close
          </button>
        </div>

        <fieldset>
          <legend className="text-sm font-semibold">What is changing?</legend>
          <div className="mt-2 flex flex-wrap gap-2">
            <Choice
              active={kind === "HOME_PICKUP"}
              onClick={() => pickKind("HOME_PICKUP")}
              label="Home pickup"
            />
            <Choice
              active={kind === "CUSTOM_DROP"}
              onClick={() => pickKind("CUSTOM_DROP")}
              label="Different drop-off / pickup address"
            />
            <Choice
              active={kind === "DAYCARE"}
              onClick={() => pickKind("DAYCARE")}
              label="Daycare"
            />
          </div>
        </fieldset>

        <fieldset>
          <legend className="text-sm font-semibold">Which trip?</legend>
          <div className="mt-2 flex flex-wrap gap-2">
            <Choice
              active={trips.length === 1 && trips[0] === "AM"}
              onClick={() => setTrips(["AM"])}
              label="Morning"
            />
            <Choice
              active={trips.length === 1 && trips[0] === "PM"}
              onClick={() => setTrips(["PM"])}
              label="Afternoon"
            />
            <Choice
              active={trips.length === 2}
              onClick={() => setTrips(["AM", "PM"])}
              label="Both"
            />
          </div>
        </fieldset>

        <fieldset>
          <legend className="text-sm font-semibold">How long?</legend>
          <div className="mt-2 flex flex-wrap gap-2">
            <Choice
              active={duration === "TODAY"}
              onClick={() => setDuration("TODAY")}
              label="Today only"
            />
            <Choice
              active={duration === "DATE_RANGE"}
              onClick={() => setDuration("DATE_RANGE")}
              label="Date range"
            />
            {allowPermanent ? (
              <Choice
                active={duration === "PERMANENT"}
                onClick={() => setDuration("PERMANENT")}
                label="Permanent"
              />
            ) : null}
          </div>
          {duration === "DATE_RANGE" ? (
            <div className="mt-3 grid grid-cols-2 gap-3">
              <label className="text-sm font-semibold">
                Start
                <input
                  type="date"
                  className="mt-1 w-full rounded-xl border border-line px-3 py-2"
                  value={startDate}
                  onChange={(event) => setStartDate(event.target.value)}
                  required
                />
              </label>
              <label className="text-sm font-semibold">
                End
                <input
                  type="date"
                  className="mt-1 w-full rounded-xl border border-line px-3 py-2"
                  value={endDate}
                  onChange={(event) => setEndDate(event.target.value)}
                  required
                />
              </label>
            </div>
          ) : null}
        </fieldset>

        {kind === "CUSTOM_DROP" ? (
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="text-sm font-semibold sm:col-span-3">
              Address
              <input
                className="mt-1 w-full rounded-xl border border-line px-3 py-2"
                value={customAddress}
                onChange={(event) => setCustomAddress(event.target.value)}
                placeholder="Street address"
                required
              />
            </label>
            <label className="text-sm font-semibold">
              City
              <input
                className="mt-1 w-full rounded-xl border border-line px-3 py-2"
                value={customCity}
                onChange={(event) => setCustomCity(event.target.value)}
                placeholder="Minneapolis"
              />
            </label>
            <label className="text-sm font-semibold">
              ZIP
              <input
                className="mt-1 w-full rounded-xl border border-line px-3 py-2"
                value={customZip}
                onChange={(event) => setCustomZip(event.target.value)}
              />
            </label>
            <label className="flex items-center gap-2 text-sm font-semibold sm:col-span-3">
              <input
                type="checkbox"
                checked={busToCustom}
                onChange={(event) => setBusToCustom(event.target.checked)}
              />
              Bus to this address
            </label>
          </div>
        ) : null}

        {kind === "DAYCARE" ? (
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="text-sm font-semibold sm:col-span-3">
              Daycare name
              <input
                className="mt-1 w-full rounded-xl border border-line px-3 py-2"
                value={daycareName}
                onChange={(event) => setDaycareName(event.target.value)}
                placeholder="Daycare name"
              />
            </label>
            <label className="text-sm font-semibold sm:col-span-3">
              Daycare address
              <input
                className="mt-1 w-full rounded-xl border border-line px-3 py-2"
                value={daycareAddress}
                onChange={(event) => setDaycareAddress(event.target.value)}
                placeholder="Street address"
              />
            </label>
            <label className="text-sm font-semibold">
              City
              <input
                className="mt-1 w-full rounded-xl border border-line px-3 py-2"
                value={daycareCity}
                onChange={(event) => setDaycareCity(event.target.value)}
              />
            </label>
            <label className="text-sm font-semibold">
              ZIP
              <input
                className="mt-1 w-full rounded-xl border border-line px-3 py-2"
                value={daycareZip}
                onChange={(event) => setDaycareZip(event.target.value)}
              />
            </label>
            <label className="flex items-center gap-2 text-sm font-semibold sm:col-span-3">
              <input
                type="checkbox"
                checked={parentAtDaycare}
                onChange={(event) => setParentAtDaycare(event.target.checked)}
              />
              Parent pickup or drop-off at daycare (no bus)
            </label>
          </div>
        ) : null}

        {(kind === "DAYCARE" && !parentAtDaycare) || (kind === "CUSTOM_DROP" && busToCustom) ? (
          <label className="block text-sm font-semibold">
            Bus number
            <select
              className="mt-1 w-full rounded-xl border border-line px-3 py-2"
              value={busNumber}
              onChange={(event) => setBusNumber(event.target.value)}
            >
              <option value="">Waiting for bus number</option>
              {buses.map((bus) => (
                <option key={bus} value={bus}>
                  Bus {bus}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        <label className="block text-sm font-semibold">
          Note
          <textarea
            className="mt-1 w-full rounded-xl border border-line px-3 py-2"
            rows={2}
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="Optional. Who called and what they asked."
          />
        </label>

        <label className="flex items-center gap-2 text-sm font-semibold">
          <input
            type="checkbox"
            checked={applyFamily}
            onChange={(event) => setApplyFamily(event.target.checked)}
          />
          Apply to siblings with the same parent phone
        </label>

        {duration === "PERMANENT" ? (
          <label className="flex items-start gap-2 rounded-xl bg-yellow/20 p-3 text-sm font-semibold">
            <input
              type="checkbox"
              checked={confirmPermanent}
              onChange={(event) => setConfirmPermanent(event.target.checked)}
            />
            This is a permanent change for {student.firstName}.
          </label>
        ) : null}

        {error ? <p className="text-sm font-semibold text-red">{error}</p> : null}

        <div className="flex flex-wrap gap-2">
          <button
            type="submit"
            disabled={pending}
            className="action-button rounded-xl px-5 py-2.5 font-bold disabled:opacity-60"
          >
            {pending ? "Saving…" : "Save this child"}
          </button>
          <button type="button" className="gate-link" onClick={onClose}>
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}

function Choice({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-3 py-1.5 text-sm font-semibold ${
        active ? "bg-navy text-white" : "border border-line bg-white"
      }`}
    >
      {label}
    </button>
  );
}

export function ParentChangeButton({
  student,
  buses,
  allowPermanent,
}: {
  student: EffectiveStudent;
  buses: string[];
  allowPermanent: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className="font-semibold text-navy underline" onClick={() => setOpen(true)}>
        Parent change
      </button>
      {open ? (
        <ParentChangeCard
          student={student}
          buses={buses}
          allowPermanent={allowPermanent}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </>
  );
}
