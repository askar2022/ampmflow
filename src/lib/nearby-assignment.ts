import { prisma } from "./prisma";
import { loadStudents } from "./transportation";
import type { EffectiveStudent, PlanSnapshot, Trip } from "./types";

export type NearbyAssignment = {
  address: string;
  trip: Trip;
  ride: string;
  vehicle: "bus" | "van";
  fill: string;
};

const STREET_WORDS: Record<string, string> = {
  north: "n",
  south: "s",
  east: "e",
  west: "w",
  street: "st",
  str: "st",
  avenue: "ave",
  av: "ave",
  road: "rd",
  drive: "dr",
  boulevard: "blvd",
  lane: "ln",
  court: "ct",
  place: "pl",
  terrace: "ter",
  highway: "hwy",
  parkway: "pkwy",
};

function cleanText(value: string) {
  return value
    .toLowerCase()
    .replace(/[.#,]/g, " ")
    .replace(/\b(apt|apartment|unit|suite|ste|bldg|building)\b.*$/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

function shortenStreetWords(value: string) {
  return value
    .split(" ")
    .map((part) => STREET_WORDS[part] || part)
    .join(" ");
}

export function normalizeStreetLine(line1: string) {
  return shortenStreetWords(cleanText(line1));
}

export function streetNameOnly(line1: string) {
  return normalizeStreetLine(line1).replace(/^\d+[a-z]?\s+/, "").trim();
}

function streetParts(address: string | null | undefined) {
  const raw = (address || "").trim();
  if (!raw || raw === "—" || raw.startsWith(",")) return null;
  const chunks = raw.split(",").map((part) => part.trim()).filter(Boolean);
  const line1 = chunks[0] || raw;
  const last = chunks[chunks.length - 1] || "";
  const zip = last.replace(/^[a-z]{2}\s+/i, "").replace(/\s+/g, "");
  const line = normalizeStreetLine(line1);
  const street = streetNameOnly(line1);
  if (!line) return null;
  return { line, street, zip, display: raw };
}

function scoreAddress(
  request: NonNullable<ReturnType<typeof streetParts>>,
  other: NonNullable<ReturnType<typeof streetParts>>,
) {
  if (request.line === other.line && request.zip && request.zip === other.zip) {
    return 100;
  }
  if (request.line === other.line) return 90;
  if (request.street && request.street.length > 3 && request.street === other.street) {
    if (request.zip && other.zip && request.zip === other.zip) return 70;
    if (!request.zip || !other.zip) return 50;
  }
  return 0;
}

function rideAddress(student: EffectiveStudent, plan: PlanSnapshot) {
  if (plan.destination === "DAYCARE") return student.daycareAddress;
  if (plan.destination === "CUSTOM") return plan.customAddress;
  return student.homeAddress;
}

function rosterAddresses(student: EffectiveStudent, plan: PlanSnapshot) {
  return [
    rideAddress(student, plan),
    student.homeAddress,
    student.daycareAddress,
    plan.customAddress,
  ].filter((value, index, list) => value && list.indexOf(value) === index);
}

function assignedRide(plan: PlanSnapshot, vehicleName?: string | null) {
  if (!plan.type || plan.type === "PARENT" || plan.waitingForAssignment) {
    return null;
  }
  const vanNote = plan.notes.match(/Van\s+[A-Za-z0-9-]+/i)?.[0];
  if (vanNote) {
    return {
      vehicle: "van" as const,
      fill: vanNote.replace(/^Van\s+/i, ""),
      ride: vanNote.replace(/^van/i, "Van"),
    };
  }
  if (vehicleName && /van/i.test(vehicleName)) {
    return {
      vehicle: "van" as const,
      fill: vehicleName.replace(/^Van\s+/i, ""),
      ride: /^van\b/i.test(vehicleName) ? vehicleName : `Van ${vehicleName}`,
    };
  }
  if (plan.busNumber) {
    return {
      vehicle: "bus" as const,
      fill: plan.busNumber,
      ride: `Bus ${plan.busNumber}`,
    };
  }
  return null;
}

export function nearbyFromRoster(args: {
  roster: EffectiveStudent[];
  studentId: string;
  trips: Trip[];
  vehicleName?: Map<string, string>;
}): NearbyAssignment | null {
  const trips = args.trips.filter((trip): trip is Trip => trip === "AM" || trip === "PM");
  if (!trips.length) return null;
  const request = args.roster.find((student) => student.id === args.studentId);
  if (!request) return null;

  const matches: Array<NearbyAssignment & { score: number }> = [];
  for (const trip of trips) {
    const requestPlan = trip === "AM" ? request.am : request.pm;
    const requestAddress = streetParts(rideAddress(request, requestPlan));
    if (!requestAddress) continue;

    for (const other of args.roster) {
      if (other.id === args.studentId) continue;
      const otherPlan = trip === "AM" ? other.am : other.pm;
      const ride = assignedRide(otherPlan, args.vehicleName?.get(other.id));
      if (!ride) continue;
      for (const raw of rosterAddresses(other, otherPlan)) {
        const otherAddress = streetParts(raw);
        if (!otherAddress) continue;
        const score = scoreAddress(requestAddress, otherAddress);
        if (score < 50) continue;
        matches.push({
          address: otherAddress.display,
          trip,
          ride: `${trip} ${ride.ride}`,
          vehicle: ride.vehicle,
          fill: ride.fill,
          score,
        });
      }
    }
  }

  if (!matches.length) return null;
  matches.sort((a, b) => b.score - a.score);
  const bestScore = matches[0].score;
  const top = matches.filter((item) => item.score === bestScore);
  const byRide = new Map<string, number>();
  for (const item of top) {
    byRide.set(item.ride, (byRide.get(item.ride) || 0) + 1);
  }
  top.sort((a, b) => (byRide.get(b.ride) || 0) - (byRide.get(a.ride) || 0));
  const chosen = top[0];
  return {
    address: chosen.address,
    trip: chosen.trip,
    ride: chosen.ride,
    vehicle: chosen.vehicle,
    fill: chosen.fill,
  };
}

export async function findNearbyAssignment(args: {
  schoolId: string;
  studentId: string;
  trips: Trip[];
}): Promise<NearbyAssignment | null> {
  const [students, vehicles] = await Promise.all([
    loadStudents(args.schoolId),
    prisma.student.findMany({
      where: {
        schoolId: args.schoolId,
        active: true,
        vehicleId: { not: null },
      },
      select: { id: true, vehicle: { select: { name: true } } },
    }),
  ]);
  return nearbyFromRoster({
    roster: students,
    studentId: args.studentId,
    trips: args.trips,
    vehicleName: new Map(vehicles.map((row) => [row.id, row.vehicle?.name || ""])),
  });
}
