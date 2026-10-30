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

export type CoordinatorAnalytics = {
  students: number;
  buses: number;
  vans: number;
  busRiders: number;
  vanRiders: number;
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
  const vans = vehicles.filter(
    (vehicle) =>
      vehicle.vehicleType.toUpperCase() === "VAN" || /van/i.test(vehicle.name),
  ).length;

  return {
    students,
    buses,
    vans,
    busRiders,
    vanRiders,
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
