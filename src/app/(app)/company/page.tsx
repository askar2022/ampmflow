import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AIM_FLEET_LABELS, isAimSchool } from "@/lib/aim-fleet";
import { loadVehicles } from "@/lib/gate";
import { formatDateTime, schoolLocalTime } from "@/lib/dates";
import {
  companySchoolGroupIds,
  loadCompanySchools,
  type CompanySchool,
} from "@/lib/company-access";
import {
  companyAddressFor,
  companyChangeEmail,
  companyEffectiveDate,
  companyRequestKind,
  destinationFromStudent,
  planLine,
} from "@/lib/change-notify";
import { loadCompanyOpenRequests } from "@/lib/company-open-requests";
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

async function loadSchoolDesk(school: CompanySchool): Promise<CompanyDesk> {
  const aim = isAimSchool(school.name);
  const schoolIds = await companySchoolGroupIds(school);
  // Read-only on open — no fleet rewrite or settings write during login.
  const [openRows, vehicleLists, routeLists] = await Promise.all([
    loadCompanyOpenRequests(schoolIds),
    Promise.all(
      schoolIds.map((schoolId) => loadVehicles(schoolId).catch(() => [])),
    ),
    Promise.all(
      schoolIds.map((schoolId) =>
        prisma.busRoute.findMany({
          where: { schoolId },
          select: { number: true },
          orderBy: { number: "asc" },
        }),
      ),
    ),
  ]);
  const vehicles = vehicleLists.flat();
  const routes = routeLists.flat();

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
      // Still waiting for a bus/van = open. Do not mark "Changed" from an
      // older completed request when a new daycare/address request is pending.
      changed: !isWaiting(student),
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

  const { school: wanted } = await searchParams;
  const [schools, liveName] = await Promise.all([
    loadCompanySchools(session),
    Promise.resolve(session.name || "Bus company"),
  ]);
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
