"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveReceptionChange } from "@/app/actions/reception";
import type { DurationType, Trip } from "@/lib/types";

export type RequestStudent = {
  id: string;
  fullName: string;
  parentPhone: string;
  parentPhone2: string;
  parentEmail: string;
  teacherEmail: string;
  homeAddress: string;
  daycareName: string;
  daycareAddress: string;
  daycarePhone: string;
};

function starterFromStudents(
  students: RequestStudent[],
  initialStudentId: string,
) {
  const selected =
    students.find((row) => row.id === initialStudentId) || null;
  if (!selected) {
    return {
      query: "",
      selectedId: "",
      parentPhone: "",
      parentPhone2: "",
      parentEmail: "",
      teacherEmail: "",
      daycareName: "",
      daycareAddress: "",
      daycarePhone: "",
    };
  }
  return {
    query: selected.fullName,
    selectedId: selected.id,
    parentPhone: selected.parentPhone || "",
    parentPhone2: selected.parentPhone2 || "",
    parentEmail: selected.parentEmail || "",
    teacherEmail: selected.teacherEmail || "",
    daycareName: selected.daycareName || "",
    daycareAddress: selected.daycareAddress || "",
    daycarePhone: selected.daycarePhone || "",
  };
}

export function StudentChangeRequestForm({
  kind,
  students,
  initialStudentId = "",
  busCompanyEmail = "",
  coordinatorEmail = "",
  frontDeskEmail = "",
  canPermanent = false,
}: {
  kind: "daycare" | "address";
  students: RequestStudent[];
  initialStudentId?: string;
  busCompanyEmail?: string;
  coordinatorEmail?: string;
  frontDeskEmail?: string;
  canPermanent?: boolean;
}) {
  const router = useRouter();
  const starter = starterFromStudents(students, initialStudentId);
  const [query, setQuery] = useState(starter.query);
  const [selectedId, setSelectedId] = useState(starter.selectedId);
  const [trips, setTrips] = useState<Trip[]>(["PM"]);
  const [duration, setDuration] = useState<DurationType>("TODAY");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [confirmPermanent, setConfirmPermanent] = useState(false);
  const [confirmReplace, setConfirmReplace] = useState(false);
  const [daycareName, setDaycareName] = useState(starter.daycareName);
  const [daycareAddress, setDaycareAddress] = useState(starter.daycareAddress);
  const [daycarePhone, setDaycarePhone] = useState(starter.daycarePhone);
  const [customAddress, setCustomAddress] = useState("");
  const [parentPhone, setParentPhone] = useState(starter.parentPhone);
  const [parentPhone2, setParentPhone2] = useState(starter.parentPhone2);
  const [parentEmail, setParentEmail] = useState(starter.parentEmail);
  const [teacherEmail, setTeacherEmail] = useState(starter.teacherEmail);
  const [companyEmail, setCompanyEmail] = useState(busCompanyEmail);
  const [coordEmail, setCoordEmail] = useState(coordinatorEmail);
  const [deskEmail, setDeskEmail] = useState(frontDeskEmail);
  const [note, setNote] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [pending, start] = useTransition();

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return students.slice(0, 8);
    return students
      .filter((row) => {
        const hay = `${row.fullName} ${row.parentPhone} ${row.homeAddress}`.toLowerCase();
        return hay.includes(q);
      })
      .slice(0, 12);
  }, [query, students]);

  const selected = students.find((row) => row.id === selectedId) || null;

  function choose(student: RequestStudent) {
    setSelectedId(student.id);
    setQuery(student.fullName);
    setParentPhone(student.parentPhone || "");
    setParentPhone2(student.parentPhone2 || "");
    setParentEmail(student.parentEmail || "");
    setTeacherEmail(student.teacherEmail || "");
    setDaycareName(student.daycareName || "");
    setDaycareAddress(student.daycareAddress || "");
    setDaycarePhone(student.daycarePhone || "");
    setCustomAddress("");
    setError("");
    setMessage("");
    setConfirmReplace(false);
  }

  function toggleTrip(trip: Trip) {
    setTrips((current) => {
      if (current.includes(trip)) {
        return current.filter((item) => item !== trip);
      }
      return [...current, trip];
    });
  }

  const title =
    kind === "daycare" ? "Daycare add or change" : "New address";
  const blurb =
    kind === "daycare"
      ? "Find the student, enter daycare details, and send the request."
      : "Find the student, enter the new drop-off address, and send the request.";

  return (
    <div className="space-y-4">
      <div>
        <Link
          href="/waiting"
          className="text-sm font-semibold text-navy underline-offset-2 hover:underline"
        >
          ← All request types
        </Link>
        <h1 className="mt-2 font-serif text-4xl text-navy">{title}</h1>
        <p className="mt-2 max-w-2xl text-muted">{blurb}</p>
      </div>

      <form
        className="space-y-4 rounded-2xl border border-line bg-card p-5"
        onSubmit={(event) => {
          event.preventDefault();
          if (!selected) {
            setError("Choose a student from the list.");
            return;
          }
          if (!trips.length) {
            setError("Choose morning, afternoon, or both.");
            return;
          }
          setError("");
          setMessage("");
          start(async () => {
            const result = await saveReceptionChange({
              studentId: selected.id,
              destination: kind === "daycare" ? "DAYCARE" : "CUSTOM",
              trips,
              duration,
              startDate,
              endDate,
              customAddress: kind === "address" ? customAddress : "",
              daycareName: kind === "daycare" ? daycareName : "",
              daycareAddress: kind === "daycare" ? daycareAddress : "",
              daycarePhone: kind === "daycare" ? daycarePhone : "",
              parentPhone,
              parentPhone2,
              parentEmail,
              teacherEmail,
              busCompanyEmail: companyEmail,
              coordinatorEmail: coordEmail,
              frontDeskEmail: deskEmail,
              note,
              confirmPermanent,
              confirmReplaceChange: confirmReplace,
            });
            if (!result.ok) {
              if ("needsConfirm" in result && result.needsConfirm) {
                setConfirmReplace(true);
                setError(result.error);
                return;
              }
              setError(result.error);
              return;
            }
            setMessage(result.message);
            setConfirmReplace(false);
            router.refresh();
          });
        }}
      >
        <label className="block text-sm font-semibold">
          Find student
          <input
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setSelectedId("");
            }}
            placeholder="Name or phone"
            className="mt-1 w-full rounded-xl border border-line bg-paper px-3 py-2 font-normal"
          />
        </label>

        {!selectedId ? (
          <ul className="max-h-56 overflow-auto rounded-xl border border-line">
            {matches.map((student) => (
              <li key={student.id}>
                <button
                  type="button"
                  onClick={() => choose(student)}
                  className="flex w-full flex-col items-start border-b border-line px-4 py-3 text-left last:border-0 hover:bg-paper"
                >
                  <span className="font-semibold text-navy">
                    {student.fullName}
                  </span>
                  <span className="text-sm text-muted">
                    {student.parentPhone || "No phone"} ·{" "}
                    {student.homeAddress || "No address"}
                  </span>
                </button>
              </li>
            ))}
            {!matches.length ? (
              <li className="px-4 py-3 text-sm text-muted">
                No student matches. Check Front Desk roster.
              </li>
            ) : null}
          </ul>
        ) : (
          <p className="rounded-xl bg-paper px-4 py-3 text-sm font-semibold text-navy">
            Selected · {selected?.fullName}
            <button
              type="button"
              className="ml-3 font-semibold text-muted underline"
              onClick={() => {
                setSelectedId("");
                setQuery("");
              }}
            >
              Change
            </button>
          </p>
        )}

        <fieldset className="space-y-2">
          <legend className="text-sm font-semibold">Trip</legend>
          <div className="flex flex-wrap gap-2">
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
        </fieldset>

        <fieldset className="space-y-2">
          <legend className="text-sm font-semibold">When</legend>
          <div className="flex flex-wrap gap-2">
            {(
              [
                ["TODAY", "Today"],
                ["DATE_RANGE", "Date range"],
                ...(canPermanent
                  ? ([["PERMANENT", "Permanent"]] as const)
                  : []),
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setDuration(value)}
                className={`rounded-full px-4 py-2 text-sm font-semibold ${
                  duration === value
                    ? "bg-navy text-white"
                    : "border border-line bg-paper"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          {duration === "DATE_RANGE" ? (
            <div className="flex flex-wrap gap-3 pt-1">
              <input
                type="date"
                value={startDate}
                onChange={(event) => setStartDate(event.target.value)}
                className="rounded-xl border border-line bg-paper px-3 py-2"
                required
              />
              <input
                type="date"
                value={endDate}
                onChange={(event) => setEndDate(event.target.value)}
                className="rounded-xl border border-line bg-paper px-3 py-2"
                required
              />
            </div>
          ) : null}
          {duration === "PERMANENT" ? (
            <label className="flex items-center gap-2 pt-1 text-sm">
              <input
                type="checkbox"
                checked={confirmPermanent}
                onChange={(event) => setConfirmPermanent(event.target.checked)}
              />
              Confirm this is the new regular plan
            </label>
          ) : null}
        </fieldset>

        {kind === "daycare" ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-sm font-semibold">
              Daycare name
              <input
                required
                value={daycareName}
                onChange={(event) => setDaycareName(event.target.value)}
                className="mt-1 w-full rounded-xl border border-line bg-paper px-3 py-2 font-normal"
              />
            </label>
            <label className="block text-sm font-semibold">
              Daycare phone
              <input
                value={daycarePhone}
                onChange={(event) => setDaycarePhone(event.target.value)}
                className="mt-1 w-full rounded-xl border border-line bg-paper px-3 py-2 font-normal"
              />
            </label>
            <label className="block text-sm font-semibold sm:col-span-2">
              Daycare address
              <input
                value={daycareAddress}
                onChange={(event) => setDaycareAddress(event.target.value)}
                className="mt-1 w-full rounded-xl border border-line bg-paper px-3 py-2 font-normal"
              />
            </label>
          </div>
        ) : (
          <label className="block text-sm font-semibold">
            New address
            <input
              required
              value={customAddress}
              onChange={(event) => setCustomAddress(event.target.value)}
              placeholder="Street, city, state, zip"
              className="mt-1 w-full rounded-xl border border-line bg-paper px-3 py-2 font-normal"
            />
          </label>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm font-semibold">
            Primary 1 phone
            <input
              required
              value={parentPhone}
              onChange={(event) => setParentPhone(event.target.value)}
              className="mt-1 w-full rounded-xl border border-line bg-paper px-3 py-2 font-normal"
            />
          </label>
          <label className="block text-sm font-semibold">
            Parent email
            <input
              type="email"
              required
              value={parentEmail}
              onChange={(event) => setParentEmail(event.target.value)}
              className="mt-1 w-full rounded-xl border border-line bg-paper px-3 py-2 font-normal"
            />
          </label>
          <label className="block text-sm font-semibold">
            Teacher email
            <input
              type="email"
              required
              value={teacherEmail}
              onChange={(event) => setTeacherEmail(event.target.value)}
              className="mt-1 w-full rounded-xl border border-line bg-paper px-3 py-2 font-normal"
            />
          </label>
          <label className="block text-sm font-semibold">
            Bus company email
            <input
              type="email"
              required
              value={companyEmail}
              onChange={(event) => setCompanyEmail(event.target.value)}
              className="mt-1 w-full rounded-xl border border-line bg-paper px-3 py-2 font-normal"
            />
          </label>
          <label className="block text-sm font-semibold">
            Coordinator email
            <input
              type="email"
              required
              value={coordEmail}
              onChange={(event) => setCoordEmail(event.target.value)}
              className="mt-1 w-full rounded-xl border border-line bg-paper px-3 py-2 font-normal"
            />
          </label>
          <label className="block text-sm font-semibold">
            Front Desk email
            <input
              type="email"
              required
              value={deskEmail}
              onChange={(event) => setDeskEmail(event.target.value)}
              className="mt-1 w-full rounded-xl border border-line bg-paper px-3 py-2 font-normal"
            />
          </label>
          <label className="block text-sm font-semibold sm:col-span-2">
            Note (optional)
            <input
              value={note}
              onChange={(event) => setNote(event.target.value)}
              className="mt-1 w-full rounded-xl border border-line bg-paper px-3 py-2 font-normal"
            />
          </label>
        </div>

        {confirmReplace ? (
          <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
            This student already has a change. Submit again to replace it, or
            cancel.
          </p>
        ) : null}
        {error ? (
          <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red">{error}</p>
        ) : null}
        {message ? (
          <p className="rounded-xl bg-green-50 px-3 py-2 text-sm text-green-900">
            {message}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={pending || !selectedId}
          className="rounded-full bg-navy px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
        >
          {pending
            ? "Sending…"
            : confirmReplace
              ? "Yes, replace change"
              : "Submit request"}
        </button>
      </form>
    </div>
  );
}
