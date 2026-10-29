"use client";

import { useDeferredValue, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { saveReceptionChange } from "@/app/actions/reception";
import { planSummary, planTone } from "@/lib/format";
import type { Destination, DurationType, EffectiveStudent, Trip } from "@/lib/types";
import { StatusBadge } from "@/components/StatusBadge";

function gradeRank(grade: string) {
  const value = grade.trim().toLowerCase();
  if (value.startsWith("k")) return 0;
  const number = Number.parseInt(value.replace(/\D/g, ""), 10);
  return Number.isFinite(number) ? number : 99;
}

function teacherLabel(student: EffectiveStudent) {
  return student.teacherName || "No teacher";
}

function studentBuses(student: EffectiveStudent): string[] {
  return [
    ...new Set(
      [student.am.busNumber, student.pm.busNumber].filter(
        (value): value is string => Boolean(value),
      ),
    ),
  ];
}

function uniqueSorted(values: string[]) {
  return [...new Set(values.filter(Boolean))].sort((a, b) =>
    a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" }),
  );
}

function deskRows(
  students: EffectiveStudent[],
  query: string,
  grade: string,
  teacher: string,
  ride: string,
  studentVanId: Record<string, string>,
) {
  const q = query.trim().toLowerCase().replace(/\s+/g, " ");
  const tokens = q.split(" ").filter(Boolean);
  return students
    .filter((student) => {
      if (grade && student.grade !== grade) return false;
      if (teacher && teacherLabel(student) !== teacher) return false;
      if (ride === "none") {
        if (studentBuses(student).length || studentVanId[student.id]) return false;
      } else if (ride === "waiting") {
        if (
          !student.am.waitingForAssignment &&
          !student.pm.waitingForAssignment &&
          student.am.busNumber &&
          student.pm.busNumber &&
          !studentVanId[student.id]
        ) {
          return false;
        }
      } else if (ride.startsWith("van:")) {
        if (studentVanId[student.id] !== ride.slice(4)) return false;
      } else if (ride && !studentBuses(student).includes(ride)) {
        return false;
      }
      if (!q) return true;
      const hay = [
        student.fullName,
        student.studentId,
        student.grade,
        student.teacherName,
        student.classroomName,
        student.parentPhone,
        student.parentPhone2,
        ...studentBuses(student),
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(q) || tokens.every((part) => hay.includes(part));
    })
    .sort((a, b) => {
      const byGrade = gradeRank(a.grade) - gradeRank(b.grade);
      if (byGrade) return byGrade;
      const byTeacher = teacherLabel(a).localeCompare(teacherLabel(b));
      if (byTeacher) return byTeacher;
      const busA = studentBuses(a)[0] || "";
      const busB = studentBuses(b)[0] || "";
      const byBus = busA.localeCompare(busB, undefined, { numeric: true });
      if (byBus) return byBus;
      return a.lastName.localeCompare(b.lastName) || a.firstName.localeCompare(b.firstName);
    });
}

type DeskStudent = EffectiveStudent;

function phoneHref(value: string) {
  const digits = value.replace(/[^\d+]/g, "");
  return digits ? `tel:${digits}` : "";
}

function Field({
  label,
  value,
  href,
}: {
  label: string;
  value?: string | null;
  href?: string;
}) {
  if (!value) return null;
  return (
    <div>
      <div className="text-xs font-semibold uppercase tracking-wider text-muted">
        {label}
      </div>
      {href ? (
        <a href={href} className="mt-0.5 block font-medium text-navy underline">
          {value}
        </a>
      ) : (
        <div className="mt-0.5 font-medium">{value}</div>
      )}
    </div>
  );
}

function startingQuery(students: DeskStudent[], id: string) {
  const student = students.find((row) => row.id === id);
  return student ? `${student.firstName} ${student.lastName}` : "";
}

function formFromStudent(student: DeskStudent | undefined) {
  return {
    destination: (student?.pm.destination === "DAYCARE"
      ? "DAYCARE"
      : student?.pm.destination === "CUSTOM"
        ? "CUSTOM"
        : "HOME") as Destination,
    busNumber: student?.pm.busNumber || student?.am.busNumber || "",
    customAddress: student?.pm.customAddress || "",
    daycareName: student?.daycareName || "",
    daycareAddress: student?.daycareAddress || "",
    daycarePhone: student?.daycarePhone || "",
    parentPhone: student?.parentPhone && student.parentPhone !== "—" ? student.parentPhone : "",
    parentPhone2: student?.parentPhone2 || "",
    parentEmail: student?.parentEmail || "",
    teacherEmail: student?.teacherEmail || "",
  };
}

export function ReceptionDesk({
  students,
  buses,
  vans = [],
  studentVanId = {},
  canPermanent,
  canSeeEmergency,
  initialStudentId = "",
  busCompanyEmail: startingBusCompanyEmail = "",
}: {
  students: DeskStudent[];
  buses: string[];
  vans?: { id: string; name: string }[];
  studentVanId?: Record<string, string>;
  canPermanent: boolean;
  canSeeEmergency: boolean;
  initialStudentId?: string;
  busCompanyEmail?: string;
}) {
  const router = useRouter();
  const initial = formFromStudent(students.find((row) => row.id === initialStudentId));
  const [query, setQuery] = useState(() => startingQuery(students, initialStudentId));
  const [grade, setGrade] = useState("");
  const [teacher, setTeacher] = useState("");
  const [ride, setRide] = useState("");
  const [selectedId, setSelectedId] = useState(initialStudentId);
  const [openForm, setOpenForm] = useState(false);
  const [destination, setDestination] = useState<Destination>(initial.destination);
  const [trips, setTrips] = useState<Trip[]>(["PM"]);
  const [duration, setDuration] = useState<DurationType>("TODAY");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [busNumber, setBusNumber] = useState(initial.busNumber);
  const [customAddress, setCustomAddress] = useState(initial.customAddress);
  const [daycareName, setDaycareName] = useState(initial.daycareName);
  const [daycareAddress, setDaycareAddress] = useState(initial.daycareAddress);
  const [daycarePhone, setDaycarePhone] = useState(initial.daycarePhone);
  const [parentPhone, setParentPhone] = useState(initial.parentPhone);
  const [parentPhone2, setParentPhone2] = useState(initial.parentPhone2);
  const [parentEmail, setParentEmail] = useState(initial.parentEmail);
  const [teacherEmail, setTeacherEmail] = useState(initial.teacherEmail);
  const [busCompanyEmail, setBusCompanyEmail] = useState(startingBusCompanyEmail);
  const [note, setNote] = useState("");
  const [confirmPermanent, setConfirmPermanent] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  const grades = useMemo(
    () =>
      uniqueSorted(students.map((student) => student.grade)).sort(
        (a, b) => gradeRank(a) - gradeRank(b),
      ),
    [students],
  );
  const teachers = useMemo(
    () => uniqueSorted(students.map((student) => teacherLabel(student))),
    [students],
  );
  const busChoices = useMemo(
    () =>
      uniqueSorted([
        ...buses,
        ...students.flatMap((student) => studentBuses(student)),
      ]),
    [buses, students],
  );
  const deferredQuery = useDeferredValue(query);
  const filtered = useMemo(
    () => deskRows(students, deferredQuery, grade, teacher, ride, studentVanId),
    [students, deferredQuery, grade, teacher, ride, studentVanId],
  );
  const browsing = Boolean(query.trim() || grade || teacher || ride);
  const matches = browsing ? filtered.slice(0, 80) : filtered.slice(0, 10);
  const selected = students.find((student) => student.id === selectedId) || null;

  function choose(student: DeskStudent) {
    setSelectedId(student.id);
    setQuery(`${student.firstName} ${student.lastName}`);
    setOpenForm(false);
    setMessage("");
    setError("");
    const next = formFromStudent(student);
    setDestination(next.destination);
    setBusNumber(next.busNumber);
    setCustomAddress(next.customAddress);
    setDaycareName(next.daycareName);
    setDaycareAddress(next.daycareAddress);
    setDaycarePhone(next.daycarePhone);
    setParentPhone(next.parentPhone);
    setParentPhone2(next.parentPhone2);
    setParentEmail(next.parentEmail);
    setTeacherEmail(next.teacherEmail);
    setNote("");
    setConfirmPermanent(false);
  }

  function toggleTrip(trip: Trip) {
    setTrips((current) => {
      if (current.includes(trip)) {
        return current.filter((item) => item !== trip);
      }
      return [...current, trip];
    });
  }

  function save() {
    if (!selected) return;
    if (!parentPhone.trim()) {
      setError("Parent phone is required so we can text the change.");
      return;
    }
    if (!parentEmail.trim() || !teacherEmail.trim() || !busCompanyEmail.trim()) {
      setError("Parent, teacher, and bus company emails are required.");
      return;
    }
    setError("");
    setMessage("");
    startTransition(async () => {
      const result = await saveReceptionChange({
        studentId: selected.id,
        destination,
        trips,
        duration,
        startDate,
        endDate,
        busNumber,
        customAddress,
        daycareName,
        daycareAddress,
        daycarePhone,
        parentPhone,
        parentPhone2,
        parentEmail,
        teacherEmail,
        busCompanyEmail,
        note,
        confirmPermanent,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setMessage(result.message);
      setOpenForm(false);
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-line bg-card p-4 shadow-sm">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:flex lg:flex-row lg:items-end">
          <label className="min-w-0 flex-1 text-xs font-semibold uppercase tracking-wider text-muted">
            Find a student
            <input
              id="student-search"
              type="search"
              autoFocus
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setSelectedId("");
                setOpenForm(false);
                setMessage("");
              }}
              placeholder="Name or student ID"
              className="mt-1 w-full rounded-xl border border-line bg-paper px-4 py-2.5 text-base font-medium text-navy outline-none focus:border-gold"
            />
          </label>
          <label className="text-xs font-semibold uppercase tracking-wider text-muted lg:w-36">
            Grade
            <select
              value={grade}
              onChange={(event) => {
                const value = event.target.value;
                setGrade(value);
                setSelectedId("");
                setOpenForm(false);
                if (!value) setQuery("");
              }}
              className="mt-1 w-full rounded-xl border border-line bg-paper px-3 py-2.5 text-sm font-medium text-navy"
            >
              <option value="">All grades</option>
              {grades.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs font-semibold uppercase tracking-wider text-muted lg:w-48">
            Teacher
            <select
              value={teacher}
              onChange={(event) => {
                const value = event.target.value;
                setTeacher(value);
                setSelectedId("");
                setOpenForm(false);
                if (!value) setQuery("");
              }}
              className="mt-1 w-full rounded-xl border border-line bg-paper px-3 py-2.5 text-sm font-medium text-navy"
            >
              <option value="">All teachers</option>
              {teachers.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs font-semibold uppercase tracking-wider text-muted lg:w-44">
            Bus or van
            <select
              value={ride}
              onChange={(event) => {
                const value = event.target.value;
                setRide(value);
                setSelectedId("");
                setOpenForm(false);
                if (!value) setQuery("");
              }}
              className="mt-1 w-full rounded-xl border border-line bg-paper px-3 py-2.5 text-sm font-medium text-navy"
            >
              <option value="">All buses and vans</option>
              <option value="none">No bus or van</option>
              <option value="waiting">Request for route</option>
              {busChoices.map((item) => (
                <option key={`bus-${item}`} value={item}>
                  Bus {item}
                </option>
              ))}
              {vans.map((van) => (
                <option key={van.id} value={`van:${van.id}`}>
                  {van.name}
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>

      {!selected ? (
        <ul className="divide-y divide-line rounded-2xl border border-line bg-card">
          {matches.map((student) => (
            <li key={student.id}>
              <button
                type="button"
                onClick={() => choose(student)}
                className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-paper"
              >
                <span>
                  <span className="font-semibold">{student.fullName}</span>
                  <span className="ml-2 text-sm text-muted">
                    {String(student.grade).replace(/^grade\s+/i, "")} ·{" "}
                    {teacherLabel(student)}
                  </span>
                </span>
                <span className="text-sm text-muted">
                  {[
                    ...studentBuses(student).map((number) => `Bus ${number}`),
                    vans.find((van) => van.id === studentVanId[student.id])?.name,
                  ]
                    .filter(Boolean)
                    .join(" · ") || "No bus or van"}
                </span>
              </button>
            </li>
          ))}
          {!students.length ? (
            <li className="px-4 py-3 text-sm text-muted">
              No students on the roster yet. Load them on Roster.
            </li>
          ) : !matches.length ? (
            <li className="px-4 py-3 text-sm text-muted">No student matches those filters.</li>
          ) : filtered.length > matches.length ? (
            <li className="px-4 py-2 text-xs text-muted">
              Showing {matches.length} of {filtered.length}. Type a name or use
              the filters to see the rest.
            </li>
          ) : (
            <li className="px-4 py-2 text-xs text-muted">
              {matches.length} student{matches.length === 1 ? "" : "s"}
            </li>
          )}
        </ul>
      ) : null}

      {selected ? (
        <section className="rounded-2xl border border-line bg-card p-5 shadow-sm sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="font-serif text-3xl">{selected.fullName}</h2>
              <p className="mt-1 text-muted">
                {selected.studentId} · Grade {selected.grade}
                {selected.teacherName ? ` · ${selected.teacherName}` : ""}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => {
                  setSelectedId("");
                  setQuery("");
                  setOpenForm(false);
                }}
                className="rounded-full border border-line px-4 py-2 text-sm font-semibold"
              >
                Back to list
              </button>
              {!openForm ? (
                <>
                  <Link
                    href={`/waiting?student=${selected.id}`}
                    className="rounded-full bg-navy px-5 py-2.5 text-sm font-semibold text-white"
                  >
                    Request for Route
                  </Link>
                  <button
                    type="button"
                    onClick={() => setOpenForm(true)}
                    className="rounded-full border border-line px-5 py-2.5 text-sm font-semibold"
                  >
                    Change Transportation
                  </button>
                </>
              ) : null}
            </div>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-line bg-paper p-4">
              <div className="text-xs font-semibold uppercase tracking-wider text-muted">
                Morning
              </div>
              <div className="mt-2">
                <StatusBadge tone={planTone(selected.am)}>
                  {planSummary(selected.am, "AM")}
                </StatusBadge>
              </div>
              <p className="mt-2 text-sm">{selected.am.location}</p>
            </div>
            <div className="rounded-xl border border-line bg-paper p-4">
              <div className="text-xs font-semibold uppercase tracking-wider text-muted">
                Afternoon
              </div>
              <div className="mt-2">
                <StatusBadge tone={planTone(selected.pm)}>
                  {planSummary(selected.pm, "PM")}
                </StatusBadge>
              </div>
              <p className="mt-2 text-sm">{selected.pm.location}</p>
            </div>
          </div>

          <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Field
              label="Parent"
              value={
                selected.parentName && selected.parentName !== "—"
                  ? selected.parentName
                  : "Not on file"
              }
            />
            <Field
              label="Parent phone"
              value={selected.parentPhone}
              href={phoneHref(selected.parentPhone)}
            />
            <Field
              label="Parent phone 2"
              value={selected.parentPhone2}
              href={selected.parentPhone2 ? phoneHref(selected.parentPhone2) : undefined}
            />
            <Field
              label="Parent email"
              value={selected.parentEmail || "Not on file"}
            />
            <Field label="Home address" value={selected.homeAddress} />
            {selected.daycareName ? (
              <>
                <Field label="Daycare" value={selected.daycareName} />
                <Field label="Daycare address" value={selected.daycareAddress} />
                <Field
                  label="Daycare phone"
                  value={selected.daycarePhone}
                  href={selected.daycarePhone ? phoneHref(selected.daycarePhone) : undefined}
                />
              </>
            ) : null}
            <Field
              label="Teacher"
              value={
                selected.teacherEmail
                  ? `${selected.teacherName} · ${selected.teacherEmail}`
                  : selected.teacherName
              }
            />
            {canSeeEmergency ? (
              <>
                <Field
                  label="Emergency contact"
                  value={
                    selected.emergencyName || selected.emergencyPhone
                      ? [selected.emergencyName, selected.emergencyPhone]
                          .filter(Boolean)
                          .join(" · ")
                      : selected.notes || "See student notes"
                  }
                />
                {selected.notes && (selected.emergencyName || selected.emergencyPhone) ? (
                  <Field label="Notes" value={selected.notes} />
                ) : null}
              </>
            ) : null}
          </div>

          {openForm ? (
            <form
              className="mt-6 space-y-4 rounded-2xl border border-gold bg-paper p-4"
              onSubmit={(event) => {
                event.preventDefault();
                save();
              }}
            >
              <h3 className="font-serif text-2xl">Change transportation</h3>
              <p className="text-sm text-muted">
                Choose the new destination, trip, and when it starts. The staff
                member signed in is recorded automatically.
              </p>

              <fieldset className="space-y-2">
                <legend className="text-sm font-semibold">Destination</legend>
                <div className="flex flex-wrap gap-2">
                  {(
                    [
                      ["HOME", "Home bus"],
                      ["DAYCARE", "Daycare bus"],
                      ["CUSTOM", "New address"],
                    ] as const
                  ).map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setDestination(value)}
                      className={`rounded-full px-4 py-2 text-sm font-semibold ${
                        destination === value
                          ? "bg-navy text-white"
                          : "border border-line bg-card"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </fieldset>

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
                          : "border border-line bg-card"
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
                      ...(canPermanent ? ([["PERMANENT", "Permanent"]] as const) : []),
                    ] as const
                  ).map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setDuration(value)}
                      className={`rounded-full px-4 py-2 text-sm font-semibold ${
                        duration === value
                          ? "bg-navy text-white"
                          : "border border-line bg-card"
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
                      className="rounded-xl border border-line bg-card px-3 py-2"
                      required
                    />
                    <input
                      type="date"
                      value={endDate}
                      onChange={(event) => setEndDate(event.target.value)}
                      className="rounded-xl border border-line bg-card px-3 py-2"
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

              <label className="block text-sm font-semibold">
                Bus number
                <input
                  list="desk-buses"
                  value={busNumber}
                  onChange={(event) => setBusNumber(event.target.value)}
                  placeholder="Leave blank if a new route is needed"
                  className="mt-1 w-full rounded-xl border border-line bg-card px-3 py-2 font-normal"
                />
              </label>
              <datalist id="desk-buses">
                {buses.map((bus) => (
                  <option key={bus} value={bus} />
                ))}
              </datalist>
              {!busNumber.trim() ? (
                <p className="text-sm text-orange-800">
                  No bus number yet — this student will be on Request for Route.
                </p>
              ) : null}

              {destination === "CUSTOM" ? (
                <label className="block text-sm font-semibold">
                  New address
                  <input
                    value={customAddress}
                    onChange={(event) => setCustomAddress(event.target.value)}
                    className="mt-1 w-full rounded-xl border border-line bg-card px-3 py-2 font-normal"
                    required
                  />
                </label>
              ) : null}

              {destination === "DAYCARE" ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="block text-sm font-semibold">
                    Daycare name
                    <input
                      value={daycareName}
                      onChange={(event) => setDaycareName(event.target.value)}
                      className="mt-1 w-full rounded-xl border border-line bg-card px-3 py-2 font-normal"
                    />
                  </label>
                  <label className="block text-sm font-semibold">
                    Daycare phone
                    <input
                      value={daycarePhone}
                      onChange={(event) => setDaycarePhone(event.target.value)}
                      className="mt-1 w-full rounded-xl border border-line bg-card px-3 py-2 font-normal"
                    />
                  </label>
                  <label className="block text-sm font-semibold sm:col-span-2">
                    Daycare address
                    <input
                      value={daycareAddress}
                      onChange={(event) => setDaycareAddress(event.target.value)}
                      className="mt-1 w-full rounded-xl border border-line bg-card px-3 py-2 font-normal"
                    />
                  </label>
                </div>
              ) : null}

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <label className="block text-sm font-semibold">
                  Parent phone
                  <input
                    type="tel"
                    required
                    value={parentPhone}
                    onChange={(event) => setParentPhone(event.target.value)}
                    placeholder="612-555-0109"
                    className="mt-1 w-full rounded-xl border border-line bg-card px-3 py-2 font-normal"
                  />
                </label>
                <label className="block text-sm font-semibold">
                  Parent phone 2
                  <input
                    type="tel"
                    value={parentPhone2}
                    onChange={(event) => setParentPhone2(event.target.value)}
                    placeholder="Optional second text"
                    className="mt-1 w-full rounded-xl border border-line bg-card px-3 py-2 font-normal"
                  />
                </label>
                <label className="block text-sm font-semibold">
                  Parent email
                  <input
                    type="email"
                    required
                    value={parentEmail}
                    onChange={(event) => setParentEmail(event.target.value)}
                    placeholder="Required"
                    className="mt-1 w-full rounded-xl border border-line bg-card px-3 py-2 font-normal"
                  />
                </label>
                <label className="block text-sm font-semibold">
                  Teacher email
                  <input
                    type="email"
                    required
                    value={teacherEmail}
                    onChange={(event) => setTeacherEmail(event.target.value)}
                    placeholder="Required"
                    className="mt-1 w-full rounded-xl border border-line bg-card px-3 py-2 font-normal"
                  />
                </label>
                <label className="block text-sm font-semibold sm:col-span-2 lg:col-span-1">
                  Bus company email
                  <input
                    type="email"
                    required
                    value={busCompanyEmail}
                    onChange={(event) => setBusCompanyEmail(event.target.value)}
                    placeholder="Required"
                    className="mt-1 w-full rounded-xl border border-line bg-card px-3 py-2 font-normal"
                  />
                </label>
              </div>
              <p className="text-sm font-medium text-navy">
                Parent phone gets a text. Parent, teacher, and the bus company
                get email.
              </p>

              <label className="block text-sm font-semibold">
                Note (optional)
                <textarea
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  rows={2}
                  className="mt-1 w-full rounded-xl border border-line bg-card px-3 py-2 font-normal"
                />
              </label>

              {error ? <p className="text-sm text-red">{error}</p> : null}

              <div className="flex flex-wrap gap-2">
                <button
                  type="submit"
                  disabled={pending || !trips.length}
                  className="rounded-full bg-navy px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
                >
                  {pending ? "Saving…" : "Save Change"}
                </button>
                <button
                  type="button"
                  onClick={() => setOpenForm(false)}
                  className="rounded-full border border-line px-5 py-2.5 text-sm font-semibold"
                >
                  Cancel
                </button>
              </div>
            </form>
          ) : null}

          {message ? (
            <p className="mt-4 rounded-xl bg-green-50 px-4 py-3 text-sm text-green-900">
              {message}
            </p>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
