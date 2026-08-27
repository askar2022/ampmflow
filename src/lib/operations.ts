import { prisma } from "./prisma";
import { todayKey } from "./dates";
import { dashboardSummary, loadStudents } from "./transportation";
import { planSummary } from "./format";
import { startOfWeek, subDays, format } from "date-fns";

function eventKey(event: {
  studentId: string;
  trip: string;
  previousPlan: string;
  newPlan: string;
  waitingForRoute: boolean;
}) {
  return [
    event.studentId,
    event.trip,
    eventPlanLabel(event.previousPlan),
    eventPlanLabel(event.newPlan),
    event.waitingForRoute ? "wait" : "ready",
  ].join("|");
}

export function uniqueStudentCount(events: { studentId: string }[]) {
  return new Set(events.map((event) => event.studentId)).size;
}

export async function collapseDuplicateEvents(
  schoolId: string,
  day = todayKey(),
  endDay = day,
) {
  const events = await prisma.changeEvent.findMany({
    where: {
      schoolId,
      createdAt: {
        gte: new Date(`${day}T00:00:00`),
        lte: new Date(`${endDay}T23:59:59`),
      },
    },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      studentId: true,
      trip: true,
      previousPlan: true,
      newPlan: true,
      waitingForRoute: true,
    },
  });
  const seen = new Set<string>();
  const extraIds: string[] = [];
  for (const event of events) {
    const key = eventKey(event);
    if (seen.has(key)) extraIds.push(event.id);
    else seen.add(key);
  }
  if (!extraIds.length) return;
  await prisma.teacherAcknowledgment.deleteMany({
    where: { changeEventId: { in: extraIds } },
  });
  await prisma.changeEvent.deleteMany({
    where: { id: { in: extraIds } },
  });
}

export async function loadChangeEvents(schoolId: string, day = todayKey()) {
  try {
    await collapseDuplicateEvents(schoolId, day);
  } catch {
    // Keep the list even if extras cannot be removed yet.
  }
  try {
    return await prisma.changeEvent.findMany({
      where: {
        schoolId,
        createdAt: {
          gte: new Date(`${day}T00:00:00`),
          lte: new Date(`${day}T23:59:59`),
        },
      },
      include: {
        student: { include: { classroom: { include: { teachers: true } } } },
        createdBy: true,
        acknowledgments: { include: { user: true } },
      },
      orderBy: { createdAt: "desc" },
    });
  } catch {
    return [];
  }
}

export async function unacknowledgedUrgent(schoolId: string) {
  const events = await loadChangeEvents(schoolId);
  return events.filter(
    (event) =>
      event.urgent &&
      event.acknowledgments.some((item) => !item.acknowledgedAt),
  );
}

function isTodayChange(student: Awaited<ReturnType<typeof loadStudents>>[number]) {
  return (
    student.am.source === "TODAY" ||
    student.pm.source === "TODAY" ||
    student.am.source === "DATE_RANGE" ||
    student.pm.source === "DATE_RANGE" ||
    student.am.waitingForAssignment ||
    student.pm.waitingForAssignment ||
    (student.am.type === "BUS" && !student.am.busNumber) ||
    (student.pm.type === "BUS" && !student.pm.busNumber)
  );
}

async function attachCheckIns(
  schoolId: string,
  students: Awaited<ReturnType<typeof loadStudents>>,
) {
  const day = todayKey();
  let rows: Awaited<ReturnType<typeof prisma.busCheckIn.findMany>> = [];
  try {
    rows = await prisma.busCheckIn.findMany({
      where: { schoolId, date: day, trip: "PM" },
    });
  } catch {
    rows = [];
  }
  const byStudent = new Map(rows.map((row) => [row.studentId, row]));
  return students.map((student) => ({
    student,
    checkIn: byStudent.get(student.id) ?? null,
  }));
}

export type CheckInBusSummary = {
  busNumber: string;
  onList: number;
  onBus: number;
  missing: number;
  unassigned: number;
  leftSchool: number;
  notMarked: number;
  onBusNames: string[];
  missingNames: string[];
  unassignedNames: string[];
  leftSchoolNames: string[];
  notMarkedNames: string[];
};

export async function loadCheckInSummary(
  schoolId: string,
): Promise<CheckInBusSummary[]> {
  const rows = await loadCheckIns(schoolId);
  const byBus = new Map<string, typeof rows>();
  for (const row of rows) {
    const number = row.student.pm.busNumber || "No bus yet";
    const list = byBus.get(number) ?? [];
    list.push(row);
    byBus.set(number, list);
  }
  return [...byBus.entries()]
    .sort(([a], [b]) => Number(a) - Number(b) || a.localeCompare(b))
    .map(([busNumber, list]) => {
      const statusOf = (status: string) =>
        list.filter((row) => row.checkIn?.status === status);
      const onBus = statusOf("ON_BUS");
      const missing = statusOf("MISSING");
      const unassigned = list.filter(
        (row) =>
          row.checkIn?.status === "UNASSIGNED" ||
          row.checkIn?.status === "WRONG",
      );
      const leftSchool = statusOf("LEFT_SCHOOL");
      const notMarked = list.filter((row) => !row.checkIn?.status);
      return {
        busNumber,
        onList: list.length,
        onBus: onBus.length,
        missing: missing.length,
        unassigned: unassigned.length,
        leftSchool: leftSchool.length,
        notMarked: notMarked.length,
        onBusNames: onBus.map((row) => row.student.fullName),
        missingNames: missing.map((row) => row.student.fullName),
        unassignedNames: unassigned.map((row) => row.student.fullName),
        leftSchoolNames: leftSchool.map((row) => row.student.fullName),
        notMarkedNames: notMarked.map((row) => row.student.fullName),
      };
    });
}

export async function loadCheckIns(schoolId: string, busNumber?: string) {
  const students = (await loadStudents(schoolId)).filter((student) => {
    if (!busNumber) return student.pm.type === "BUS" && student.pm.busNumber;
    return student.pm.busNumber === busNumber;
  });
  return attachCheckIns(schoolId, students);
}

export async function loadCompanyApprovedBuses(schoolId: string) {
  const day = todayKey();
  const start = new Date(`${day}T00:00:00`);
  const requests = await prisma.changeRequest.findMany({
    where: {
      schoolId,
      status: { in: ["APPROVED", "COMPLETED"] },
      studentId: { not: null },
      busNumber: { not: null },
      OR: [{ reviewedAt: { gte: start } }, { createdAt: { gte: start } }],
    },
    select: { studentId: true, busNumber: true },
  });
  const map = new Map<string, string>();
  for (const row of requests) {
    if (row.studentId && row.busNumber) {
      map.set(row.studentId, row.busNumber.replace(/^Bus\s+/i, ""));
    }
  }
  return map;
}

export async function loadChangeCheckIns(schoolId: string) {
  const day = todayKey();
  const all = await loadStudents(schoolId);
  const requestRows = await prisma.changeRequest.findMany({
    where: {
      schoolId,
      studentId: { not: null },
      createdAt: {
        gte: new Date(`${day}T00:00:00`),
        lte: new Date(`${day}T23:59:59`),
      },
    },
    select: { studentId: true },
  });
  const requestIds = new Set(
    requestRows.map((row) => row.studentId).filter(Boolean) as string[],
  );
  const students = all.filter(
    (student) => isTodayChange(student) || requestIds.has(student.id),
  );
  return attachCheckIns(schoolId, students);
}

export async function leadershipStats(schoolId: string) {
  const students = await loadStudents(schoolId);
  const summary = dashboardSummary(students);
  const weekStart = format(startOfWeek(new Date(), { weekStartsOn: 1 }), "yyyy-MM-dd");
  try {
    await collapseDuplicateEvents(schoolId, weekStart, todayKey());
  } catch {
    // Keep the page even if extras cannot be removed yet.
  }
  const events = await loadChangeEvents(schoolId);
  let weekEvents = events;
  try {
    weekEvents = await prisma.changeEvent.findMany({
      where: {
        schoolId,
        createdAt: { gte: new Date(`${weekStart}T00:00:00`) },
      },
      include: {
        student: { include: { classroom: { include: { teachers: true } } } },
        createdBy: true,
        acknowledgments: { include: { user: true } },
      },
    });
  } catch {
    weekEvents = events;
  }

  const buses = new Map<string, number>();
  for (const student of students) {
    if (student.pm.type === "BUS" && student.pm.busNumber) {
      buses.set(student.pm.busNumber, (buses.get(student.pm.busNumber) ?? 0) + 1);
    }
  }

  const days = [0, 1, 2, 3, 4].map((offset) => {
    const key = format(subDays(new Date(), 4 - offset), "yyyy-MM-dd");
    const dayEvents = weekEvents.filter(
      (event) => event.createdAt.toISOString().slice(0, 10) === key,
    );
    return {
      day: format(new Date(`${key}T12:00:00`), "EEEE"),
      date: key,
      total: uniqueStudentCount(dayEvents),
      temporary: uniqueStudentCount(
        dayEvents.filter((event) => event.durationType !== "PERMANENT"),
      ),
      permanent: uniqueStudentCount(
        dayEvents.filter((event) => event.durationType === "PERMANENT"),
      ),
      late: uniqueStudentCount(
        dayEvents.filter((event) => event.late || event.urgent),
      ),
    };
  });

  const distinctByStudent = new Map<string, Set<string>>();
  for (const event of weekEvents) {
    const change = `${eventPlanLabel(event.previousPlan)}→${eventPlanLabel(event.newPlan)}`;
    const set = distinctByStudent.get(event.studentId) ?? new Set<string>();
    set.add(change);
    distinctByStudent.set(event.studentId, set);
  }
  const repeated = [...distinctByStudent.entries()]
    .filter(([, changes]) => changes.size > 1)
    .map(([id, changes]) => {
      const student = students.find((row) => row.id === id);
      return { name: student?.fullName ?? id, count: changes.size };
    });

  const acknowledged = weekEvents.filter((event) =>
    event.acknowledgments.every((item) => item.acknowledgedAt),
  ).length;

  return {
    students,
    summary,
    events,
    weekEvents,
    buses: [...buses.entries()].sort((a, b) => Number(a[0]) - Number(b[0])),
    days,
    repeated,
    todayChangeStudents: uniqueStudentCount(events),
    weekChangeStudents: uniqueStudentCount(weekEvents),
    lateCount: uniqueStudentCount(
      weekEvents.filter((event) => event.late || event.urgent),
    ),
    temporaryCount: weekEvents.filter((e) => e.durationType !== "PERMANENT").length,
    permanentCount: weekEvents.filter((e) => e.durationType === "PERMANENT").length,
    ackRate: weekEvents.length
      ? Math.round((acknowledged / weekEvents.length) * 100)
      : 100,
    waiting: students.filter(
      (s) => s.am.waitingForAssignment || s.pm.waitingForAssignment,
    ),
  };
}

export function eventPlanLabel(raw: string) {
  try {
    const plan = JSON.parse(raw);
    if (plan.type === "PARENT") return "Parent pickup";
    if (plan.busNumber) return `Bus ${plan.busNumber}`;
    if (plan.waitingForAssignment) return "Waiting for route";
    return planSummary(plan);
  } catch {
    return raw;
  }
}
