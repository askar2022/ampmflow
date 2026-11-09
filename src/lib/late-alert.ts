import {
  AIM_FLEET_LABELS,
  ensureAimFleetVehicles,
  isAimSchool,
} from "./aim-fleet";
import { loadVehicles } from "./gate";
import { prisma } from "./prisma";
import { parentSmsNumbers } from "./sms";
import { loadStudents } from "./transportation";
import type { PlanSnapshot, Trip } from "./types";

export type LateRide = {
  key: string;
  label: string;
  kind: "bus" | "van";
  fill: string;
};

export type LateAlertRecipient = {
  studentId: string;
  studentName: string;
  phones: string[];
};

const DELAY_OPTIONS = [5, 10, 15, 20, 30, 45] as const;
export type LateDelayMinutes = (typeof DELAY_OPTIONS)[number];

export function lateDelayOptions() {
  return DELAY_OPTIONS.map((minutes) => ({
    minutes,
    label: `${minutes} minutes late`,
  }));
}

function normalizeRideLabel(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function vanLabel(raw: string) {
  const clean = normalizeRideLabel(raw.replace(/^Van\s+/i, ""));
  return clean ? `Van ${clean}` : "Van";
}

function busLabel(raw: string) {
  const clean = normalizeRideLabel(raw.replace(/^Bus\s+/i, ""));
  return clean ? `Bus ${clean}` : "Bus";
}

function aimFleetRide(label: string): LateRide {
  const fill = label.replace(/^Bus\s+/i, "").trim() || label;
  const normalized = /3rd bus/i.test(label) ? "3rd bus" : busLabel(label);
  return {
    key: `bus:${normalized.toLowerCase()}`,
    label: normalized,
    kind: "bus",
    fill,
  };
}

function rideFromPlan(
  plan: PlanSnapshot,
  vehicleName?: string | null,
): LateRide | null {
  if (!plan.type || plan.type === "PARENT" || plan.waitingForAssignment) {
    return null;
  }
  const vanNote = plan.notes.match(/Van\s+[A-Za-z0-9-]+/i)?.[0];
  if (vanNote) {
    const label = vanLabel(vanNote);
    return {
      key: `van:${label.toLowerCase()}`,
      label,
      kind: "van",
      fill: label.replace(/^Van\s+/i, ""),
    };
  }
  if (vehicleName && /van/i.test(vehicleName) && !/3rd bus/i.test(vehicleName)) {
    const label = vanLabel(vehicleName);
    return {
      key: `van:${label.toLowerCase()}`,
      label,
      kind: "van",
      fill: label.replace(/^Van\s+/i, ""),
    };
  }
  if (
    vehicleName &&
    (/^bus\b/i.test(vehicleName.trim()) || /3rd bus/i.test(vehicleName))
  ) {
    return aimFleetRide(vehicleName);
  }
  if (plan.busNumber) {
    const label = busLabel(plan.busNumber);
    return {
      key: `bus:${label.toLowerCase()}`,
      label,
      kind: "bus",
      fill: plan.busNumber,
    };
  }
  return null;
}

function aimLateRidesOnly(): LateRide[] {
  return AIM_FLEET_LABELS.map((label) => aimFleetRide(label));
}

export function lateAlertSms(args: {
  rideLabel: string;
  minutes: number;
}) {
  const english = `AMPM Flow: ${args.rideLabel} is running about ${args.minutes} minutes late. We're sorry for the delay.`;
  const somali = `${args.rideLabel} waxa uu soo daahyaa ${args.minutes} daqiiqo, waxaan ka xunahay daahitaanka.`;
  return `${english}\n${somali}`;
}

export async function loadLateRides(schoolId: string): Promise<LateRide[]> {
  const school = await prisma.school.findUnique({
    where: { id: schoolId },
    select: { name: true },
  });

  // Aim / Minnehaha: only Bus 4, Bus 5, and 3rd bus — never Bus 1–3 or vans.
  if (isAimSchool(school?.name)) {
    await ensureAimFleetVehicles(schoolId).catch(() => undefined);
    return aimLateRidesOnly();
  }

  const [students, vehicles, routes] = await Promise.all([
    loadStudents(schoolId),
    loadVehicles(schoolId).catch(() => []),
    prisma.busRoute.findMany({
      where: { schoolId },
      select: { number: true },
      orderBy: { number: "asc" },
    }),
  ]);

  const vehicleName = new Map(
    (
      await prisma.student.findMany({
        where: { schoolId, active: true, vehicleId: { not: null } },
        select: { id: true, vehicle: { select: { name: true } } },
      })
    ).map((row) => [row.id, row.vehicle?.name || ""]),
  );

  const rides = new Map<string, LateRide>();
  for (const route of routes) {
    const label = busLabel(route.number);
    rides.set(`bus:${label.toLowerCase()}`, {
      key: `bus:${label.toLowerCase()}`,
      label,
      kind: "bus",
      fill: route.number,
    });
  }
  for (const vehicle of vehicles) {
    if (
      vehicle.vehicleType.toUpperCase() === "VAN" ||
      /van/i.test(vehicle.name)
    ) {
      const label = vanLabel(vehicle.name);
      rides.set(`van:${label.toLowerCase()}`, {
        key: `van:${label.toLowerCase()}`,
        label,
        kind: "van",
        fill: label.replace(/^Van\s+/i, ""),
      });
    } else if (
      vehicle.vehicleType.toUpperCase() === "BUS" ||
      /^bus\b/i.test(vehicle.name) ||
      /3rd bus/i.test(vehicle.name)
    ) {
      const ride = aimFleetRide(vehicle.name);
      rides.set(ride.key, ride);
    }
  }
  for (const student of students) {
    for (const trip of ["AM", "PM"] as Trip[]) {
      const plan = trip === "AM" ? student.am : student.pm;
      const ride = rideFromPlan(plan, vehicleName.get(student.id));
      if (ride) rides.set(ride.key, ride);
    }
  }

  return [...rides.values()].sort((a, b) => {
    if (a.kind !== b.kind) return a.kind === "bus" ? -1 : 1;
    return a.label.localeCompare(b.label, undefined, { numeric: true });
  });
}

export async function loadLateAlertRecipients(args: {
  schoolId: string;
  rideKey: string;
  trips?: Trip[];
}) {
  const trips = (args.trips || ["PM"]).filter(
    (trip): trip is Trip => trip === "AM" || trip === "PM",
  );
  if (!trips.length) {
    return { ride: null as LateRide | null, recipients: [] as LateAlertRecipient[] };
  }

  const [students, rides] = await Promise.all([
    loadStudents(args.schoolId),
    loadLateRides(args.schoolId),
  ]);
  const ride = rides.find((item) => item.key === args.rideKey) || null;
  if (!ride) {
    return { ride: null, recipients: [] as LateAlertRecipient[] };
  }

  const vehicleName = new Map(
    (
      await prisma.student.findMany({
        where: { schoolId: args.schoolId, active: true, vehicleId: { not: null } },
        select: { id: true, vehicle: { select: { name: true } } },
      })
    ).map((row) => [row.id, row.vehicle?.name || ""]),
  );

  const recipients: LateAlertRecipient[] = [];
  for (const student of students) {
    const matched = trips.some((trip) => {
      const plan = trip === "AM" ? student.am : student.pm;
      const current = rideFromPlan(plan, vehicleName.get(student.id));
      return current?.key === ride.key;
    });
    if (!matched) continue;
    const phones = parentSmsNumbers(student.parentPhone, student.parentPhone2);
    if (!phones.length) continue;
    recipients.push({
      studentId: student.id,
      studentName: student.fullName,
      phones,
    });
  }

  return { ride, recipients };
}

export function uniqueFamilyPhones(recipients: LateAlertRecipient[]) {
  return [...new Set(recipients.flatMap((row) => row.phones))];
}
