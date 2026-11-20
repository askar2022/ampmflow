import { prisma } from "./prisma";
import { isWaitingRide } from "./format";
import { toEffective } from "./transportation";
import type { EffectiveStudent } from "./types";

type OpenRequestRow = {
  id: string;
  schoolId: string;
  studentId: string | null;
  title: string;
  details: string;
  payload: string | null;
  status: string;
  createdAt: Date;
  createdById: string;
  busNumber: string | null;
};

export type CompanyOpenStudent = {
  /** Change-request id (or temp- fallback). One row per request. */
  id: string;
  student: EffectiveStudent;
  requestedAt: Date;
  changeRequestId: string | null;
  status: string;
  busNumber: string | null;
  title: string;
  details: string;
  payload: string | null;
};

function nameFromRouteTitle(title: string) {
  return title.replace(/^Request for route\s*[—\-]\s*/i, "").trim();
}

async function findStudentByName(schoolIds: string[], title: string) {
  const full = nameFromRouteTitle(title);
  const parts = full.split(/\s+/).filter(Boolean);
  if (parts.length < 2) return null;
  const firstName = parts[0];
  const lastName = parts.slice(1).join(" ");
  const exact = await prisma.student.findFirst({
    where: {
      schoolId: { in: schoolIds },
      active: true,
      firstName: { equals: firstName, mode: "insensitive" },
      lastName: { equals: lastName, mode: "insensitive" },
    },
    select: { id: true },
  });
  if (exact) return exact;

  const prefix = lastName.slice(0, Math.min(4, lastName.length));
  if (prefix.length < 2) return null;
  return prisma.student.findFirst({
    where: {
      schoolId: { in: schoolIds },
      active: true,
      firstName: { equals: firstName, mode: "insensitive" },
      lastName: { startsWith: prefix, mode: "insensitive" },
    },
    select: { id: true },
  });
}

const studentInclude = {
  classroom: {
    include: {
      teachers: { select: { id: true, name: true, email: true }, take: 1 },
    },
  },
  homeAddress: {
    select: { line1: true, city: true, state: true, zip: true },
  },
  daycare: {
    select: {
      name: true,
      phone: true,
      address: { select: { line1: true, city: true, state: true, zip: true } },
    },
  },
  assignments: {
    include: {
      busRoute: { select: { number: true, loadingLocation: true } },
      daycare: { select: { name: true } },
      customAddress: {
        select: { line1: true, city: true, state: true, zip: true },
      },
    },
  },
  tempChanges: {
    where: { undone: false, status: "APPROVED" },
    include: {
      busRoute: { select: { number: true, loadingLocation: true } },
      daycare: { select: { name: true } },
      customAddress: {
        select: { line1: true, city: true, state: true, zip: true },
      },
    },
  },
} as const;

/**
 * Permanent company log — every school request stays, newest first.
 * One row per ChangeRequest (not per student).
 */
export async function loadCompanyOpenRequests(
  schoolIdOrIds: string | string[],
): Promise<CompanyOpenStudent[]> {
  const schoolIds = [
    ...new Set(
      (Array.isArray(schoolIdOrIds) ? schoolIdOrIds : [schoolIdOrIds]).filter(
        Boolean,
      ),
    ),
  ];
  if (!schoolIds.length) return [];

  const openRequests = (await prisma.changeRequest.findMany({
    where: {
      schoolId: { in: schoolIds },
      status: { in: ["PENDING", "NEEDS_CLARIFICATION", "COMPLETED"] },
      NOT: { source: "BUS_COMPANY", title: "Needs clarification" },
    },
    select: {
      id: true,
      schoolId: true,
      studentId: true,
      title: true,
      details: true,
      payload: true,
      status: true,
      createdAt: true,
      createdById: true,
      busNumber: true,
    },
    orderBy: { createdAt: "desc" },
  })) as OpenRequestRow[];

  const unresolved = openRequests.filter((row) => !row.studentId);
  if (unresolved.length) {
    await Promise.all(
      unresolved.map(async (row) => {
        const match = await findStudentByName(schoolIds, row.title);
        if (!match) return;
        row.studentId = match.id;
        await prisma.changeRequest
          .update({
            where: { id: row.id },
            data: { studentId: match.id },
          })
          .catch(() => undefined);
      }),
    );
  }

  const linkedIds = [
    ...new Set(
      openRequests
        .map((row) => row.studentId)
        .filter((id): id is string => Boolean(id)),
    ),
  ];

  const covered = new Set(linkedIds);
  const waitingTemps = await prisma.temporaryChange.findMany({
    where: {
      undone: false,
      status: "APPROVED",
      waitingForAssignment: true,
      student: { schoolId: { in: schoolIds }, active: true },
      ...(covered.size ? { studentId: { notIn: [...covered] } } : {}),
    },
    select: { id: true, studentId: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  });

  const allStudentIds = [
    ...new Set([
      ...linkedIds,
      ...waitingTemps.map((temp) => temp.studentId),
    ]),
  ];

  const rows = allStudentIds.length
    ? await prisma.student.findMany({
        where: {
          schoolId: { in: schoolIds },
          active: true,
          id: { in: allStudentIds },
        },
        include: studentInclude,
      })
    : [];

  const byStudentId = new Map<string, EffectiveStudent>();
  for (const row of rows) {
    try {
      byStudentId.set(
        row.id,
        toEffective(row as unknown as Parameters<typeof toEffective>[0]),
      );
    } catch {
      // skip bad row
    }
  }

  const result: CompanyOpenStudent[] = [];

  for (const row of openRequests) {
    if (!row.studentId) continue;
    const student = byStudentId.get(row.studentId);
    if (!student) continue;
    result.push({
      id: row.id,
      student,
      requestedAt: row.createdAt,
      changeRequestId: row.id,
      status: row.status,
      busNumber: row.busNumber,
      title: row.title,
      details: row.details,
      payload: row.payload,
    });
  }

  for (const temp of waitingTemps) {
    const student = byStudentId.get(temp.studentId);
    if (!student || !isWaitingRide(student)) continue;
    result.push({
      id: `temp-${temp.id}`,
      student,
      requestedAt: temp.createdAt,
      changeRequestId: null,
      status: "PENDING",
      busNumber: null,
      title: "Waiting for bus",
      details: "",
      payload: null,
    });
  }

  return result.sort(
    (a, b) => b.requestedAt.getTime() - a.requestedAt.getTime(),
  );
}
