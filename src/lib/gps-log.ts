import { randomUUID } from "crypto";
import { Prisma } from "@prisma/client";
import { AIM_FLEET_LABELS, isAimSchool } from "./aim-fleet";

/** Empty GPS report slots — school-specific demo fleet, never mix Aim into NIA. */
function gpsReportFleet(schoolName?: string | null) {
  if (isAimSchool(schoolName)) {
    return {
      company: "Minnehaha",
      labels: [...AIM_FLEET_LABELS] as string[],
    };
  }
  if (schoolName && /nia|nur/i.test(schoolName)) {
    return { company: "NIA", labels: ["Bus 1", "Bus 2"] };
  }
  if (schoolName && /sankofa/i.test(schoolName)) {
    return { company: "Sankofa", labels: ["Bus 1", "Bus 2", "Bus 3"] };
  }
  return { company: "School", labels: [] as string[] };
}
import {
  formatLongDate,
  formatTime,
  schoolLocalTime,
  todayKey,
} from "./dates";
import { milesBetween } from "./geocode";
import type { LiveBusPoint } from "./onestep-gps";
import { prisma } from "./prisma";

const REPORT_EVENTS = [
  "arrived",
  "first_pickup",
  "departed",
  "last_stop",
] as const;

/** Real movement — parked HQ pings must not count as pickup/stop. */
const MOVE_MILES = 0.2;
/** Near school = arrived / still on campus. */
const AT_SCHOOL_MILES = 0.2;
/** Last stop must be after first pickup by this many ms (or a real move). */
const LAST_STOP_GAP_MS = 3 * 60 * 1000;

export type GpsArrivalRow = {
  id: string;
  company: string;
  busLabel: string;
  eventType: string;
  status: string;
  miles: number | null;
  etaMinutes: number | null;
  trip: string;
  dayKey: string;
  recordedAt: Date;
};

export type GpsTripReportRow = {
  busLabel: string;
  company: string;
  trip: string;
  dayKey: string;
  firstPickupAt: Date | null;
  arrivedSchoolAt: Date | null;
  leftSchoolAt: Date | null;
  lastStopAt: Date | null;
};

let tableReady: Promise<void> | null = null;

export async function ensureGpsBusLogTable() {
  if (!tableReady) {
    tableReady = prisma
      .$executeRawUnsafe(
        `CREATE TABLE IF NOT EXISTS "GpsBusLog" (
          "id" TEXT PRIMARY KEY,
          "schoolId" TEXT NOT NULL,
          "company" TEXT NOT NULL DEFAULT 'Minnehaha',
          "busLabel" TEXT NOT NULL,
          "eventType" TEXT NOT NULL,
          "status" TEXT NOT NULL DEFAULT '',
          "miles" DOUBLE PRECISION,
          "etaMinutes" INTEGER,
          "lat" DOUBLE PRECISION,
          "lng" DOUBLE PRECISION,
          "dayKey" TEXT NOT NULL,
          "trip" TEXT NOT NULL DEFAULT 'AM',
          "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
        )`,
      )
      .then(() =>
        prisma.$executeRawUnsafe(
          `CREATE INDEX IF NOT EXISTS "GpsBusLog_school_day_idx"
           ON "GpsBusLog" ("schoolId", "dayKey", "recordedAt" DESC)`,
        ),
      )
      .then(() => undefined)
      .catch(() => undefined);
  }
  await tableReady;
}

function tripForNow(date = new Date()) {
  const hour = Number(schoolLocalTime(date).hhmm.slice(0, 2));
  return hour < 12 ? "AM" : "PM";
}

export function formatGpsStamp(date = new Date()) {
  return `${formatLongDate(date)} · ${formatTime(date)}`;
}

export function formatGpsClock(date: Date | string | null | undefined) {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return "—";
  return formatGpsStamp(d);
}

async function hasEvent(args: {
  schoolId: string;
  busLabel: string;
  eventType: string;
  dayKey: string;
  trip: string;
}) {
  const rows = await prisma.$queryRaw<Array<{ id: string }>>`
    SELECT "id" FROM "GpsBusLog"
    WHERE "schoolId" = ${args.schoolId}
      AND "busLabel" = ${args.busLabel}
      AND "eventType" = ${args.eventType}
      AND "dayKey" = ${args.dayKey}
      AND "trip" = ${args.trip}
    LIMIT 1
  `.catch(() => []);
  return rows[0] || null;
}

async function loadEventRow(args: {
  schoolId: string;
  busLabel: string;
  eventType: string;
  dayKey: string;
  trip: string;
}) {
  const rows = await prisma.$queryRaw<
    Array<{ id: string; lat: number | null; lng: number | null; recordedAt: Date }>
  >`
    SELECT "id", "lat", "lng", "recordedAt"
    FROM "GpsBusLog"
    WHERE "schoolId" = ${args.schoolId}
      AND "busLabel" = ${args.busLabel}
      AND "eventType" = ${args.eventType}
      AND "dayKey" = ${args.dayKey}
      AND "trip" = ${args.trip}
    LIMIT 1
  `.catch(() => []);
  return rows[0] || null;
}

async function insertEvent(args: {
  schoolId: string;
  company: string;
  bus: LiveBusPoint;
  eventType: string;
  dayKey: string;
  trip: string;
  at: Date;
}) {
  await prisma.$executeRaw`
    INSERT INTO "GpsBusLog"
      ("id","schoolId","company","busLabel","eventType","status","miles","etaMinutes","lat","lng","dayKey","trip","recordedAt")
    VALUES
      (${randomUUID()}, ${args.schoolId}, ${args.company}, ${args.bus.label}, ${args.eventType},
       ${args.bus.status}, ${args.bus.miles}, ${args.bus.etaMinutes}, ${args.bus.lat}, ${args.bus.lng},
       ${args.dayKey}, ${args.trip}, ${args.at})
  `.catch(() => undefined);
}

async function upsertLastStop(args: {
  schoolId: string;
  company: string;
  bus: LiveBusPoint;
  dayKey: string;
  trip: string;
  at: Date;
}) {
  const existing = await loadEventRow({
    schoolId: args.schoolId,
    busLabel: args.bus.label,
    eventType: "last_stop",
    dayKey: args.dayKey,
    trip: args.trip,
  });
  if (existing) {
    await prisma.$executeRaw`
      UPDATE "GpsBusLog"
      SET
        "status" = ${args.bus.status},
        "miles" = ${args.bus.miles},
        "etaMinutes" = ${args.bus.etaMinutes},
        "lat" = ${args.bus.lat},
        "lng" = ${args.bus.lng},
        "recordedAt" = ${args.at}
      WHERE "id" = ${existing.id}
    `.catch(() => undefined);
    return;
  }
  await insertEvent({
    ...args,
    eventType: "last_stop",
  });
}

async function latestPing(args: {
  schoolId: string;
  busLabel: string;
  dayKey: string;
}) {
  const rows = await prisma.$queryRaw<
    Array<{ lat: number; lng: number; recordedAt: Date; miles: number | null }>
  >`
    SELECT "lat", "lng", "recordedAt", "miles"
    FROM "GpsBusLog"
    WHERE "schoolId" = ${args.schoolId}
      AND "busLabel" = ${args.busLabel}
      AND "dayKey" = ${args.dayKey}
      AND "eventType" = ${"ping"}
      AND "lat" IS NOT NULL AND "lng" IS NOT NULL
    ORDER BY "recordedAt" DESC
    LIMIT 1
  `.catch(() => []);
  return rows[0] || null;
}

/** Drop same-minute fake pickup/stop pairs from a parked HQ bus. */
async function clearParkedFalseStarts(args: {
  schoolId: string;
  busLabel: string;
  dayKey: string;
  trip: string;
}) {
  const first = await loadEventRow({
    ...args,
    eventType: "first_pickup",
  });
  const last = await loadEventRow({
    ...args,
    eventType: "last_stop",
  });
  if (!first || !last) return;
  const gap = Math.abs(last.recordedAt.getTime() - first.recordedAt.getTime());
  const sameSpot =
    first.lat != null &&
    first.lng != null &&
    last.lat != null &&
    last.lng != null &&
    milesBetween(
      { lat: first.lat, lng: first.lng },
      { lat: last.lat, lng: last.lng },
    ) < MOVE_MILES;
  if (gap < LAST_STOP_GAP_MS && sameSpot) {
    await prisma.$executeRaw`
      DELETE FROM "GpsBusLog" WHERE "id" = ${first.id}
    `.catch(() => undefined);
    await prisma.$executeRaw`
      DELETE FROM "GpsBusLog" WHERE "id" = ${last.id}
    `.catch(() => undefined);
  }
}

/**
 * Remove the bad “same time for first pickup and last stop” rows
 * (and the twin Bus 4 / Bus 5 stamps from one poll).
 */
export async function scrubFalseGpsTripStamps(
  schoolId: string,
  dayKey = todayKey(),
) {
  await ensureGpsBusLogTable();
  type Row = {
    id: string;
    busLabel: string;
    trip: string;
    eventType: string;
    recordedAt: Date;
    lat: number | null;
    lng: number | null;
  };
  const rows = await prisma.$queryRaw<Row[]>`
    SELECT "id", "busLabel", "trip", "eventType", "recordedAt", "lat", "lng"
    FROM "GpsBusLog"
    WHERE "schoolId" = ${schoolId}
      AND "dayKey" = ${dayKey}
      AND "eventType" IN (${"first_pickup"}, ${"last_stop"}, ${"arrived"})
  `.catch(() => [] as Row[]);

  const byBusTrip = new Map<string, { first?: Row; last?: Row; arrived?: Row }>();
  for (const row of rows) {
    const key = `${row.busLabel}::${row.trip}`;
    const slot = byBusTrip.get(key) || {};
    if (row.eventType === "first_pickup") slot.first = row;
    if (row.eventType === "last_stop") slot.last = row;
    if (row.eventType === "arrived") slot.arrived = row;
    byBusTrip.set(key, slot);
  }

  const deleteIds = new Set<string>();
  for (const slot of byBusTrip.values()) {
    const { first, last, arrived } = slot;
    if (!first) continue;

    // Twin stamp: first pickup and last stop in the same minute / same spot.
    if (last) {
      const gap = Math.abs(last.recordedAt.getTime() - first.recordedAt.getTime());
      const sameSpot =
        first.lat != null &&
        first.lng != null &&
        last.lat != null &&
        last.lng != null &&
        milesBetween(
          { lat: first.lat, lng: first.lng },
          { lat: last.lat, lng: last.lng },
        ) < MOVE_MILES;
      if (gap < LAST_STOP_GAP_MS || sameSpot) {
        deleteIds.add(last.id);
        // Without a real school arrival, the "first pickup" was also a false HQ ping.
        if (!arrived) deleteIds.add(first.id);
      }
    } else if (!arrived) {
      // Lone first_pickup with no arrival and no later stop — likely parked HQ.
      deleteIds.add(first.id);
    }
  }

  // Same clock minute on Bus 4 and Bus 5 first_pickup = one poll wrote both.
  const firsts = [...byBusTrip.values()]
    .map((slot) => slot.first)
    .filter((row): row is Row => Boolean(row));
  for (let i = 0; i < firsts.length; i += 1) {
    for (let j = i + 1; j < firsts.length; j += 1) {
      const a = firsts[i];
      const b = firsts[j];
      if (a.busLabel === b.busLabel) continue;
      if (a.trip !== b.trip) continue;
      const gap = Math.abs(a.recordedAt.getTime() - b.recordedAt.getTime());
      if (gap > 60_000) continue;
      const slotA = byBusTrip.get(`${a.busLabel}::${a.trip}`);
      const slotB = byBusTrip.get(`${b.busLabel}::${b.trip}`);
      if (!slotA?.arrived) deleteIds.add(a.id);
      if (!slotB?.arrived) deleteIds.add(b.id);
      if (slotA?.last && !slotA.arrived) deleteIds.add(slotA.last.id);
      if (slotB?.last && !slotB.arrived) deleteIds.add(slotB.last.id);
    }
  }

  for (const id of deleteIds) {
    await prisma.$executeRaw`
      DELETE FROM "GpsBusLog" WHERE "id" = ${id}
    `.catch(() => undefined);
  }
}

export async function recordLiveGpsBuses(args: {
  schoolId: string;
  company?: string;
  buses: LiveBusPoint[];
}) {
  await ensureGpsBusLogTable();
  const company = args.company || "Minnehaha";
  const day = todayKey();
  const trip = tripForNow();
  const now = new Date();
  await scrubFalseGpsTripStamps(args.schoolId, day);

  for (const bus of args.buses) {
    if (bus.pending || bus.lat == null || bus.lng == null) continue;

    const miles = bus.miles;
    const atSchool =
      bus.status === "At school" ||
      (miles != null && miles <= AT_SCHOOL_MILES);
    const away = miles != null && miles > AT_SCHOOL_MILES;

    const prev = await latestPing({
      schoolId: args.schoolId,
      busLabel: bus.label,
      dayKey: day,
    });
    const moved = prev
      ? milesBetween(
          { lat: prev.lat, lng: prev.lng },
          { lat: bus.lat, lng: bus.lng },
        ) >= MOVE_MILES
      : false;
    // First sample of the day is an anchor only — never a pickup by itself.
    const reallyMoving = Boolean(prev) && moved;

    // Trail for movement checks (~ every 2 min while live).
    const recent = await prisma.$queryRaw<Array<{ id: string }>>`
      SELECT "id" FROM "GpsBusLog"
      WHERE "schoolId" = ${args.schoolId}
        AND "busLabel" = ${bus.label}
        AND "eventType" = ${"ping"}
        AND "recordedAt" > ${new Date(now.getTime() - 2 * 60 * 1000)}
      LIMIT 1
    `.catch(() => []);
    if (!recent.length) {
      await insertEvent({
        schoolId: args.schoolId,
        company,
        bus,
        eventType: "ping",
        dayKey: day,
        trip,
        at: now,
      });
    }

    // Parked at HQ / depot: away from school but not moving — clear bad stamps.
    if (away && !reallyMoving) {
      await clearParkedFalseStarts({
        schoolId: args.schoolId,
        busLabel: bus.label,
        dayKey: day,
        trip,
      });
      const parkedFirst = await loadEventRow({
        schoolId: args.schoolId,
        busLabel: bus.label,
        eventType: "first_pickup",
        dayKey: day,
        trip,
      });
      if (
        parkedFirst?.lat != null &&
        parkedFirst.lng != null &&
        milesBetween(
          { lat: parkedFirst.lat, lng: parkedFirst.lng },
          { lat: bus.lat, lng: bus.lng },
        ) < MOVE_MILES
      ) {
        await prisma.$executeRaw`
          DELETE FROM "GpsBusLog" WHERE "id" = ${parkedFirst.id}
        `.catch(() => undefined);
      }
    }

    // First stop pickup: must be away from school AND actually moving.
    if (away && reallyMoving && !atSchool) {
      const first = await hasEvent({
        schoolId: args.schoolId,
        busLabel: bus.label,
        eventType: "first_pickup",
        dayKey: day,
        trip,
      });
      if (!first) {
        await insertEvent({
          schoolId: args.schoolId,
          company,
          bus,
          eventType: "first_pickup",
          dayKey: day,
          trip,
          at: now,
        });
      }
    }

    // Arrived school — always when GPS says on campus (Bus 5 drop-off).
    if (atSchool) {
      const arrived = await hasEvent({
        schoolId: args.schoolId,
        busLabel: bus.label,
        eventType: "arrived",
        dayKey: day,
        trip,
      });
      if (!arrived) {
        await insertEvent({
          schoolId: args.schoolId,
          company,
          bus,
          eventType: "arrived",
          dayKey: day,
          trip,
          at: now,
        });
      }
    }

    const arrived = await loadEventRow({
      schoolId: args.schoolId,
      busLabel: bus.label,
      eventType: "arrived",
      dayKey: day,
      trip,
    });

    if (arrived && away && !atSchool) {
      const left = await hasEvent({
        schoolId: args.schoolId,
        busLabel: bus.label,
        eventType: "departed",
        dayKey: day,
        trip,
      });
      if (!left) {
        await insertEvent({
          schoolId: args.schoolId,
          company,
          bus,
          eventType: "departed",
          dayKey: day,
          trip,
          at: now,
        });
      }
    }

    const departed = await hasEvent({
      schoolId: args.schoolId,
      busLabel: bus.label,
      eventType: "departed",
      dayKey: day,
      trip,
    });
    const firstPickup = await loadEventRow({
      schoolId: args.schoolId,
      busLabel: bus.label,
      eventType: "first_pickup",
      dayKey: day,
      trip,
    });

    // Last student stop only after real movement past first pickup.
    if (
      firstPickup &&
      reallyMoving &&
      away &&
      !atSchool &&
      (!arrived || departed)
    ) {
      const sinceFirst = now.getTime() - firstPickup.recordedAt.getTime();
      const movedFromFirst =
        firstPickup.lat != null &&
        firstPickup.lng != null &&
        milesBetween(
          { lat: firstPickup.lat, lng: firstPickup.lng },
          { lat: bus.lat, lng: bus.lng },
        ) >= MOVE_MILES;
      if (sinceFirst >= LAST_STOP_GAP_MS || movedFromFirst) {
        await upsertLastStop({
          schoolId: args.schoolId,
          company,
          bus,
          dayKey: day,
          trip,
          at: now,
        });
      }
    }
  }
}

export async function loadGpsArrivals(args: {
  schoolId: string;
  dayKey?: string;
}) {
  await ensureGpsBusLogTable();
  const day = args.dayKey || todayKey();
  try {
    return await prisma.$queryRaw<GpsArrivalRow[]>`
      SELECT
        "id", "company", "busLabel", "eventType", "status", "miles", "etaMinutes",
        "trip", "dayKey", "recordedAt"
      FROM "GpsBusLog"
      WHERE "schoolId" = ${args.schoolId}
        AND "dayKey" = ${day}
        AND "eventType" = ${"arrived"}
      ORDER BY "recordedAt" ASC
    `;
  } catch {
    return [];
  }
}

export async function loadGpsArrivalDays(schoolId: string, limit = 30) {
  await ensureGpsBusLogTable();
  try {
    return await prisma.$queryRaw<Array<{ dayKey: string; count: number }>>`
      SELECT "dayKey", COUNT(*)::int AS "count"
      FROM "GpsBusLog"
      WHERE "schoolId" = ${schoolId}
        AND "eventType" IN (${Prisma.join([...REPORT_EVENTS])})
      GROUP BY "dayKey"
      ORDER BY "dayKey" DESC
      LIMIT ${limit}
    `;
  } catch {
    return [];
  }
}

export async function loadGpsTripReport(args: {
  schoolId: string;
  dayKey?: string;
}): Promise<GpsTripReportRow[]> {
  await ensureGpsBusLogTable();
  const day = args.dayKey || todayKey();
  await scrubFalseGpsTripStamps(args.schoolId, day);

  const school = await prisma.school.findUnique({
    where: { id: args.schoolId },
    select: { name: true },
  });
  const fleet = gpsReportFleet(school?.name);
  const aimSchool = isAimSchool(school?.name);

  type EventRow = {
    busLabel: string;
    company: string;
    trip: string;
    eventType: string;
    recordedAt: Date;
    lat: number | null;
    lng: number | null;
  };
  let rows: EventRow[] = [];
  try {
    rows = await prisma.$queryRaw<EventRow[]>`
      SELECT "busLabel", "company", "trip", "eventType", "recordedAt", "lat", "lng"
      FROM "GpsBusLog"
      WHERE "schoolId" = ${args.schoolId}
        AND "dayKey" = ${day}
        AND "eventType" IN (${Prisma.join([...REPORT_EVENTS])})
      ORDER BY "recordedAt" ASC
    `;
  } catch {
    rows = [];
  }

  // Non-Aim schools must never show Minnehaha Aim Bus 4/5/3rd rows.
  if (!aimSchool) {
    rows = rows.filter(
      (row) =>
        !/minnehaha/i.test(row.company || "") &&
        !/^bus\s*[45]$/i.test(row.busLabel.trim()) &&
        !/3rd\s*bus/i.test(row.busLabel),
    );
  }

  const map = new Map<string, GpsTripReportRow>();
  function slot(busLabel: string, company: string, trip: string) {
    const key = `${busLabel}::${trip}`;
    let row = map.get(key);
    if (!row) {
      row = {
        busLabel,
        company,
        trip,
        dayKey: day,
        firstPickupAt: null,
        arrivedSchoolAt: null,
        leftSchoolAt: null,
        lastStopAt: null,
      };
      map.set(key, row);
    }
    return row;
  }

  for (const label of fleet.labels) {
    slot(label, fleet.company, "AM");
    slot(label, fleet.company, "PM");
  }

  const firstMeta = new Map<
    string,
    { at: Date; lat: number | null; lng: number | null }
  >();

  for (const event of rows) {
    const row = slot(event.busLabel, event.company, event.trip);
    const key = `${event.busLabel}::${event.trip}`;
    if (event.eventType === "first_pickup" && !row.firstPickupAt) {
      row.firstPickupAt = event.recordedAt;
      firstMeta.set(key, {
        at: event.recordedAt,
        lat: event.lat,
        lng: event.lng,
      });
    }
    if (event.eventType === "arrived" && !row.arrivedSchoolAt) {
      row.arrivedSchoolAt = event.recordedAt;
    }
    if (event.eventType === "departed" && !row.leftSchoolAt) {
      row.leftSchoolAt = event.recordedAt;
    }
    if (event.eventType === "last_stop") {
      row.lastStopAt = event.recordedAt;
    }
  }

  // Never show twin first/last times (same poll / parked HQ).
  for (const row of map.values()) {
    if (row.firstPickupAt && row.lastStopAt) {
      const gap = Math.abs(
        row.lastStopAt.getTime() - row.firstPickupAt.getTime(),
      );
      if (gap < LAST_STOP_GAP_MS) {
        row.lastStopAt = null;
        if (!row.arrivedSchoolAt) row.firstPickupAt = null;
      }
    }
  }

  // Bus 4 and Bus 5 must not share the same first-pickup minute unless both arrived.
  const amFirst = [...map.values()].filter(
    (row) => row.trip === "AM" && row.firstPickupAt && !row.arrivedSchoolAt,
  );
  for (let i = 0; i < amFirst.length; i += 1) {
    for (let j = i + 1; j < amFirst.length; j += 1) {
      const a = amFirst[i];
      const b = amFirst[j];
      if (!a.firstPickupAt || !b.firstPickupAt) continue;
      const gap = Math.abs(
        a.firstPickupAt.getTime() - b.firstPickupAt.getTime(),
      );
      if (gap <= 60_000) {
        a.firstPickupAt = null;
        a.lastStopAt = null;
        b.firstPickupAt = null;
        b.lastStopAt = null;
      }
    }
  }

  return [...map.values()].sort((a, b) => {
    const bus = a.busLabel.localeCompare(b.busLabel, undefined, {
      numeric: true,
    });
    if (bus) return bus;
    return a.trip.localeCompare(b.trip);
  });
}
