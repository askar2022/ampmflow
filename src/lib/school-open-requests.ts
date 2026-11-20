import { formatDateTime } from "./dates";
import {
  companyAssignmentLabel,
  formatAddress,
  isWaitingRide,
} from "./format";
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
    if (payload?.address) return String(payload.address);
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

function companyFromRequest(
  row: {
    status: string;
    busNumber: string | null;
    companyNote: string;
  },
  student: EffectiveStudent | null,
) {
  const assigned = (row.busNumber || "").trim();
  if (assigned) return assigned;
  const note = (row.companyNote || "").trim();
  if (row.status === "NEEDS_CLARIFICATION" && note) {
    return `Needs check · ${note}`;
  }
  if (student) {
    const live = companyAssignmentLabel(student);
    if (live && live !== "Waiting for company") return live;
  }
  if (row.status === "COMPLETED") return "Updated by company";
  return "Waiting for company";
}

/**
 * Permanent school log of every request sent to the bus company.
 * One row per request (not per student). Newest first.
 * Completed assignments stay — they do not disappear.
 */
export async function loadSchoolOpenRequests(
  schoolId: string,
): Promise<SchoolOpenRequestRow[]> {
  const requests = await prisma.changeRequest.findMany({
    where: {
      schoolId,
      status: { in: ["PENDING", "NEEDS_CLARIFICATION", "COMPLETED"] },
      NOT: { source: "BUS_COMPANY", title: "Needs clarification" },
    },
    select: {
      id: true,
      studentId: true,
      title: true,
      details: true,
      payload: true,
      status: true,
      busNumber: true,
      companyNote: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
  });

  const studentIds = [
    ...new Set(
      requests
        .map((row) => row.studentId)
        .filter((id): id is string => Boolean(id)),
    ),
  ];

  const studentInclude = {
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
  } as const;

  const studentRows = studentIds.length
    ? await prisma.student.findMany({
        where: { schoolId, id: { in: studentIds } },
        include: studentInclude,
      })
    : [];

  const byStudentId = new Map<string, EffectiveStudent>();
  for (const row of studentRows) {
    try {
      byStudentId.set(row.id, toEffective(row));
    } catch {
      // Skip a bad roster row.
    }
  }

  const covered = new Set(studentIds);
  const waitingTemps = await prisma.temporaryChange.findMany({
    where: {
      undone: false,
      status: "APPROVED",
      waitingForAssignment: true,
      student: { schoolId, active: true },
      ...(covered.size
        ? { studentId: { notIn: [...covered] } }
        : {}),
    },
    select: {
      id: true,
      studentId: true,
      createdAt: true,
      destination: true,
      customAddress: {
        select: { line1: true, city: true, state: true, zip: true },
      },
      daycare: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const missingIds = [
    ...new Set(
      waitingTemps
        .map((temp) => temp.studentId)
        .filter((id) => !byStudentId.has(id)),
    ),
  ];
  if (missingIds.length) {
    const extra = await prisma.student.findMany({
      where: { schoolId, id: { in: missingIds } },
      include: studentInclude,
    });
    for (const row of extra) {
      try {
        byStudentId.set(row.id, toEffective(row));
      } catch {
        // skip
      }
    }
  }

  type DatedRow = SchoolOpenRequestRow & { sortAt: number };
  const rows: DatedRow[] = [];

  for (const row of requests) {
    const student = row.studentId
      ? byStudentId.get(row.studentId) || null
      : null;
    const waiting =
      row.status === "PENDING" || row.status === "NEEDS_CLARIFICATION";
    rows.push({
      id: row.id,
      name:
        student?.fullName ||
        row.title.replace(/^request for route:\s*/i, "").trim() ||
        "Student",
      grade: student?.grade || "—",
      teacher: student?.teacherName || "—",
      parent:
        student?.parentName && student.parentName !== "—"
          ? student.parentName
          : "—",
      kind: kindFromChangeRequest(row),
      detail:
        detailFromChangeRequest(row) ||
        (student ? detailForStudent(student) : "") ||
        "—",
      requestDate: formatDateTime(row.createdAt),
      company: companyFromRequest(row, student),
      waiting,
      sortAt: row.createdAt.getTime(),
    });
  }

  for (const temp of waitingTemps) {
    const student = byStudentId.get(temp.studentId);
    if (!student) continue;
    const kind: SchoolOpenRequestKind =
      temp.destination === "DAYCARE"
        ? "New daycare change"
        : temp.destination === "CUSTOM"
          ? "New address change"
          : kindForStudent(student);
    const detail =
      temp.destination === "DAYCARE"
        ? temp.daycare?.name || "Daycare"
        : temp.destination === "CUSTOM" && temp.customAddress
          ? formatAddress(temp.customAddress)
          : detailForStudent(student);
    rows.push({
      id: `temp-${temp.id}`,
      name: student.fullName,
      grade: student.grade,
      teacher: student.teacherName || "—",
      parent:
        student.parentName && student.parentName !== "—"
          ? student.parentName
          : "—",
      kind,
      detail,
      requestDate: formatDateTime(temp.createdAt),
      company: "Waiting for company",
      waiting: true,
      sortAt: temp.createdAt.getTime(),
    });
  }

  return rows
    .sort((a, b) => b.sortAt - a.sortAt)
    .map(({ sortAt: _sortAt, ...row }) => row);
}
