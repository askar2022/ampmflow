import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isAimSchool } from "@/lib/aim-fleet";
import { loadVehicles } from "@/lib/gate";
import { formatDateTime, schoolLocalTime } from "@/lib/dates";
import { companyFleetForSchool } from "@/lib/school-fleet";
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

function requestFromChange(row: {
  title: string;
  details: string;
  payload: string | null;
  student: EffectiveStudent;
}) {
  const blob = `${row.title} ${row.details} ${row.payload || ""}`;
  try {
    const payload = row.payload ? JSON.parse(row.payload) : null;
    if (payload?.daycareName) return `Daycare · ${payload.daycareName}`;
    if (payload?.customAddress) return `New address · ${payload.customAddress}`;
  } catch {
    // ignore
  }
  if (/daycare/i.test(blob)) {
    return row.student.daycareName
      ? `Daycare · ${row.student.daycareName}`
      : "Daycare";
  }
  if (/address|CUSTOM/i.test(blob)) {
    return requestFor(row.student);
  }
  if (/request for route|new route|new student/i.test(blob)) {
    return row.student.homeAddress && row.student.homeAddress !== "—"
      ? `New student · ${row.student.homeAddress}`
      : "New student";
  }
  return requestFor(row.student);
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
  const locked = companyFleetForSchool(school.name);
  const schoolIds = await companySchoolGroupIds(school);

  // Locked fleets (NIA / Aim) skip vehicle + route scans on every Open requests click.
  const [openRows, vehicleLists, routeLists] = await Promise.all([
    loadCompanyOpenRequests(schoolIds),
    locked
      ? Promise.resolve([[]] as Awaited<ReturnType<typeof loadVehicles>>[])
      : Promise.all(
          schoolIds.map((schoolId) => loadVehicles(schoolId).catch(() => [])),
        ),
    locked
      ? Promise.resolve([[]] as Array<Array<{ number: string }>>)
      : Promise.all(
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

  const vans = locked
    ? locked.vans
    : aim
      ? []
      : vehicles
          .filter(
            (vehicle) =>
              vehicle.vehicleType.toUpperCase() === "VAN" ||
              /van/i.test(vehicle.name),
          )
          .map((vehicle) => ({ id: vehicle.id, name: vehicle.name }));

  const buses = locked
    ? locked.buses
    : [
        ...new Set([
          ...routes.map((route) => route.number),
          ...vehicles
            .filter(
              (vehicle) =>
                vehicle.vehicleType.toUpperCase() === "BUS" &&
                !/van/i.test(vehicle.name),
            )
            .map((vehicle) =>
              vehicle.name.replace(/^Bus\s+/i, "").trim(),
            )
            .filter(Boolean),
        ]),
      ].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

  const rows: CompanyRequest[] = openRows.map((row) => {
    const { student, requestedAt, status, busNumber } = row;
    const request = requestFromChange(row);
    const stillOpen =
      status === "PENDING" || status === "NEEDS_CLARIFICATION";
    const trips: Trip[] = stillOpen
      ? [
          ...(isPlanWaiting(student.am) ? (["AM"] as const) : []),
          ...(isPlanWaiting(student.pm) ? (["PM"] as const) : []),
        ]
      : (["AM", "PM"] as Trip[]);
    const used = trips.length ? trips : (["AM", "PM"] as Trip[]);
    return {
      id: row.id,
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
      // Permanent log: completed stays green; unfinished stay yellow.
      changed: !stillOpen,
    };
  });

  return {
    schoolId: school.id,
    schoolName: school.name,
    buses,
    vans,
    aimSchool: aim,
    hideVan: locked?.hideVan ?? aim,
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
