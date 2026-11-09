import { randomUUID } from "crypto";
import { Prisma } from "@prisma/client";
import {
  formatLongDate,
  formatTime,
  schoolLocalTime,
  todayKey,
} from "./dates";
import type { LiveBusPoint } from "./onestep-gps";
import { AIM_FLEET_LABELS } from "./aim-fleet";
import { prisma } from "./prisma";

const REPORT_EVENTS = [
  "arrived",
  "first_pickup",
  "departed",
  "last_stop",
] as const;

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
  const existing = await hasEvent({
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

  for (const bus of args.buses) {
    if (bus.pending || bus.lat == null || bus.lng == null) continue;
    const miles = bus.miles ?? 0;
    const away = miles >= 0.25;
    const atSchool = bus.status === "At school" || miles < 0.15;
    const onRoute =
      bus.status === "On route" ||
      bus.status === "Arriving" ||
      (away && !atSchool);

    // Light trail (~ every 5 min) for audit.
    const recent = await prisma.$queryRaw<Array<{ id: string }>>`
      SELECT "id" FROM "GpsBusLog"
      WHERE "schoolId" = ${args.schoolId}
        AND "busLabel" = ${bus.label}
        AND "eventType" = ${"ping"}
        AND "recordedAt" > ${new Date(now.getTime() - 5 * 60 * 1000)}
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

    if (onRoute && away) {
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

    const arrived = await hasEvent({
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

    // Last student stop: keep moving the stamp while the bus is on route
    // before school arrival (AM pickups) or after leaving school (PM drops).
    const departed = await hasEvent({
      schoolId: args.schoolId,
      busLabel: bus.label,
      eventType: "departed",
      dayKey: day,
      trip,
    });
    if (onRoute && away && (!arrived || departed)) {
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
  type EventRow = {
    busLabel: string;
    company: string;
    trip: string;
    eventType: string;
    recordedAt: Date;
  };
  let rows: EventRow[] = [];
  try {
    rows = await prisma.$queryRaw<EventRow[]>`
      SELECT "busLabel", "company", "trip", "eventType", "recordedAt"
      FROM "GpsBusLog"
      WHERE "schoolId" = ${args.schoolId}
        AND "dayKey" = ${day}
        AND "eventType" IN (${Prisma.join([...REPORT_EVENTS])})
      ORDER BY "recordedAt" ASC
    `;
  } catch {
    rows = [];
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

  for (const label of AIM_FLEET_LABELS) {
    slot(label, "Minnehaha", "AM");
    slot(label, "Minnehaha", "PM");
  }

  for (const event of rows) {
    const row = slot(event.busLabel, event.company, event.trip);
    if (event.eventType === "first_pickup" && !row.firstPickupAt) {
      row.firstPickupAt = event.recordedAt;
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

  return [...map.values()].sort((a, b) => {
    const bus = a.busLabel.localeCompare(b.busLabel, undefined, {
      numeric: true,
    });
    if (bus) return bus;
    return a.trip.localeCompare(b.trip);
  });
}
