import { ensureGateTables } from "./gate";
import { prisma } from "./prisma";
import { dateInRange, todayKey } from "./dates";
import { formatAddress, locationFor } from "./format";
import type {
  Destination,
  EffectiveStudent,
  PlanSnapshot,
  TransportType,
  Trip,
} from "./types";

const studentInclude = {
  classroom: {
    include: { teachers: true },
  },
  homeAddress: true,
  daycare: { include: { address: true } },
  assignments: {
    include: {
      busRoute: true,
      daycare: true,
      customAddress: true,
      updatedBy: true,
    },
  },
  tempChanges: {
    include: {
      busRoute: true,
      daycare: true,
      customAddress: true,
      createdBy: true,
      approvedBy: true,
    },
  },
} as const;

export type StudentRecord = Awaited<
  ReturnType<typeof prisma.student.findFirst<{ include: typeof studentInclude }>>
>;

function emptyPlan(trip: Trip): PlanSnapshot {
  return {
    trip,
    type: null,
    destination: null,
    busNumber: null,
    daycareName: null,
    customAddress: null,
    waitingForAssignment: false,
    notes: "",
    source: "MISSING",
    location: "See coordinator",
  };
}

function fromAssignment(
  assignment: NonNullable<StudentRecord>["assignments"][number],
): PlanSnapshot {
  const type = assignment.type as TransportType;
  const plan: PlanSnapshot = {
    trip: assignment.trip as Trip,
    type,
    destination: assignment.destination as Destination,
    busNumber: assignment.busRoute?.number ?? null,
    daycareName: assignment.daycare?.name ?? null,
    customAddress: assignment.customAddress
      ? formatAddress(assignment.customAddress)
      : null,
    waitingForAssignment: assignment.waitingForAssignment,
    notes: assignment.notes,
    source: "PERMANENT",
    location:
      type === "PARENT"
        ? "Parent pickup area"
        : assignment.busRoute?.loadingLocation || "Bus loading area",
    startDate: assignment.effectiveStart
      ? assignment.effectiveStart.toISOString().slice(0, 10)
      : null,
    endDate: assignment.effectiveEnd
      ? assignment.effectiveEnd.toISOString().slice(0, 10)
      : null,
  };
  plan.location = locationFor(plan);
  return plan;
}

function fromTemp(
  change: NonNullable<StudentRecord>["tempChanges"][number],
): PlanSnapshot {
  const type = change.type as TransportType;
  const source = change.durationType === "TODAY" ? "TODAY" : "DATE_RANGE";
  const plan: PlanSnapshot = {
    trip: change.trip as Trip,
    type,
    destination: change.destination as Destination,
    busNumber: change.busRoute?.number ?? null,
    daycareName: change.daycare?.name ?? null,
    customAddress: change.customAddress
      ? formatAddress(change.customAddress)
      : null,
    waitingForAssignment: change.waitingForAssignment,
    notes: change.reason,
    source,
    location:
      type === "PARENT"
        ? "Parent pickup area"
        : change.busRoute?.loadingLocation || "Bus loading area",
    startDate: change.startDate,
    endDate: change.endDate,
  };
  plan.location = locationFor(plan);
  return plan;
}

export function resolveTrip(
  student: NonNullable<StudentRecord>,
  trip: Trip,
  day = todayKey(),
): PlanSnapshot {
  const active = student.tempChanges.filter(
    (change) =>
      change.trip === trip &&
      !change.undone &&
      change.status === "APPROVED" &&
      dateInRange(day, change.startDate, change.endDate),
  );

  const today = active.find((change) => change.durationType === "TODAY");
  if (today) return fromTemp(today);

  const range = active.find((change) => change.durationType === "DATE_RANGE");
  if (range) return fromTemp(range);

  const permanent = student.assignments.find((item) => item.trip === trip);
  if (permanent) return fromAssignment(permanent);

  return emptyPlan(trip);
}

export function toEffective(
  student: NonNullable<StudentRecord>,
  day = todayKey(),
): EffectiveStudent {
  const teacher = student.classroom.teachers[0];
  const amUpdated = student.assignments.find((item) => item.trip === "AM");
  const pmUpdated = student.assignments.find((item) => item.trip === "PM");
  const latestAssignment = [amUpdated, pmUpdated]
    .filter(Boolean)
    .sort((a, b) => {
      const aTime = a?.updatedAt.getTime() ?? 0;
      const bTime = b?.updatedAt.getTime() ?? 0;
      return bTime - aTime;
    })[0];

  return {
    id: student.id,
    studentId: student.studentId,
    firstName: student.firstName,
    lastName: student.lastName,
    fullName: `${student.firstName} ${student.lastName}`,
    grade: student.grade,
    parentName: student.parentName,
    parentPhone: student.parentPhone,
    homeAddress: formatAddress(student.homeAddress),
    daycareName: student.daycare?.name ?? null,
    daycareAddress: student.daycare
      ? formatAddress(student.daycare.address)
      : null,
    classroomId: student.classroomId,
    classroomName: student.classroom.name,
    teacherName: teacher?.name ?? "Unassigned",
    notes: student.notes,
    am: resolveTrip(student, "AM", day),
    pm: resolveTrip(student, "PM", day),
    lastUpdatedBy: latestAssignment?.updatedBy.name ?? null,
    lastUpdatedAt: latestAssignment?.updatedAt.toISOString() ?? null,
  };
}

export async function loadStudents(schoolId: string, day = todayKey()) {
  await ensureGateTables();
  const rows = await prisma.student.findMany({
    where: { schoolId },
    include: studentInclude,
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
  });
  return rows.map((row) => toEffective(row, day));
}

export async function loadStudent(id: string, day = todayKey()) {
  await ensureGateTables();
  const row = await prisma.student.findUnique({
    where: { id },
    include: studentInclude,
  });
  if (!row) return null;
  return { record: row, effective: toEffective(row, day) };
}

export function searchStudents(students: EffectiveStudent[], query: string) {
  const q = query.trim().toLowerCase().replace(/\s+/g, " ");
  if (!q) return students;
  const tokens = q.split(" ").filter(Boolean);
  return students.filter((student) => {
    const hay = [
      student.fullName,
      student.studentId,
      student.grade,
      student.teacherName,
      student.classroomName,
      student.parentName,
      student.parentPhone,
      student.am.busNumber,
      student.pm.busNumber,
      student.homeAddress,
      student.daycareName,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase()
      .replace(/\s+/g, " ");
    return hay.includes(q) || tokens.every((part) => hay.includes(part));
  });
}

export function dashboardSummary(students: EffectiveStudent[]) {
  const busRiders = students.filter(
    (s) => s.pm.type === "BUS" && !s.pm.waitingForAssignment && s.pm.busNumber,
  ).length;
  const parentPickup = students.filter((s) => s.pm.type === "PARENT").length;
  const temporaryChanges = students.filter(
    (s) =>
      s.am.source === "TODAY" ||
      s.am.source === "DATE_RANGE" ||
      s.pm.source === "TODAY" ||
      s.pm.source === "DATE_RANGE",
  ).length;
  const missingAssignments = students.filter(
    (s) =>
      s.am.source === "MISSING" ||
      s.pm.source === "MISSING" ||
      s.am.waitingForAssignment ||
      s.pm.waitingForAssignment ||
      (s.am.type === "BUS" && !s.am.busNumber) ||
      (s.pm.type === "BUS" && !s.pm.busNumber),
  ).length;

  return {
    busRiders,
    parentPickup,
    temporaryChanges,
    missingAssignments,
    total: students.length,
  };
}

export function studentsOnBothLists(students: EffectiveStudent[]) {
  const busIds = new Set(
    students
      .filter((s) => s.pm.type === "BUS" && Boolean(s.pm.busNumber))
      .map((s) => s.id),
  );
  const pickupIds = new Set(
    students.filter((s) => s.pm.type === "PARENT").map((s) => s.id),
  );
  return students.filter((s) => busIds.has(s.id) && pickupIds.has(s.id));
}

export function addressHasNoRoute(args: {
  type: TransportType;
  destination: Destination;
  busNumber?: string | null;
  waitingForAssignment?: boolean;
}) {
  return (
    args.type === "BUS" &&
    (args.waitingForAssignment || !args.busNumber) &&
    (args.destination === "HOME" ||
      args.destination === "DAYCARE" ||
      args.destination === "CUSTOM")
  );
}
