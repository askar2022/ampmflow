"use client";

import { useDeferredValue, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  removeReceptionStudent,
  saveReceptionStudentInfo,
} from "@/app/actions/reception";
import { planSummary, planTone } from "@/lib/format";
import type { EffectiveStudent } from "@/lib/types";
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

function planVanLabel(plan: EffectiveStudent["am"]) {
  return plan.notes?.match(/Van\s+[A-Za-z0-9-]+/i)?.[0] || "";
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

function studentRideOptions(student: EffectiveStudent) {
  const options: { value: string; label: string }[] = [];
  const amVan = planVanLabel(student.am);
  const pmVan = planVanLabel(student.pm);
  if (amVan) options.push({ value: `ride:van:${amVan.toLowerCase()}`, label: amVan });
  if (pmVan && pmVan.toLowerCase() !== amVan.toLowerCase()) {
    options.push({ value: `ride:van:${pmVan.toLowerCase()}`, label: pmVan });
  }
  // One Bus 1 / Bus 2 choice — AM and PM times show as columns in the list.
  for (const bus of studentBuses(student)) {
    options.push({
      value: `ride:bus:${bus}`,
      label: `Bus ${bus}`,
    });
  }
  return options;
}

function sameDeskBus(stored: string, wanted: string) {
  const a = stored.trim().toLowerCase().replace(/^bus\s+/i, "");
  const b = wanted.trim().toLowerCase().replace(/^bus\s+/i, "");
  if (a === b) return true;
  const other = /^(3rd(\s+bus)?|other(\s+bus)?)$/i;
  return other.test(a) && other.test(b);
}

function studentMatchesRide(
  student: EffectiveStudent,
  ride: string,
  studentVanId: Record<string, string>,
) {
  if (!ride) return true;
  if (ride === "none") {
    return !(studentBuses(student).length || studentVanId[student.id] || planVanLabel(student.am) || planVanLabel(student.pm));
  }
  if (ride === "waiting") {
    return (
      student.am.waitingForAssignment ||
      student.pm.waitingForAssignment ||
      (!student.am.busNumber && !student.pm.busNumber && !studentVanId[student.id] && !planVanLabel(student.am) && !planVanLabel(student.pm))
    );
  }
  if (ride.startsWith("van:")) {
    return studentVanId[student.id] === ride.slice(4);
  }
  if (ride.startsWith("ride:van:")) {
    const wanted = ride.slice("ride:van:".length);
    return [planVanLabel(student.am), planVanLabel(student.pm)].some(
      (label) => label.toLowerCase() === wanted,
    );
  }
  if (ride.startsWith("ride:bus:")) {
    return studentBuses(student).some((bus) =>
      sameDeskBus(bus, ride.slice("ride:bus:".length)),
    );
  }
  if (ride.startsWith("ride:am:")) {
    return sameDeskBus(student.am.busNumber || "", ride.slice("ride:am:".length));
  }
  if (ride.startsWith("ride:pm:")) {
    return sameDeskBus(student.pm.busNumber || "", ride.slice("ride:pm:".length));
  }
  return studentBuses(student).some((bus) => sameDeskBus(bus, ride));
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
      if (ride && !studentMatchesRide(student, ride, studentVanId)) return false;
      if (!q) return true;
      const hay = [
        student.fullName,
        student.studentId,
        student.grade,
        student.teacherName,
        student.classroomName,
        student.parentName,
        student.homeAddress,
        student.parentPhone,
        student.parentPhone2,
        ...studentBuses(student),
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(q) || tokens.every((part) => hay.includes(part));
    })
    .sort((a, b) => {
      const busA = studentBuses(a)[0] || "";
      const busB = studentBuses(b)[0] || "";
      const byBus = busA.localeCompare(busB, undefined, { numeric: true });
      if (byBus) return byBus;
      const timeA = a.am.pickupTime || a.pm.pickupTime || "";
      const timeB = b.am.pickupTime || b.pm.pickupTime || "";
      const byTime = timeA.localeCompare(timeB, undefined, { numeric: true });
      if (byTime) return byTime;
      return a.lastName.localeCompare(b.lastName) || a.firstName.localeCompare(b.firstName);
    });
}

type DeskStudent = EffectiveStudent;

function phoneHref(value: string) {
  const digits = value.replace(/[^\d+]/g, "");
  return digits ? `tel:${digits}` : "";
}

function gradeOnly(grade: string) {
  return String(grade).replace(/^grade\s+/i, "") || "—";
}

function parentLabel(student: EffectiveStudent) {
  return student.parentName && student.parentName !== "—"
    ? student.parentName
    : "—";
}

function hasDeskChange(student: EffectiveStudent) {
  return (
    student.am.source === "TODAY" ||
    student.am.source === "DATE_RANGE" ||
    student.pm.source === "TODAY" ||
    student.pm.source === "DATE_RANGE"
  );
}

function primaryPhone(student: EffectiveStudent) {
  return student.parentPhone && student.parentPhone !== "—"
    ? student.parentPhone
    : "";
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

function leaveContactsFromStudent(student: DeskStudent | undefined) {
  return {
    parentPhone:
      student?.parentPhone && student.parentPhone !== "—"
        ? student.parentPhone
        : "",
    parentPhone2: student?.parentPhone2 || "",
    parentEmail: student?.parentEmail || "",
    teacherEmail: student?.teacherEmail || "",
  };
}

export function ReceptionDesk({
  students,
  vans = [],
  aimSchool = false,
  studentVanId = {},
  canSeeEmergency,
  initialStudentId = "",
  busCompanyEmail: startingBusCompanyEmail = "",
}: {
  students: DeskStudent[];
  buses?: string[];
  vans?: { id: string; name: string }[];
  aimSchool?: boolean;
  studentVanId?: Record<string, string>;
  canPermanent?: boolean;
  canSeeEmergency: boolean;
  initialStudentId?: string;
  busCompanyEmail?: string;
  coordinatorEmail?: string;
  frontDeskEmail?: string;
}) {
  const router = useRouter();
  const startingStudent = students.find((row) => row.id === initialStudentId);
  const initial = leaveContactsFromStudent(startingStudent);
  const [query, setQuery] = useState(() => startingQuery(students, initialStudentId));
  const [grade, setGrade] = useState("");
  const [teacher, setTeacher] = useState("");
  const [ride, setRide] = useState("");
  const [selectedId, setSelectedId] = useState(initialStudentId);
  const [openLeave, setOpenLeave] = useState(false);
  const [leaveReason, setLeaveReason] = useState("Transferred to another school");
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [parentPhone, setParentPhone] = useState(initial.parentPhone);
  const [parentPhone2, setParentPhone2] = useState(initial.parentPhone2);
  const [parentEmail, setParentEmail] = useState(initial.parentEmail);
  const [teacherEmail, setTeacherEmail] = useState(initial.teacherEmail);
  const [busCompanyEmail, setBusCompanyEmail] = useState(startingBusCompanyEmail);
  const [note, setNote] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  const [infoGrade, setInfoGrade] = useState("");
  const [infoParentName, setInfoParentName] = useState("");
  const [infoTeacherName, setInfoTeacherName] = useState("");
  const [infoTeacherEmail, setInfoTeacherEmail] = useState("");
  const [infoParentPhone, setInfoParentPhone] = useState("");
  const [openInfo, setOpenInfo] = useState(false);

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
  // Ride filter: Bus 1, Bus 2, Van 6 — one list each; AM/PM times are columns.
  const rideChoices = useMemo(() => {
    const byLabel = new Map<string, { value: string; label: string }>();
    for (const student of students) {
      for (const option of studentRideOptions(student)) {
        const key = option.label.trim().toLowerCase();
        if (!byLabel.has(key)) byLabel.set(key, option);
      }
      const vanId = studentVanId[student.id];
      if (vanId && !aimSchool) {
        const van = vans.find((row) => row.id === vanId);
        if (van) {
          const key = van.name.trim().toLowerCase();
          if (!byLabel.has(key)) {
            byLabel.set(key, { value: `van:${van.id}`, label: van.name });
          }
        }
      }
    }
    return [...byLabel.values()].sort((a, b) =>
      a.label.localeCompare(b.label, undefined, {
        numeric: true,
        sensitivity: "base",
      }),
    );
  }, [aimSchool, studentVanId, students, vans]);
  const deferredQuery = useDeferredValue(query);
  const filtered = useMemo(
    () => deskRows(students, deferredQuery, grade, teacher, ride, studentVanId),
    [students, deferredQuery, grade, teacher, ride, studentVanId],
  );
  const browsing = Boolean(query.trim() || grade || teacher || ride);
  const matches = browsing ? filtered.slice(0, 80) : filtered.slice(0, 10);
  const selected = students.find((student) => student.id === selectedId) || null;
  const familyByPhone = useMemo(() => {
    if (!selected) return [] as DeskStudent[];
    const phone = selected.parentPhone?.replace(/\D/g, "") || "";
    if (phone.length < 10) return [selected];
    const tail = phone.slice(-10);
    return students.filter((student) => {
      const other = student.parentPhone?.replace(/\D/g, "") || "";
      return other.slice(-10) === tail;
    });
  }, [selected, students]);

  function choose(student: DeskStudent) {
    setSelectedId(student.id);
    setQuery(`${student.firstName} ${student.lastName}`);
    setOpenLeave(false);
    setConfirmLeave(false);
    setLeaveReason("Transferred to another school");
    setMessage("");
    setError("");
    const next = leaveContactsFromStudent(student);
    setParentPhone(next.parentPhone);
    setParentPhone2(next.parentPhone2);
    setParentEmail(next.parentEmail);
    setTeacherEmail(next.teacherEmail);
    setNote("");
    setInfoGrade(student.grade === "—" ? "" : student.grade);
    setInfoParentName(
      student.parentName && student.parentName !== "—" ? student.parentName : "",
    );
    setInfoTeacherName(
      student.teacherName && student.teacherName !== "Unassigned"
        ? student.teacherName
        : "",
    );
    setInfoTeacherEmail(student.teacherEmail || "");
    setInfoParentPhone(
      student.parentPhone && student.parentPhone !== "—"
        ? student.parentPhone
        : "",
    );
    // Do not auto-open grade/parent — that blocked daycare and other changes.
    // Staff use Add grade / parent when they are ready to fill school info.
    setOpenInfo(false);
  }

  function removeStudent() {
    if (!selected) return;
    if (!confirmLeave) {
      setError("Check the box to confirm this student is leaving.");
      return;
    }
    if (!parentPhone.trim()) {
      setError("Primary 1 phone is required so we can text the parent.");
      return;
    }
    if (!parentEmail.trim()) {
      setError("Parent email is required.");
      return;
    }
    if (!teacherEmail.trim()) {
      setError("Teacher email is required.");
      return;
    }
    if (!busCompanyEmail.trim()) {
      setError("Bus company email is required.");
      return;
    }
    setError("");
    setMessage("");
    startTransition(async () => {
      const result = await removeReceptionStudent({
        studentId: selected.id,
        reason: leaveReason,
        note,
        parentPhone,
        parentPhone2,
        parentEmail,
        teacherEmail,
        busCompanyEmail,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setMessage(result.message);
      setOpenLeave(false);
      setSelectedId("");
      setQuery("");
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
            {aimSchool ? "Bus" : "Bus or van"}
            <select
              value={ride}
              onChange={(event) => {
                const value = event.target.value;
                setRide(value);
                setSelectedId("");
                if (!value) setQuery("");
              }}
              className="mt-1 w-full rounded-xl border border-line bg-paper px-3 py-2.5 text-sm font-medium text-navy"
            >
              <option value="">
                {aimSchool ? "All buses" : "All buses and vans"}
              </option>
              <option value="none">
                {aimSchool ? "No bus" : "No bus or van"}
              </option>
              <option value="waiting">Request for route</option>
              {rideChoices.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>

      {!selected ? (
        <div className="min-w-0">
          <p className="mb-2 text-xs text-muted sm:hidden">
            Scroll left and right to see every column.
          </p>
          <div className="desk-table-scroll rounded-2xl border border-line bg-card">
          <table className="w-max min-w-full text-left text-sm">
            <thead className="bg-paper text-base font-bold text-navy">
              <tr>
                <th className="whitespace-nowrap px-4 py-3">First Name</th>
                <th className="whitespace-nowrap py-3 pr-3">Last Name</th>
                <th className="whitespace-nowrap py-3 pr-3">Grade</th>
                <th className="whitespace-nowrap py-3 pr-3">Parent</th>
                <th className="whitespace-nowrap py-3 pr-3">Teacher</th>
                <th className="whitespace-nowrap py-3 pr-3">Teacher email</th>
                <th className="whitespace-nowrap py-3 pr-3">Addr Line1</th>
                <th className="whitespace-nowrap py-3 pr-3">City/State/Zip</th>
                <th className="whitespace-nowrap py-3 pr-3">Phone Number</th>
                <th className="whitespace-nowrap py-3 pr-3">AM Pickup</th>
                <th className="whitespace-nowrap py-3 pr-4">PM Pickup</th>
              </tr>
            </thead>
            <tbody>
              {matches.map((student) => {
                const phone = primaryPhone(student);
                const call = phone ? phoneHref(phone) : "";
                const addressParts = (student.homeAddress || "")
                  .split(",")
                  .map((part) => part.trim())
                  .filter(Boolean);
                const line1 = addressParts[0] || "—";
                const cityZip =
                  addressParts.length > 1
                    ? addressParts.slice(1).join(", ")
                    : "—";
                const teacher =
                  teacherLabel(student) === "No teacher"
                    ? "Unassigned"
                    : teacherLabel(student);
                return (
                  <tr
                    key={student.id}
                    className="cursor-pointer border-t border-line hover:bg-paper"
                    onClick={() => choose(student)}
                  >
                    <td className="whitespace-nowrap px-4 py-3 font-semibold">
                      {student.firstName}
                      {hasDeskChange(student) ? (
                        <div className="text-[11px] font-semibold text-amber-800">
                          Changed today
                        </div>
                      ) : null}
                    </td>
                    <td className="whitespace-nowrap py-3 pr-3 font-semibold">
                      {student.lastName}
                    </td>
                    <td className="whitespace-nowrap py-3 pr-3">
                      {gradeOnly(student.grade)}
                    </td>
                    <td className="whitespace-nowrap py-3 pr-3">
                      {parentLabel(student)}
                    </td>
                    <td className="whitespace-nowrap py-3 pr-3">{teacher}</td>
                    <td className="whitespace-nowrap py-3 pr-3 text-muted">
                      {student.teacherEmail || "—"}
                    </td>
                    <td className="whitespace-nowrap py-3 pr-3 text-muted">
                      {line1}
                    </td>
                    <td className="whitespace-nowrap py-3 pr-3 text-muted">
                      {cityZip}
                    </td>
                    <td className="whitespace-nowrap py-3 pr-3">
                      {phone && call ? (
                        <a
                          href={call}
                          onClick={(event) => event.stopPropagation()}
                          className="font-medium text-navy underline-offset-2 hover:underline"
                        >
                          {phone}
                        </a>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="whitespace-nowrap py-3 pr-3 font-semibold text-navy">
                      {student.am.pickupTime || "—"}
                    </td>
                    <td className="whitespace-nowrap py-3 pr-4 font-semibold text-navy">
                      {student.pm.pickupTime || "—"}
                    </td>
                  </tr>
                );
              })}
              {!students.length ? (
                <tr>
                  <td colSpan={11} className="px-4 py-3 text-muted">
                    No students on the roster yet. Load them on Roster.
                  </td>
                </tr>
              ) : !matches.length ? (
                <tr>
                  <td colSpan={11} className="px-4 py-3 text-muted">
                    No student matches those filters.
                  </td>
                </tr>
              ) : (
                <tr>
                  <td colSpan={11} className="px-4 py-2 text-xs text-muted">
                    {filtered.length > matches.length
                      ? `Showing ${matches.length} of ${filtered.length}. Type a name or use the filters to see the rest.`
                      : `${matches.length} student${matches.length === 1 ? "" : "s"}`}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          </div>
        </div>
      ) : null}

      {selected ? (
        <section className="rounded-2xl border border-line bg-card p-5 shadow-sm sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="font-serif text-3xl">{selected.fullName}</h2>
              <p className="mt-1 text-muted">
                {selected.studentId} · Grade {selected.grade}
                {selected.teacherName ? ` · ${selected.teacherName}` : ""}
                {selected.parentName && selected.parentName !== "—"
                  ? ` · Parent ${selected.parentName}`
                  : ""}
              </p>
              {hasDeskChange(selected) ? (
                <p className="mt-2 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-950">
                  Already changed today
                  {selected.lastUpdatedBy ? ` by ${selected.lastUpdatedBy}` : ""}
                  . Use Submit new request if that needs another update.
                </p>
              ) : null}
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => {
                  setSelectedId("");
                  setQuery("");
                  setOpenLeave(false);
                }}
                className="rounded-full border border-line px-4 py-2 text-sm font-semibold"
              >
                Back to list
              </button>
              {!openLeave ? (
                <>
                  <Link
                    href="/waiting"
                    className="rounded-full bg-navy px-5 py-2.5 text-sm font-semibold text-white"
                  >
                    Submit new request
                  </Link>
                  <button
                    type="button"
                    onClick={() => {
                      setOpenLeave(false);
                      setOpenInfo((value) => !value);
                      setError("");
                    }}
                    className="rounded-full border border-line px-5 py-2.5 text-sm font-semibold"
                  >
                    {openInfo ? "Hide grade / parent" : "Add grade / parent"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setOpenInfo(false);
                      setOpenLeave(true);
                      setConfirmLeave(false);
                      setError("");
                    }}
                    className="rounded-full border border-line px-5 py-2.5 text-sm font-semibold text-red"
                  >
                    Student left school
                  </button>
                </>
              ) : null}
            </div>
          </div>

          {openInfo ? (
            <form
              className="mt-5 rounded-xl border border-line bg-paper p-4"
              onSubmit={(event) => {
                event.preventDefault();
                setError("");
                setMessage("");
                startTransition(async () => {
                  const result = await saveReceptionStudentInfo({
                    studentId: selected.id,
                    grade: infoGrade,
                    parentName: infoParentName,
                    teacherName: infoTeacherName,
                    teacherEmail: infoTeacherEmail,
                    parentPhone: infoParentPhone,
                  });
                  if (!result.ok) {
                    setError(result.error);
                    return;
                  }
                  setMessage(result.message);
                  setOpenInfo(false);
                  router.refresh();
                });
              }}
            >
              <h3 className="font-serif text-2xl text-navy">
                Grade, parent, and family phone
              </h3>
              <p className="mt-1 text-sm text-muted">
                Optional school info for Front Desk. Not required for daycare or
                bus changes, and not shown on the driver print list. Same phone
                groups siblings as one family.
              </p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <label className="block text-sm font-semibold">
                  Grade
                  <input
                    value={infoGrade}
                    onChange={(event) => setInfoGrade(event.target.value)}
                    placeholder="K or 1"
                    className="mt-1 w-full rounded-xl border border-line bg-card px-3 py-2 font-normal"
                  />
                </label>
                <label className="block text-sm font-semibold">
                  Parent name
                  <input
                    value={infoParentName}
                    onChange={(event) => setInfoParentName(event.target.value)}
                    placeholder="Parent full name"
                    className="mt-1 w-full rounded-xl border border-line bg-card px-3 py-2 font-normal"
                  />
                </label>
                <label className="block text-sm font-semibold">
                  Teacher
                  <input
                    value={infoTeacherName}
                    onChange={(event) => setInfoTeacherName(event.target.value)}
                    placeholder="Teacher name"
                    className="mt-1 w-full rounded-xl border border-line bg-card px-3 py-2 font-normal"
                  />
                </label>
                <label className="block text-sm font-semibold">
                  Teacher email
                  <input
                    type="email"
                    value={infoTeacherEmail}
                    onChange={(event) => setInfoTeacherEmail(event.target.value)}
                    placeholder="teacher@school.org"
                    className="mt-1 w-full rounded-xl border border-line bg-card px-3 py-2 font-normal"
                  />
                </label>
                <label className="block text-sm font-semibold">
                  Primary 1 phone
                  <input
                    value={infoParentPhone}
                    onChange={(event) => setInfoParentPhone(event.target.value)}
                    placeholder="(612) 555-0100"
                    className="mt-1 w-full rounded-xl border border-line bg-card px-3 py-2 font-normal"
                  />
                </label>
              </div>
              {familyByPhone.length > 1 ? (
                <p className="mt-3 text-sm font-semibold text-navy">
                  Same phone family · {familyByPhone.map((row) => row.fullName).join(", ")}
                </p>
              ) : (
                <p className="mt-3 text-sm text-muted">
                  Students with this phone will group as one family after you save.
                </p>
              )}
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="submit"
                  disabled={pending}
                  className="rounded-full bg-navy px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
                >
                  {pending ? "Saving…" : "Save student info"}
                </button>
                <button
                  type="button"
                  onClick={() => setOpenInfo(false)}
                  className="rounded-full border border-line px-5 py-2.5 text-sm font-semibold"
                >
                  Close
                </button>
              </div>
            </form>
          ) : null}

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
              {selected.am.pickupTime ? (
                <p className="mt-1 text-sm font-semibold text-navy">
                  Pickup {selected.am.pickupTime}
                </p>
              ) : null}
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
              {selected.pm.pickupTime ? (
                <p className="mt-1 text-sm font-semibold text-navy">
                  Pickup {selected.pm.pickupTime}
                </p>
              ) : null}
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
              label="Primary 1 phone"
              value={selected.parentPhone}
              href={phoneHref(selected.parentPhone)}
            />
            <Field
              label="Primary 2 phone"
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

          {openLeave ? (
            <form
              className="mt-6 space-y-4 rounded-2xl border border-gold bg-paper p-4"
              onSubmit={(event) => {
                event.preventDefault();
                if (!event.currentTarget.reportValidity()) return;
                removeStudent();
              }}
            >
              <h3 className="font-serif text-2xl">Student left school</h3>
              <p className="text-sm text-muted">
                Use this when a student transfers or enrolls at another school.
                They leave Front Desk, Reports, and the bus list. Parent,
                teacher, and the bus company get the same notice as a
                transportation change. You can put them back from Roster
                Archive.
              </p>

              <fieldset className="space-y-2">
                <legend className="text-sm font-semibold">Why they left</legend>
                <div className="flex flex-wrap gap-2">
                  {(
                    [
                      "Transferred to another school",
                      "Enrolled at another school",
                      "No longer needs transportation",
                    ] as const
                  ).map((value) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setLeaveReason(value)}
                      className={`rounded-full px-4 py-2 text-sm font-semibold ${
                        leaveReason === value
                          ? "bg-navy text-white"
                          : "border border-line bg-card"
                      }`}
                    >
                      {value}
                    </button>
                  ))}
                </div>
              </fieldset>

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <label className="block text-sm font-semibold">
                  Primary 1 phone (required)
                  <input
                    type="tel"
                    required
                    value={parentPhone}
                    onChange={(event) => setParentPhone(event.target.value)}
                    placeholder="Required"
                    className="mt-1 w-full rounded-xl border border-line bg-card px-3 py-2 font-normal"
                  />
                </label>
                <label className="block text-sm font-semibold">
                  Primary 2 phone (optional)
                  <input
                    type="tel"
                    value={parentPhone2}
                    onChange={(event) => setParentPhone2(event.target.value)}
                    placeholder="Optional"
                    className="mt-1 w-full rounded-xl border border-line bg-card px-3 py-2 font-normal"
                  />
                </label>
                <label className="block text-sm font-semibold">
                  Parent email (required)
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
                  Teacher email (required)
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
                  Bus company email (required)
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

              <label className="block text-sm font-semibold">
                Note (optional new school name)
                <textarea
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  rows={2}
                  className="mt-1 w-full rounded-xl border border-line bg-card px-3 py-2 font-normal"
                />
              </label>

              <label className="flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={confirmLeave}
                  onChange={(event) => setConfirmLeave(event.target.checked)}
                />
                <span>
                  I confirm this student is leaving. Notify parent, teacher, and
                  the bus company, then take them off the list.
                </span>
              </label>

              {error ? <p className="text-sm text-red">{error}</p> : null}

              <div className="flex flex-wrap gap-2">
                <button
                  type="submit"
                  disabled={pending || !confirmLeave}
                  className="rounded-full bg-navy px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
                >
                  {pending ? "Removing…" : "Remove and notify"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setOpenLeave(false);
                    setConfirmLeave(false);
                    setError("");
                  }}
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
