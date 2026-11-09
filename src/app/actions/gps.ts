"use server";

import { getSession } from "@/lib/auth";
import { loadCompanySchools } from "@/lib/company-access";
import { todayKey } from "@/lib/dates";
import {
  formatGpsStamp,
  loadGpsArrivalDays,
  loadGpsArrivals,
  loadGpsTripReport,
  recordLiveGpsBuses,
} from "@/lib/gps-log";
import { fetchOneStepLiveBuses, onestepGpsConfigured } from "@/lib/onestep-gps";
import { prisma } from "@/lib/prisma";

async function resolveGpsSchoolId(schoolId?: string) {
  const user = await getSession();
  if (!user) return { ok: false as const, error: "Sign in required." };

  let resolvedSchoolId = user.schoolId;
  if (user.role === "BUS_COMPANY") {
    if (schoolId) {
      const schools = await loadCompanySchools(user);
      if (!schools.some((school) => school.id === schoolId)) {
        return { ok: false as const, error: "That school is not on your list." };
      }
      resolvedSchoolId = schoolId;
    }
  } else if (
    !["COORDINATOR", "ADMINISTRATOR", "FRONT_DESK"].includes(user.role)
  ) {
    return { ok: false as const, error: "Not allowed." };
  } else if (schoolId && schoolId !== user.schoolId) {
    return { ok: false as const, error: "Not allowed for that school." };
  } else if (schoolId) {
    resolvedSchoolId = schoolId;
  }

  return { ok: true as const, user, schoolId: resolvedSchoolId };
}

export async function loadLiveGpsFeed(schoolId?: string) {
  const access = await resolveGpsSchoolId(schoolId);
  if (!access.ok) return access;

  const school = await prisma.school.findUnique({
    where: { id: access.schoolId },
    select: { name: true },
  });
  const feed = await fetchOneStepLiveBuses(school?.name);
  if (feed.live) {
    await recordLiveGpsBuses({
      schoolId: access.schoolId,
      company: "Minnehaha",
      buses: feed.buses,
    });
  }

  const day = todayKey();
  const [arrivals, days] = await Promise.all([
    loadGpsArrivals({ schoolId: access.schoolId, dayKey: day }),
    loadGpsArrivalDays(access.schoolId),
  ]);

  return {
    ok: true as const,
    configured: onestepGpsConfigured(),
    feed,
    stamp: formatGpsStamp(),
    dayKey: day,
    arrivals: arrivals.map((row) => ({
      ...row,
      recordedAt: row.recordedAt.toISOString(),
      stamp: formatGpsStamp(row.recordedAt),
    })),
    arrivalDays: days,
  };
}

export async function loadGpsArrivalHistory(input: {
  schoolId?: string;
  dayKey: string;
}) {
  const access = await resolveGpsSchoolId(input.schoolId);
  if (!access.ok) return access;

  const arrivals = await loadGpsArrivals({
    schoolId: access.schoolId,
    dayKey: input.dayKey,
  });
  return {
    ok: true as const,
    dayKey: input.dayKey,
    arrivals: arrivals.map((row) => ({
      ...row,
      recordedAt: row.recordedAt.toISOString(),
      stamp: formatGpsStamp(row.recordedAt),
    })),
  };
}

function serializeTripRows(
  rows: Awaited<ReturnType<typeof loadGpsTripReport>>,
) {
  return rows.map((row) => ({
    ...row,
    firstPickupAt: row.firstPickupAt?.toISOString() || null,
    arrivedSchoolAt: row.arrivedSchoolAt?.toISOString() || null,
    leftSchoolAt: row.leftSchoolAt?.toISOString() || null,
    lastStopAt: row.lastStopAt?.toISOString() || null,
  }));
}

export async function loadGpsReportDay(input: {
  schoolId?: string;
  dayKey: string;
}) {
  const access = await resolveGpsSchoolId(input.schoolId);
  if (!access.ok) return access;

  // Refresh live positions first so Arrived school updates when Bus 5 is on campus.
  const school = await prisma.school.findUnique({
    where: { id: access.schoolId },
    select: { name: true },
  });
  const feed = await fetchOneStepLiveBuses(school?.name);
  if (feed.live) {
    await recordLiveGpsBuses({
      schoolId: access.schoolId,
      company: "Minnehaha",
      buses: feed.buses,
    });
  }

  const [rows, days] = await Promise.all([
    loadGpsTripReport({
      schoolId: access.schoolId,
      dayKey: input.dayKey,
    }),
    loadGpsArrivalDays(access.schoolId),
  ]);

  return {
    ok: true as const,
    dayKey: input.dayKey,
    rows: serializeTripRows(rows),
    days,
  };
}
