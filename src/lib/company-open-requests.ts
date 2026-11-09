import { prisma } from "./prisma";
import { loadStudent, loadStudents } from "./transportation";
import { isWaitingRide } from "./format";
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

async function ensureWaitingAssignments(
  studentId: string,
  updatedById: string,
) {
  const reason = "Waiting for bus company assignment.";
  for (const trip of ["AM", "PM"] as const) {
    await prisma.transportationAssignment.upsert({
      where: { studentId_trip: { studentId, trip } },
      create: {
        studentId,
        trip,
        type: "BUS",
        destination: "HOME",
        busRouteId: null,
        waitingForAssignment: true,
        notes: reason,
        effectiveStart: new Date(),
        updatedById,
      },
      update: {
        type: "BUS",
        destination: "HOME",
        busRouteId: null,
        waitingForAssignment: true,
        notes: reason,
        updatedById,
      },
    });
  }
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

  // Soft match for typos like "askat" vs "Askar".
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

/**
 * Every unfinished school request for this campus — including last week,
 * duplicate school rows with the same name, and requests saved without a
 * studentId link.
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

  const [waitingLists, openRequests] = await Promise.all([
    Promise.all(schoolIds.map((schoolId) => loadStudents(schoolId))),
    prisma.changeRequest.findMany({
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
    }) as Promise<OpenRequestRow[]>,
  ]);
  const waitingAll = waitingLists.flat();

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
    let studentId = row.studentId;

    if (!studentId) {
      const match = await findStudentByName(schoolIds, row.title);
      if (match) {
        studentId = match.id;
        await prisma.changeRequest
          .update({
            where: { id: row.id },
            data: { studentId: match.id },
          })
          .catch(() => undefined);
      }
    }

    if (!studentId) continue;

    let loaded = await loadStudent(studentId);
    if (!loaded?.effective) continue;

    // Pending request means company still owes a bus — keep waiting flags on.
    if (!isWaitingRide(loaded.effective) && !row.busNumber) {
      await ensureWaitingAssignments(studentId, row.createdById).catch(
        () => undefined,
      );
      loaded = await loadStudent(studentId);
      if (!loaded?.effective) continue;
    }

    remember(loaded.effective, row.createdAt, row.id);
  }

  for (const student of waitingAll) {
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
