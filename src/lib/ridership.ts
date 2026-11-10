import { ensureAimFleetVehicles, isAimSchool } from "./aim-fleet";
import { formatLongDate, schoolNow } from "./dates";
import { planSummary } from "./format";
import { loadVehicles } from "./gate";
import { loadSavedOpsEmails, usableOpsEmail } from "./ops-change-emails";
import { prisma } from "./prisma";
import { groupByBus, stamp } from "./reports";
import { loadStudents } from "./transportation";
import type { EffectiveStudent } from "./types";

function isVanVehicle(vehicle: { name: string; vehicleType: string }) {
  return (
    vehicle.vehicleType.toUpperCase() === "VAN" ||
    /^van\b/i.test(vehicle.name.trim())
  );
}

export type VanRider = {
  id: string;
  name: string;
  grade: string;
  parentName: string;
  parentPhone: string;
};

export type VanGroup = {
  id: string;
  name: string;
  driverName: string;
  riders: VanRider[];
};

export type Ridership = {
  buses: [string, EffectiveStudent[]][];
  vans: VanGroup[];
  busRiders: number;
  vanRiders: number;
};

export type DriverRider = {
  id: string;
  name: string;
  studentId: string;
  grade: string;
  teacherName: string;
  parentName: string;
  parentPhone: string;
  parentPhone2: string;
  homeAddress: string;
  buses: string[];
  vanId: string | null;
};

export type DriverVan = {
  id: string;
  name: string;
  driverName?: string;
};

/** Named fleet rows selected by vehicleId (Aim Bus 4/5/3rd bus, or true vans elsewhere). */
export type DriverFleetVehicle = DriverVan & {
  kind: "bus" | "van";
};

export function studentBusNumbers(student: EffectiveStudent) {
  return [
    ...new Set(
      [student.am.busNumber, student.pm.busNumber].filter(
        (value): value is string => Boolean(value),
      ),
    ),
  ];
}

export async function loadRidership(schoolId: string): Promise<Ridership> {
  const [students, routes, vehicles] = await Promise.all([
    loadStudents(schoolId),
    prisma.busRoute.findMany({
      where: { schoolId },
      select: { number: true },
      orderBy: { number: "asc" },
    }),
    loadVehicles(schoolId).catch(() => []),
  ]);

  const buses = groupByBus(students, "PM");
  const busMap = new Map(buses);
  for (const route of routes) {
    if (!busMap.has(route.number)) busMap.set(route.number, []);
  }
  const busCards = [...busMap.entries()]
    .filter(([, riders]) => riders.length)
    .sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true }));

  const vans = vehicles.filter((vehicle) => isVanVehicle(vehicle));
  const vanIds = vans.map((vehicle) => vehicle.id);
  const vanStudents = vanIds.length
    ? await prisma.student.findMany({
        where: { schoolId, active: true, vehicleId: { in: vanIds } },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          grade: true,
          parentName: true,
          parentPhone: true,
          vehicleId: true,
        },
        orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      })
    : [];
  const vanCards = vans
    .map((vehicle) => ({
      id: vehicle.id,
      name: vehicle.name,
      driverName: vehicle.driverName,
      riders: vanStudents
        .filter((student) => student.vehicleId === vehicle.id)
        .map((student) => ({
          id: student.id,
          name: `${student.firstName} ${student.lastName}`,
          grade: student.grade,
          parentName: student.parentName,
          parentPhone: student.parentPhone,
        })),
    }))
    .filter((van) => van.riders.length);

  return {
    buses: busCards,
    vans: vanCards,
    busRiders: busCards.reduce((sum, [, riders]) => sum + riders.length, 0),
    vanRiders: vanCards.reduce((sum, van) => sum + van.riders.length, 0),
  };
}

export function ridershipText(list: Ridership) {
  const header = stamp();
  const lines = [
    "AMPM Flow — bus and van list",
    formatLongDate(schoolNow()),
    header.generated,
    "",
    `Buses: ${list.busRiders} students · Vans: ${list.vanRiders} students`,
    "Parent pickup is not on this list.",
    "",
  ];

  for (const [number, riders] of list.buses) {
    lines.push(`Bus ${number} (${riders.length})`);
    for (const student of riders) {
      lines.push(
        `  ${student.fullName}  Parent: ${student.parentName && student.parentName !== "—" ? student.parentName : "—"}  ${student.parentPhone || "—"}  Grade ${student.grade}  ${planSummary(student.pm, "PM")}`,
      );
    }
    lines.push("");
  }

  for (const van of list.vans) {
    lines.push(`${van.name} (${van.riders.length})`);
    for (const student of van.riders) {
      lines.push(
        `  ${student.name}  Parent: ${student.parentName && student.parentName !== "—" ? student.parentName : "—"}  ${student.parentPhone || "—"}  Grade ${student.grade}`,
      );
    }
    lines.push("");
  }

  if (!list.buses.length && !list.vans.length) {
    lines.push("No bus or van students today.");
  }

  return lines.join("\n");
}

export async function loadDriverLists(schoolId: string) {
  const school = await prisma.school.findUnique({
    where: { id: schoolId },
    select: { name: true },
  });
  const aim = isAimSchool(school?.name);

  const [students, loadedVehicles, vanRows] = await Promise.all([
    loadStudents(schoolId),
    loadVehicles(schoolId).catch(() => []),
    prisma.student.findMany({
      where: { schoolId, active: true, vehicleId: { not: null } },
      select: { id: true, vehicleId: true },
    }),
  ]);
  const vehicles = aim
    ? await ensureAimFleetVehicles(schoolId).catch(() => loadedVehicles)
    : loadedVehicles;

  const vanByStudent = new Map(
    vanRows.map((row) => [row.id, row.vehicleId] as const),
  );

  // Aim has no vans — Minnehaha fleet is Bus 4, Bus 5, and 3rd bus.
  // Other schools keep vehicleId rows that are true vans.
  const fleetVehicles: DriverFleetVehicle[] = vehicles
    .filter((vehicle) => (aim ? !isVanVehicle(vehicle) : isVanVehicle(vehicle)))
    .map((vehicle) => ({
      id: vehicle.id,
      name: vehicle.name,
      driverName: vehicle.driverName || "",
      kind: isVanVehicle(vehicle) ? ("van" as const) : ("bus" as const),
    }));

  // Keep `vans` for older callers; Aim fills this with the three buses.
  const vans = fleetVehicles.map(({ id, name, driverName }) => ({
    id,
    name,
    driverName,
  }));

  const busDrivers: Record<string, string> = {};
  for (const vehicle of vehicles) {
    if (isVanVehicle(vehicle)) continue;
    if (vehicle.vehicleType.toUpperCase() !== "BUS" && !/^bus\b/i.test(vehicle.name)) {
      continue;
    }
    const number = vehicle.name.replace(/^Bus\s+/i, "").trim();
    if (number) busDrivers[number] = vehicle.driverName || "";
  }
  const riders: DriverRider[] = students.map((student) => ({
    id: student.id,
    name: student.fullName,
    studentId: student.studentId,
    grade: student.grade,
    teacherName: student.teacherName,
    parentName: student.parentName,
    parentPhone: student.parentPhone,
    parentPhone2: student.parentPhone2,
    homeAddress:
      student.homeAddress && student.homeAddress !== "—"
        ? student.homeAddress
        : "",
    buses: studentBusNumbers(student),
    vanId: vanByStudent.get(student.id) || null,
  }));
  const routeBuses = [
    ...new Set(riders.flatMap((rider) => rider.buses)),
  ].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  // Aim Reports uses the Minnehaha fleet rows (Bus 4 / Bus 5 / 3rd bus), not van slots.
  const buses = aim ? [] : routeBuses;
  return {
    riders,
    buses,
    vans,
    fleetVehicles,
    busDrivers,
    aimSchool: aim,
  };
}

export function oneVehicleText(args: {
  riders: DriverRider[];
  vans: DriverVan[];
  bus?: string;
  van?: string;
}) {
  const title = args.bus
    ? `Bus ${args.bus}`
    : args.vans.find((van) => van.id === args.van)?.name || "Van";
  const rows = args.riders.filter((rider) =>
    args.bus
      ? rider.buses.includes(args.bus)
      : Boolean(args.van && rider.vanId === args.van),
  );
  const lines = [
    "AMPM Flow — driver list",
    formatLongDate(schoolNow()),
    title,
    `${rows.length} student${rows.length === 1 ? "" : "s"}`,
    "Parent pickup is not on this list.",
    "",
    "Student name  |  Parent name  |  Primary 1 / 2 phone  |  Address",
    ...rows.map(
      (rider) =>
        `  ${rider.name}  |  ${rider.parentName && rider.parentName !== "—" ? rider.parentName : "—"}  |  ${[rider.parentPhone, rider.parentPhone2].filter(Boolean).join(" / ") || "—"}  |  ${rider.homeAddress || "—"}`,
    ),
  ];
  if (!rows.length) lines.push("No students on this vehicle.");
  return { title, rows, text: lines.join("\n") };
}

export async function ridershipRecipients(schoolId: string) {
  const [saved, users] = await Promise.all([
    loadSavedOpsEmails(schoolId),
    prisma.user.findMany({
      where: {
        schoolId,
        active: true,
        role: { in: ["BUS_COMPANY", "COORDINATOR", "ADMINISTRATOR"] },
      },
      select: { email: true },
    }),
  ]);
  return [
    ...new Set(
      [...saved, process.env.BUS_COMPANY_EMAIL || "", ...users.map((user) => user.email)]
        .map((email) => usableOpsEmail(email))
        .filter(Boolean),
    ),
  ];
}
