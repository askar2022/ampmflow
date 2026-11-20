import { formatDateTime } from "./dates";
import { companyAssignmentLabel, isWaitingRide } from "./format";
import { prisma } from "./prisma";
import { toEffective } from "./transportation";
import type { EffectiveStudent } from "./types";

export type SchoolOpenRequestKind =
  | "New route request"
  | "New address change"
  | "New daycare change"
  | "Bus change";

export type SchoolOpenRequestRow = {
  id: string;
  name: string;
  grade: string;
  teacher: string;
  parent: string;
  kind: SchoolOpenRequestKind;
  detail: string;
  requestDate: string;
  company: string;
  waiting: boolean;
};

function kindForStudent(student: EffectiveStudent): SchoolOpenRequestKind {
  for (const plan of [student.pm, student.am]) {
    if (plan.destination === "DAYCARE") return "New daycare change";
    if (plan.destination === "CUSTOM") return "New address change";
  }
  if (
    student.enrollmentSource === "ROUTE_REQUEST" ||
    student.enrollmentSource === "NEW_APPLICATION"
  ) {
    return "New route request";
  }
  if (isWaitingRide(student)) return "New route request";
  return "Bus change";
}

function detailForStudent(student: EffectiveStudent) {
  for (const plan of [student.pm, student.am]) {
    if (plan.destination === "DAYCARE") {
      return (
        student.daycareAddress ||
        plan.daycareName ||
        student.daycareName ||
        "Daycare"
      );
    }
    if (plan.destination === "CUSTOM") {
      return plan.customAddress || "New address";
    }
  }
  if (student.homeAddress && student.homeAddress !== "—") {
    return student.homeAddress;
  }
  return "—";
}

function kindFromChangeRequest(row: {
  title: string;
  details: string;
  payload?: string | null;
}): SchoolOpenRequestKind {
  const blob = `${row.title} ${row.details} ${row.payload || ""}`;
  if (/daycare/i.test(blob) || /"DAYCARE"/i.test(blob)) {
    return "New daycare change";
  }
  if (
    /address change/i.test(blob) ||
    /new address/i.test(blob) ||
    /"CUSTOM"/i.test(blob)
  ) {
    return "New address change";
  }
  if (/request for route/i.test(row.title) || /new route/i.test(blob)) {
    return "New route request";
  }
  return "Bus change";
}

function detailFromChangeRequest(row: {
  details: string;
  payload?: string | null;
}) {
  try {
    const payload = row.payload ? JSON.parse(row.payload) : null;
    if (payload?.daycareName) return String(payload.daycareName);
    if (payload?.customAddress) return String(payload.customAddress);
  } catch {
    // ignore bad payload
  }
  return (
    row.details
      .split("·")
      .map((part) => part.trim())
      .find(
        (part) =>
          part &&
          !/^grade\s+/i.test(part) &&
          !/@/.test(part) &&
          !/^waiting for/i.test(part) &&
          !/^entered by/i.test(part),
      ) || ""
  );
}

/**
 * One school list for every unfinished request: new route, address, daycare.
 * Loads only students tied to open work — not the whole roster.
 */
export async function loadSchoolOpenRequests(
  schoolId: string,
): Promise<SchoolOpenRequestRow[]> {
  const [openRequests, recentTemps] = await Promise.all([
    prisma.changeRequest.findMany({
      where: {
        schoolId,
        status: { in: ["PENDING", "NEEDS_CLARIFICATION"] },
      },
      select: {
        id: true,
        studentId: true,
        title: true,
        details: true,
        payload: true,
        createdAt: true,
        busNumber: true,
      },
      orderBy: { createdAt: "asc" },
    }),
    prisma.temporaryChange.findMany({
      where: {
        undone: false,
        status: "APPROVED",
        waitingForAssignment: true,
        student: { schoolId, active: true },
      },
      select: {
        studentId: true,
        createdAt: true,
        destination: true,
        customAddress: {
          select: { line1: true, city: true, state: true, zip: true },
        },
        daycare: { select: { name: true } },
      },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  const linkedIds = [
    ...new Set(
      [
        ...openRequests.map((row) => row.studentId).filter(Boolean),
        ...recentTemps.map((row) => row.studentId),
      ].filter((id): id is string => Boolean(id)),
    ),
  ];

  // One query for every student that could appear — no N+1 loadStudent calls.
  const rows = await prisma.student.findMany({
    where: {
      schoolId,
      active: true,
      OR: [
        ...(linkedIds.length ? [{ id: { in: linkedIds } }] : []),
        { enrollmentSource: { in: ["ROUTE_REQUEST", "NEW_APPLICATION"] } },
        { assignments: { some: { waitingForAssignment: true } } },
        {
          tempChanges: {
            some: {
              undone: false,
              status: "APPROVED",
              waitingForAssignment: true,
            },
          },
        },
      ],
    },
    include: {
      classroom: {
        include: {
          teachers: { select: { id: true, name: true, email: true } },
        },
      },
      homeAddress: true,
      daycare: { include: { address: true } },
      assignments: {
        include: {
          busRoute: { select: { number: true, loadingLocation: true } },
          daycare: { select: { name: true } },
          customAddress: true,
        },
      },
      tempChanges: {
        where: { undone: false, status: "APPROVED" },
        include: {
          busRoute: { select: { number: true, loadingLocation: true } },
          daycare: { select: { name: true } },
          customAddress: true,
        },
      },
    },
  });

  const byStudentId = new Map<string, EffectiveStudent>();
  for (const row of rows) {
    try {
      byStudentId.set(row.id, toEffective(row));
    } catch {
      // Skip a bad roster row.
    }
  }

  const byId = new Map<
    string,
    {
      student: EffectiveStudent;
      requestedAt: Date;
      kind?: SchoolOpenRequestKind;
      detail?: string;
    }
  >();

  function remember(
    student: EffectiveStudent,
    requestedAt: Date,
    kind?: SchoolOpenRequestKind,
    detail?: string,
  ) {
    const existing = byId.get(student.id);
    if (!existing || requestedAt < existing.requestedAt) {
      byId.set(student.id, { student, requestedAt, kind, detail });
      return;
    }
    if (kind && !existing.kind) existing.kind = kind;
    if (detail && !existing.detail) existing.detail = detail;
  }

  for (const row of openRequests) {
    const studentId = row.studentId;
    if (!studentId) continue;
    const student = byStudentId.get(studentId);
    if (!student) continue;
    remember(
      student,
      row.createdAt,
      kindFromChangeRequest(row),
      detailFromChangeRequest(row) || detailForStudent(student),
    );
  }

  for (const student of byStudentId.values()) {
    const needsCompany =
      isWaitingRide(student) ||
      student.enrollmentSource === "ROUTE_REQUEST" ||
      student.enrollmentSource === "NEW_APPLICATION";
    if (!needsCompany) continue;
    const match = openRequests.find((row) => row.studentId === student.id);
    remember(
      student,
      match?.createdAt || new Date(),
      match ? kindFromChangeRequest(match) : kindForStudent(student),
      match
        ? detailFromChangeRequest(match) || detailForStudent(student)
        : detailForStudent(student),
    );
  }

  for (const temp of recentTemps) {
    const student = byStudentId.get(temp.studentId);
    if (!student) continue;
    const kind: SchoolOpenRequestKind =
      temp.destination === "DAYCARE"
        ? "New daycare change"
        : temp.destination === "CUSTOM"
          ? "New address change"
          : "Bus change";
    const detail =
      temp.destination === "DAYCARE"
        ? temp.daycare?.name || "Daycare"
        : temp.destination === "CUSTOM" && temp.customAddress
          ? `${temp.customAddress.line1}, ${temp.customAddress.city}`
          : detailForStudent(student);
    remember(student, temp.createdAt, kind, detail);
  }

  return [...byId.values()]
    .map(({ student, requestedAt, kind, detail }) => ({
      id: student.id,
      name: student.fullName,
      grade: student.grade,
      teacher: student.teacherName || "—",
      parent:
        student.parentName && student.parentName !== "—"
          ? student.parentName
          : "—",
      kind: kind || kindForStudent(student),
      detail: detail || detailForStudent(student),
      requestDate: formatDateTime(requestedAt),
      company: companyAssignmentLabel(student),
      waiting: isWaitingRide(student),
      requestedAt,
    }))
    .sort((a, b) => a.requestedAt.getTime() - b.requestedAt.getTime())
    .map(({ requestedAt: _r, ...row }) => row);
}
