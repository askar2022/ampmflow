import { addDays, format, parseISO, startOfWeek, subWeeks } from "date-fns";
import { schoolDayBounds, todayKey } from "./dates";
import { loadVehicles } from "./gate";
import { prisma } from "./prisma";

export type WeekBars = {
  label: string;
  start: string;
  end: string;
  changes: number;
  requests: number;
};

export type VehicleRiderCount = {
  name: string;
  riders: number;
};

export type CoordinatorAnalytics = {
  students: number;
  buses: number;
  vans: number;
  busRiders: number;
  vanRiders: number;
  busCounts: VehicleRiderCount[];
  vanCounts: VehicleRiderCount[];
  waiting: number;
  changesWeek: number;
  changesMonth: number;
  requestsWeek: number;
  requestsMonth: number;
  pendingRequests: number;
  weekLabel: string;
  monthLabel: string;
  weeks: WeekBars[];
};

function weekRange(offset = 0) {
  const today = parseISO(todayKey());
  const start = format(
    subWeeks(startOfWeek(today, { weekStartsOn: 1 }), offset),
    "yyyy-MM-dd",
  );
  const end = format(addDays(parseISO(start), 6), "yyyy-MM-dd");
  return { start, end };
}

function monthRange() {
  const today = todayKey();
  return { start: `${today.slice(0, 7)}-01`, end: today };
}

function isRouteRequest(title: string) {
  return /request for route/i.test(title);
}

function sortCounts(rows: VehicleRiderCount[]) {
  return [...rows].sort((a, b) => {
    if (b.riders !== a.riders) return b.riders - a.riders;
    return a.name.localeCompare(b.name, undefined, { numeric: true });
  });
}

async function loadVehicleCounts(schoolId: string, vans: Array<{ id: string; name: string }>) {
  const [routes, assignments, vanStudents] = await Promise.all([
    prisma.busRoute.findMany({
      where: { schoolId },
      select: { number: true },
    }),
    prisma.transportationAssignment.findMany({
      where: {
        waitingForAssignment: false,
        busRouteId: { not: null },
        student: { schoolId, active: true },
      },
      select: {
        studentId: true,
        busRoute: { select: { number: true } },
      },
    }),
    vans.length
      ? prisma.student.findMany({
          where: {
            schoolId,
            active: true,
            vehicleId: { in: vans.map((van) => van.id) },
          },
          select: { vehicleId: true },
        })
      : Promise.resolve([]),
  ]);

  const ridersByBus = new Map<string, Set<string>>();
  for (const row of assignments) {
    const number = row.busRoute?.number?.trim();
    if (!number) continue;
    const set = ridersByBus.get(number) ?? new Set<string>();
    set.add(row.studentId);
    ridersByBus.set(number, set);
  }
  const busNames = new Set([
    ...routes.map((route) => route.number.trim()).filter(Boolean),
    ...ridersByBus.keys(),
  ]);
  const busCounts = sortCounts(
    [...busNames].map((name) => ({
      name,
      riders: ridersByBus.get(name)?.size || 0,
    })),
  );

  const ridersByVan = new Map<string, number>();
  for (const student of vanStudents) {
    if (!student.vehicleId) continue;
    ridersByVan.set(student.vehicleId, (ridersByVan.get(student.vehicleId) || 0) + 1);
  }
  const vanCounts = sortCounts(
    vans.map((van) => ({
      name: van.name,
      riders: ridersByVan.get(van.id) || 0,
    })),
  );

  return { busCounts, vanCounts };
}

async function countRequests(
  schoolId: string,
  start: string,
  end: string,
  kind: "change" | "request",
) {
  const bounds = schoolDayBounds(start, end);
  const rows = await prisma.changeRequest.findMany({
    where: {
      schoolId,
      createdAt: { gte: bounds.start, lte: bounds.end },
    },
    select: { title: true },
  });
  return rows.filter((row) =>
    kind === "request" ? isRouteRequest(row.title) : !isRouteRequest(row.title),
  ).length;
}

export async function loadCoordinatorAnalytics(
  schoolId: string,
): Promise<CoordinatorAnalytics> {
  const thisWeek = weekRange(0);
  const month = monthRange();
  const weekWindows = [3, 2, 1, 0].map((offset) => weekRange(offset));

  const [
    students,
    routes,
    vehicles,
    busRiders,
    vanRiders,
    waiting,
    pendingRequests,
    changesWeek,
    changesMonth,
    requestsWeek,
    requestsMonth,
    weekCounts,
  ] = await Promise.all([
    prisma.student.count({ where: { schoolId, active: true } }),
    prisma.busRoute.findMany({
      where: { schoolId },
      select: { number: true },
    }),
    loadVehicles(schoolId).catch(() => []),
    prisma.student.count({
      where: {
        schoolId,
        active: true,
        assignments: {
          some: { waitingForAssignment: false, busRouteId: { not: null } },
        },
      },
    }),
    prisma.student.count({
      where: { schoolId, active: true, vehicleId: { not: null } },
    }),
    prisma.student.count({
      where: {
        schoolId,
        active: true,
        assignments: { some: { waitingForAssignment: true } },
      },
    }),
    prisma.changeRequest.count({
      where: { schoolId, status: "PENDING" },
    }),
    countRequests(schoolId, thisWeek.start, thisWeek.end, "change"),
    countRequests(schoolId, month.start, month.end, "change"),
    countRequests(schoolId, thisWeek.start, thisWeek.end, "request"),
    countRequests(schoolId, month.start, month.end, "request"),
    Promise.all(
      weekWindows.map(async (window) => ({
        ...window,
        label: format(parseISO(window.start), "MMM d"),
        changes: await countRequests(schoolId, window.start, window.end, "change"),
        requests: await countRequests(schoolId, window.start, window.end, "request"),
      })),
    ),
  ]);

  const buses = new Set(routes.map((route) => route.number.trim()).filter(Boolean))
    .size;
  const vanList = vehicles.filter(
    (vehicle) =>
      vehicle.vehicleType.toUpperCase() === "VAN" || /van/i.test(vehicle.name),
  );
  const vans = vanList.length;
  const { busCounts, vanCounts } = await loadVehicleCounts(schoolId, vanList);

  return {
    students,
    buses,
    vans,
    busRiders,
    vanRiders,
    busCounts,
    vanCounts,
    waiting,
    changesWeek,
    changesMonth,
    requestsWeek,
    requestsMonth,
    pendingRequests,
    weekLabel: `${format(parseISO(thisWeek.start), "MMM d")} – ${format(parseISO(thisWeek.end), "MMM d")}`,
    monthLabel: format(parseISO(month.start), "MMMM yyyy"),
    weeks: weekCounts,
  };
}
