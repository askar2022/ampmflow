import { prisma } from "./prisma";
import { loadSchoolGeoPoints, milesBetween, type GeoPoint } from "./geocode";
import { loadStudents } from "./transportation";
import type { EffectiveStudent, PlanSnapshot, Trip } from "./types";

export type NearbyAssignment = {
  address: string;
  trip: Trip;
  ride: string;
  vehicle: "bus" | "van";
  fill: string;
  miles?: number;
};

const MAX_NEARBY_MILES = 2;

const STREET_WORDS: Record<string, string> = {
  north: "n",
  south: "s",
  east: "e",
  west: "w",
  northeast: "ne",
  northwest: "nw",
  southeast: "se",
  southwest: "sw",
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

const DIRECTION = "n|s|e|w|ne|nw|se|sw";

export function streetNameOnly(line1: string) {
  return normalizeStreetLine(line1)
    .replace(/^\d+[a-z]?\s+/, "")
    .replace(/^(old|new)\s+/, "")
    .replace(new RegExp(`^(${DIRECTION})\\s+`), "")
    .replace(new RegExp(`\\s+(${DIRECTION})$`), "")
    .replace(/\b(minneapolis|st paul|saint paul|mn)\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function realZip(value: string) {
  return value.match(/\b(\d{5})(?:-\d{4})?\b/)?.[1] || "";
}

function streetParts(address: string | null | undefined) {
  const raw = (address || "").trim();
  if (!raw || raw === "—" || raw.startsWith(",")) return null;
  const zip = realZip(raw);
  const withoutZip = raw.replace(/\b\d{5}(?:-\d{4})?\b/, " ");
  const chunks = withoutZip.split(",").map((part) => part.trim()).filter(Boolean);
  const line1 = chunks[0] || raw;
  const line = normalizeStreetLine(line1);
  const street = streetNameOnly(line1);
  if (!line && !street) return null;
  return { line, street, zip, display: raw };
}

function scoreAddress(
  request: NonNullable<ReturnType<typeof streetParts>>,
  other: NonNullable<ReturnType<typeof streetParts>>,
) {
  if (request.line && request.line === other.line) {
    if (request.zip && other.zip && request.zip === other.zip) return 100;
    return 90;
  }
  if (request.street && request.street.length > 3 && request.street === other.street) {
    if (request.zip && other.zip && request.zip === other.zip) return 70;
    return 55;
  }
  return 0;
}

function rideAddress(student: EffectiveStudent, plan: PlanSnapshot) {
  if (plan.destination === "DAYCARE") return student.daycareAddress;
  if (plan.destination === "CUSTOM") return plan.customAddress;
  return student.homeAddress;
}

function uniqueAddresses(...values: Array<string | null | undefined>) {
  return [
    ...new Set(values.map((value) => (value || "").trim()).filter(Boolean)),
  ];
}

function requestAddresses(student: EffectiveStudent, plan: PlanSnapshot) {
  return uniqueAddresses(rideAddress(student, plan));
}

function rosterAddresses(student: EffectiveStudent, plan: PlanSnapshot) {
  return uniqueAddresses(rideAddress(student, plan));
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

type StudentAddressIds = {
  homeId: string | null;
  daycareId: string | null;
  customByTrip: Partial<Record<Trip, string | null>>;
};

function pointsFor(
  ids: StudentAddressIds | undefined,
  plan: PlanSnapshot,
  geo: Map<string, GeoPoint>,
) {
  if (!ids) return [] as GeoPoint[];
  const wanted = [
    plan.destination === "DAYCARE"
      ? ids.daycareId
      : plan.destination === "CUSTOM"
        ? ids.customByTrip[plan.trip]
        : ids.homeId,
  ].filter(Boolean) as string[];
  const points: GeoPoint[] = [];
  const seen = new Set<string>();
  for (const id of wanted) {
    const point = geo.get(id);
    if (!point || seen.has(point.id)) continue;
    seen.add(point.id);
    points.push(point);
  }
  return points;
}

function pickClosest(args: {
  roster: EffectiveStudent[];
  studentId: string;
  trips: Trip[];
  vehicleName?: Map<string, string>;
  geo: Map<string, GeoPoint>;
  addressIds: Map<string, StudentAddressIds>;
}): NearbyAssignment | null {
  const trips = args.trips.filter((trip): trip is Trip => trip === "AM" || trip === "PM");
  const request = args.roster.find((student) => student.id === args.studentId);
  if (!request || !trips.length) return null;

  const matches: Array<NearbyAssignment & { score: number }> = [];
  for (const trip of trips) {
    const requestPlan = trip === "AM" ? request.am : request.pm;
    const from = pointsFor(args.addressIds.get(request.id), requestPlan, args.geo);
    if (!from.length) continue;
    for (const other of args.roster) {
      if (other.id === args.studentId) continue;
      const otherPlan = trip === "AM" ? other.am : other.pm;
      const ride = assignedRide(otherPlan, args.vehicleName?.get(other.id));
      if (!ride) continue;
      const to = pointsFor(args.addressIds.get(other.id), otherPlan, args.geo);
      for (const requestPoint of from) {
        for (const otherPoint of to) {
          const miles = milesBetween(requestPoint, otherPoint);
          if (miles > MAX_NEARBY_MILES) continue;
          matches.push({
            address: otherPoint.address,
            trip,
            ride: `${trip} ${ride.ride}`,
            vehicle: ride.vehicle,
            fill: ride.fill,
            miles,
            score: 1000 - miles * 100,
          });
        }
      }
    }
  }
  if (!matches.length) return null;
  matches.sort((a, b) => (a.miles ?? 99) - (b.miles ?? 99));
  const chosen = matches[0];
  return {
    address: chosen.address,
    trip: chosen.trip,
    ride: chosen.ride,
    vehicle: chosen.vehicle,
    fill: chosen.fill,
    miles: Math.round((chosen.miles || 0) * 10) / 10,
  };
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
    const requestKeys = requestAddresses(request, requestPlan)
      .map((value) => streetParts(value))
      .filter((value): value is NonNullable<typeof value> => Boolean(value));
    if (!requestKeys.length) continue;

    for (const other of args.roster) {
      if (other.id === args.studentId) continue;
      const otherPlan = trip === "AM" ? other.am : other.pm;
      const ride = assignedRide(otherPlan, args.vehicleName?.get(other.id));
      if (!ride) continue;
      for (const raw of rosterAddresses(other, otherPlan)) {
        const otherAddress = streetParts(raw);
        if (!otherAddress) continue;
        let best = 0;
        for (const requestAddress of requestKeys) {
          best = Math.max(best, scoreAddress(requestAddress, otherAddress));
        }
        if (best < 50) continue;
        matches.push({
          address: otherAddress.display,
          trip,
          ride: `${trip} ${ride.ride}`,
          vehicle: ride.vehicle,
          fill: ride.fill,
          score: best,
        });
      }
    }
  }

  if (!matches.length) return null;
  matches.sort((a, b) => b.score - a.score);
  const chosen = matches[0];
  return {
    address: chosen.address,
    trip: chosen.trip,
    ride: chosen.ride,
    vehicle: chosen.vehicle,
    fill: chosen.fill,
  };
}

async function loadAddressIds(schoolId: string) {
  const rows = await prisma.student.findMany({
    where: { schoolId, active: true },
    select: {
      id: true,
      homeAddressId: true,
      daycare: { select: { addressId: true } },
      assignments: {
        select: { trip: true, customAddressId: true },
      },
    },
  });
  const map = new Map<string, StudentAddressIds>();
  const allIds: string[] = [];
  for (const row of rows) {
    const customByTrip: StudentAddressIds["customByTrip"] = {};
    for (const assignment of row.assignments) {
      if (assignment.trip === "AM" || assignment.trip === "PM") {
        customByTrip[assignment.trip] = assignment.customAddressId;
        if (assignment.customAddressId) allIds.push(assignment.customAddressId);
      }
    }
    map.set(row.id, {
      homeId: row.homeAddressId,
      daycareId: row.daycare?.addressId || null,
      customByTrip,
    });
    if (row.homeAddressId) allIds.push(row.homeAddressId);
    if (row.daycare?.addressId) allIds.push(row.daycare.addressId);
  }
  return { map, allIds };
}

export async function nearbySuggestionsForSchool(args: {
  schoolId: string;
  roster: EffectiveStudent[];
  requests: Array<{ studentId: string; trips: Trip[] }>;
  geocode?: boolean;
}) {
  try {
    const { map, allIds } = await loadAddressIds(args.schoolId);
    const geo = await loadSchoolGeoPoints(args.schoolId, allIds, {
      geocode: args.geocode === true,
      limit: 8,
    });
    const vehicles = await prisma.student.findMany({
      where: {
        schoolId: args.schoolId,
        active: true,
        vehicleId: { not: null },
      },
      select: { id: true, vehicle: { select: { name: true } } },
    });
    const vehicleName = new Map(
      vehicles.map((row) => [row.id, row.vehicle?.name || ""]),
    );
    const suggestions = new Map<string, NearbyAssignment | null>();
    for (const item of args.requests) {
      suggestions.set(
        item.studentId,
        pickClosest({
          roster: args.roster,
          studentId: item.studentId,
          trips: item.trips,
          vehicleName,
          geo,
          addressIds: map,
        }) ||
          nearbyFromRoster({
            roster: args.roster,
            studentId: item.studentId,
            trips: item.trips,
            vehicleName,
          }),
      );
    }
    return suggestions;
  } catch {
    return new Map<string, NearbyAssignment | null>();
  }
}

export async function findNearbyAssignment(args: {
  schoolId: string;
  studentId: string;
  trips: Trip[];
}): Promise<NearbyAssignment | null> {
  const students = await loadStudents(args.schoolId);
  const suggestions = await nearbySuggestionsForSchool({
    schoolId: args.schoolId,
    roster: students,
    requests: [{ studentId: args.studentId, trips: args.trips }],
    geocode: true,
  });
  return suggestions.get(args.studentId) || null;
}
