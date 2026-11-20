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
  createdAt: Date;
  createdById: string;
  busNumber: string | null;
};

export type CompanyOpenStudent = {
  student: EffectiveStudent;
  requestedAt: Date;
  changeRequestId: string | null;
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
 * Open company desk rows only — no full-roster scan, no mutate-on-read.
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
      status: { in: ["PENDING", "NEEDS_CLARIFICATION"] },
    },
    select: {
      id: true,
      schoolId: true,
      studentId: true,
      title: true,
      details: true,
      createdAt: true,
      createdById: true,
      busNumber: true,
    },
    orderBy: { createdAt: "asc" },
  })) as OpenRequestRow[];

  // Link orphan route titles once (parallel), without blocking on mutations later.
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

  const rows = await prisma.student.findMany({
    where: {
      schoolId: { in: schoolIds },
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
    include: studentInclude,
  });

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

  const byId = new Map<string, CompanyOpenStudent>();

  function remember(
    student: EffectiveStudent,
    requestedAt: Date,
    changeRequestId: string | null,
  ) {
    const existing = byId.get(student.id);
    if (!existing || requestedAt < existing.requestedAt) {
      byId.set(student.id, { student, requestedAt, changeRequestId });
      return;
    }
    if (!existing.changeRequestId && changeRequestId) {
      existing.changeRequestId = changeRequestId;
    }
  }

  for (const row of openRequests) {
    if (!row.studentId) continue;
    const student = byStudentId.get(row.studentId);
    if (!student) continue;
    remember(student, row.createdAt, row.id);
  }

  for (const student of byStudentId.values()) {
    const isRouteEnrollment =
      student.enrollmentSource === "ROUTE_REQUEST" ||
      student.enrollmentSource === "NEW_APPLICATION";
    if (!isWaitingRide(student) && !isRouteEnrollment) continue;
    const match = openRequests.find((row) => row.studentId === student.id);
    remember(student, match?.createdAt || new Date(), match?.id || null);
  }

  return [...byId.values()].sort(
    (a, b) => a.requestedAt.getTime() - b.requestedAt.getTime(),
  );
}
