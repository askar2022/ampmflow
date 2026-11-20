import { formatDateTime, schoolLocalTime } from "./dates";
import { companyAssignmentLabel, isWaitingRide } from "./format";
import { prisma } from "./prisma";
import { loadStudent, loadStudents } from "./transportation";
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
 */
export async function loadSchoolOpenRequests(
  schoolId: string,
): Promise<SchoolOpenRequestRow[]> {
  const [students, openRequests] = await Promise.all([
    loadStudents(schoolId),
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
  ]);

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
    let studentId = row.studentId;
    if (!studentId) {
      const full = row.title.replace(/^Request for route\s*[—\-]\s*/i, "").trim();
      const parts = full.split(/\s+/).filter(Boolean);
      if (parts.length >= 2) {
        const match = await prisma.student.findFirst({
          where: {
            schoolId,
            active: true,
            firstName: { equals: parts[0], mode: "insensitive" },
            lastName: { equals: parts.slice(1).join(" "), mode: "insensitive" },
          },
          select: { id: true },
        });
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
    }
    if (!studentId) continue;
    const loaded = await loadStudent(studentId);
    if (!loaded?.effective) continue;
    remember(
      loaded.effective,
      row.createdAt,
      kindFromChangeRequest(row),
      detailFromChangeRequest(row) || detailForStudent(loaded.effective),
    );
  }

  for (const student of students) {
    const daycareOrAddressWaiting =
      isWaitingRide(student) &&
      (student.am.destination === "DAYCARE" ||
        student.pm.destination === "DAYCARE" ||
        student.am.destination === "CUSTOM" ||
        student.pm.destination === "CUSTOM");
    const needsCompany =
      isWaitingRide(student) ||
      daycareOrAddressWaiting ||
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

  // Recent approved temp changes still waiting for a bus number.
  const recentTemps = await prisma.temporaryChange.findMany({
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
  });
  for (const temp of recentTemps) {
    const loaded = await loadStudent(temp.studentId);
    if (!loaded?.effective) continue;
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
          : detailForStudent(loaded.effective);
    remember(loaded.effective, temp.createdAt, kind, detail);
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
