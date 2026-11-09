import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  AIM_FLEET_LABELS,
  ensureAimFleetVehicles,
  isAimSchool,
} from "@/lib/aim-fleet";
import { loadVehicles } from "@/lib/gate";
import { formatDateTime, schoolLocalTime, todayKey } from "@/lib/dates";
import { loadCompanySchools, type CompanySchool } from "@/lib/company-access";
import {
  companyAddressFor,
  companyChangeEmail,
  companyEffectiveDate,
  companyRequestKind,
  destinationFromStudent,
  planLine,
} from "@/lib/change-notify";
import {
  loadFrontDeskChangesToday,
  loadStudent,
  loadStudents,
} from "@/lib/transportation";
import { changeRequestLabel, isPlanWaiting, isWaitingRide } from "@/lib/format";
import type { EffectiveStudent, Trip } from "@/lib/types";
import {
  CompanyBoard,
  type CompanyDesk,
  type CompanyRequest,
} from "./CompanyBoard";

function gradeOnly(grade: string) {
  return String(grade).replace(/^grade\s+/i, "") || "—";
}

function isWaiting(student: EffectiveStudent) {
  return isWaitingRide(student);
}

function requestFor(student: EffectiveStudent) {
  for (const plan of [student.pm, student.am]) {
    if (plan.destination === "DAYCARE") {
      return plan.daycareName ? `Daycare · ${plan.daycareName}` : "Daycare";
    }
    if (plan.destination === "CUSTOM") {
      return plan.customAddress
        ? `New address · ${plan.customAddress}`
        : "New address";
    }
  }
  if (
    student.enrollmentSource === "ROUTE_REQUEST" ||
    student.enrollmentSource === "NEW_APPLICATION"
  ) {
    return student.homeAddress && student.homeAddress !== "—"
      ? `New student · ${student.homeAddress}`
      : "New student";
  }
  if (isWaiting(student)) return "New request";
  return "Needs bus";
}

function sittingWhere(student: EffectiveStudent) {
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
  return changeRequestLabel(student);
}

function companyEmail(student: EffectiveStudent, trips: Trip[]) {
  const used = trips.length ? trips : (["PM"] as Trip[]);
  const kind = companyRequestKind({
    destination: destinationFromStudent(student),
    waiting: isWaiting(student),
    enrollmentSource: student.enrollmentSource,
  });
  const mail = companyChangeEmail({
    studentName: student.fullName,
    grade: student.grade,
    trips: used,
    next: planLine(student, used),
    when: companyEffectiveDate(student, used),
    kind,
    address: companyAddressFor({ kind, student }),
    amPickup: used.includes("AM") ? student.am.pickupTime : "",
    pmPickup: used.includes("PM") ? student.pm.pickupTime : "",
  });
  return { subject: mail.subject, body: mail.text };
}

type OpenStudent = {
  student: EffectiveStudent;
  requestedAt: Date;
};

async function loadCompanyOpenRequests(schoolId: string): Promise<OpenStudent[]> {
  const [todayChanges, waitingAll, openRequests] = await Promise.all([
    loadFrontDeskChangesToday(schoolId),
    loadStudents(schoolId),
    prisma.changeRequest.findMany({
      where: {
        schoolId,
        status: { in: ["PENDING", "NEEDS_CLARIFICATION"] },
      },
      select: {
        studentId: true,
        title: true,
        details: true,
        createdAt: true,
        busNumber: true,
      },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  const byId = new Map<string, OpenStudent>();

  function remember(student: EffectiveStudent, requestedAt: Date) {
    const existing = byId.get(student.id);
    if (!existing || requestedAt < existing.requestedAt) {
      byId.set(student.id, { student, requestedAt });
    }
  }

  // Any unfinished change request — including last week — stays on this desk.
  for (const row of openRequests) {
    if (!row.studentId) continue;
    if (byId.has(row.studentId)) {
      const cur = byId.get(row.studentId)!;
      if (row.createdAt < cur.requestedAt) {
        byId.set(row.studentId, {
          student: cur.student,
          requestedAt: row.createdAt,
        });
      }
      continue;
    }
    const loaded = await loadStudent(row.studentId);
    if (loaded?.effective) {
      remember(loaded.effective, row.createdAt);
    }
  }

  // Still waiting for a bus number (open AM/PM assignment).
  for (const student of waitingAll) {
    if (!isWaiting(student)) continue;
    const match = openRequests.find((row) => row.studentId === student.id);
    remember(student, match?.createdAt || new Date());
  }

  // Route-request enrollments that never got a bus.
  for (const student of waitingAll) {
    if (byId.has(student.id)) continue;
    if (
      student.enrollmentSource === "ROUTE_REQUEST" ||
      student.enrollmentSource === "NEW_APPLICATION"
    ) {
      if (isWaiting(student)) remember(student, new Date());
    }
  }

  // Today’s front-desk changes still need a company update.
  for (const student of todayChanges) {
    if (!isWaiting(student) && byId.has(student.id)) continue;
    if (isWaiting(student) || !byId.has(student.id)) {
      const match = openRequests.find((row) => row.studentId === student.id);
      remember(student, match?.createdAt || new Date());
    }
  }

  return [...byId.values()].sort(
    (a, b) => a.requestedAt.getTime() - b.requestedAt.getTime(),
  );
}

async function loadSchoolDesk(school: CompanySchool): Promise<CompanyDesk> {
  const aim = isAimSchool(school.name);
  const [openRows, vehicles, routes] = await Promise.all([
    loadCompanyOpenRequests(school.id),
    (aim
      ? ensureAimFleetVehicles(school.id)
      : loadVehicles(school.id)
    ).catch(() => []),
    prisma.busRoute.findMany({
      where: { schoolId: school.id },
      select: { number: true },
      orderBy: { number: "asc" },
    }),
  ]);

  const studentIds = openRows.map((row) => row.student.id);
  const completed = studentIds.length
    ? await prisma.changeRequest.findMany({
        where: {
          schoolId: school.id,
          status: "COMPLETED",
          studentId: { in: studentIds },
          busNumber: { not: null },
        },
        select: { studentId: true, reviewedAt: true, updatedAt: true },
      })
    : [];
  const day = todayKey();
  const assignedIds = new Set(
    completed
      .filter(
        (row) =>
          schoolLocalTime(row.reviewedAt || row.updatedAt).dateKey === day,
      )
      .map((row) => row.studentId)
      .filter(Boolean),
  );

  const vans = aim
    ? []
    : vehicles
        .filter(
          (vehicle) =>
            vehicle.vehicleType.toUpperCase() === "VAN" ||
            /van/i.test(vehicle.name),
        )
        .map((vehicle) => ({ id: vehicle.id, name: vehicle.name }));

  const fleetBusNumbers = aim
    ? AIM_FLEET_LABELS.map(
        (label) => label.replace(/^Bus\s+/i, "").trim() || label,
      )
    : vehicles
        .filter(
          (vehicle) =>
            vehicle.vehicleType.toUpperCase() === "BUS" &&
            !/van/i.test(vehicle.name),
        )
        .map((vehicle) => vehicle.name.replace(/^Bus\s+/i, "").trim())
        .filter(Boolean);

  const buses = [
    ...new Set([
      ...routes.map((route) => route.number),
      ...fleetBusNumbers,
    ]),
  ].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

  const rows: CompanyRequest[] = openRows.map(({ student, requestedAt }) => {
    const request = requestFor(student);
    const trips: Trip[] = [
      ...(isPlanWaiting(student.am) ? (["AM"] as const) : []),
      ...(isPlanWaiting(student.pm) ? (["PM"] as const) : []),
    ];
    const used = trips.length ? trips : (["AM", "PM"] as Trip[]);
    return {
      studentId: student.id,
      name: student.fullName,
      grade: gradeOnly(student.grade),
      teacher: student.teacherName || "—",
      parent:
        student.parentName && student.parentName !== "—"
          ? student.parentName
          : "—",
      request,
      sitting: sittingWhere(student),
      requestDate: formatDateTime(requestedAt),
      requestDateKey: schoolLocalTime(requestedAt).dateKey,
      effectiveDate: companyEffectiveDate(student, used),
      email: companyEmail(student, trips),
      trips: used,
      changed: assignedIds.has(student.id),
    };
  });

  return {
    schoolId: school.id,
    schoolName: school.name,
    buses,
    vans,
    aimSchool: aim,
    rows,
  };
}

export default async function CompanyPage({
  searchParams,
}: {
  searchParams: Promise<{ school?: string }>;
}) {
  const session = await getSession();
  if (!session) return null;
  if (session.role !== "BUS_COMPANY") redirect("/changes");

  const liveName = await prisma.user
    .findUnique({
      where: { id: session.id },
      select: { name: true },
    })
    .then((row) => row?.name || session.name || "Bus company")
    .catch(() => session.name || "Bus company");

  const { school: wanted } = await searchParams;
  const schools = await loadCompanySchools(session);
  const selected =
    schools.find((school) => school.id === wanted || school.slug === wanted) ||
    schools[0];
  if (!selected) {
    return (
      <div>
        <h1 className="font-serif text-4xl text-navy">{liveName}</h1>
        <p className="mt-1 text-lg font-semibold text-navy">Open requests</p>
        <p className="mt-2 text-muted">
          No school is assigned to this login yet. Ask AMPM Flow to add the
          schools you serve.
        </p>
      </div>
    );
  }

  const desk = await loadSchoolDesk(selected);

  return (
    <CompanyBoard
      companyName={liveName}
      schools={schools}
      schoolId={selected.id}
      desks={[desk]}
    />
  );
}
