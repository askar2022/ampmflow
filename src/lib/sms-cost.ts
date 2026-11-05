import { prisma } from "./prisma";

/** Charged to the bus company for each late-alert parent text. */
export const SMS_COST_CENTS = 8;

export type SmsRideUsage = {
  rideLabel: string;
  weekCount: number;
  monthCount: number;
};

export type SmsCostReport = {
  centsEach: number;
  weekCount: number;
  monthCount: number;
  weekCents: number;
  monthCents: number;
  rides: SmsRideUsage[];
};

function chicagoDateKey(date: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Chicago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function chicagoWeekday(date: Date) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago",
    weekday: "short",
  }).format(date);
}

/** YYYY-MM-DD for Monday of the current Chicago week. */
export function chicagoWeekStartKey(now = new Date()) {
  const weekdayIndex: Record<string, number> = {
    Mon: 0,
    Tue: 1,
    Wed: 2,
    Thu: 3,
    Fri: 4,
    Sat: 5,
    Sun: 6,
  };
  const offset = weekdayIndex[chicagoWeekday(now)] ?? 0;
  const probe = new Date(now.getTime() - offset * 24 * 60 * 60 * 1000);
  return chicagoDateKey(probe);
}

/** YYYY-MM-01 for the current Chicago month. */
export function chicagoMonthStartKey(now = new Date()) {
  return `${chicagoDateKey(now).slice(0, 8)}01`;
}

export function formatSmsMoney(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

function parseAlertPlan(raw: string): {
  rideLabel: string;
  smsCount: number;
  schoolId?: string;
} | null {
  try {
    const plan = JSON.parse(raw || "{}") as {
      ride?: string;
      schoolId?: string;
      smsCount?: number;
      sent?: string[];
      familyCount?: number;
    };
    const rideLabel = String(plan.ride || "").trim();
    if (!rideLabel) return null;
    const fromSent = Array.isArray(plan.sent) ? plan.sent.length : 0;
    const smsCount = Math.max(
      0,
      Number(plan.smsCount) || fromSent || Number(plan.familyCount) || 0,
    );
    if (!smsCount) return null;
    return {
      rideLabel,
      smsCount,
      schoolId: plan.schoolId ? String(plan.schoolId) : undefined,
    };
  } catch {
    return null;
  }
}

export async function loadCompanySmsCostReport(args: {
  actorId: string;
  schoolIds: string[];
  schoolId?: string;
}): Promise<SmsCostReport> {
  const empty: SmsCostReport = {
    centsEach: SMS_COST_CENTS,
    weekCount: 0,
    monthCount: 0,
    weekCents: 0,
    monthCents: 0,
    rides: [],
  };
  if (!args.schoolIds.length) return empty;

  const monthKey = chicagoMonthStartKey();
  const weekKey = chicagoWeekStartKey();
  // Pull from a few days before month start so timezone edges are covered.
  const since = new Date(`${monthKey}T00:00:00.000-06:00`);
  since.setUTCDate(since.getUTCDate() - 2);

  const logs = await prisma.auditLog.findMany({
    where: {
      action: "LATE_BUS_ALERT",
      actorId: args.actorId,
      createdAt: { gte: since },
    },
    select: { createdAt: true, newPlan: true, schoolId: true },
    orderBy: { createdAt: "desc" },
    take: 2000,
  });

  const wanted = args.schoolId
    ? new Set([args.schoolId])
    : new Set(args.schoolIds);
  const byRide = new Map<string, SmsRideUsage>();

  for (const log of logs) {
    const parsed = parseAlertPlan(log.newPlan);
    if (!parsed) continue;
    const schoolId = parsed.schoolId || log.schoolId;
    if (!wanted.has(schoolId)) continue;

    const dayKey = chicagoDateKey(log.createdAt);
    if (dayKey < monthKey) continue;

    const ride =
      byRide.get(parsed.rideLabel) ||
      ({
        rideLabel: parsed.rideLabel,
        weekCount: 0,
        monthCount: 0,
      } satisfies SmsRideUsage);
    ride.monthCount += parsed.smsCount;
    if (dayKey >= weekKey) {
      ride.weekCount += parsed.smsCount;
    }
    byRide.set(parsed.rideLabel, ride);
  }

  const rides = [...byRide.values()].sort((a, b) =>
    a.rideLabel.localeCompare(b.rideLabel, undefined, { numeric: true }),
  );
  const weekCount = rides.reduce((sum, ride) => sum + ride.weekCount, 0);
  const monthCount = rides.reduce((sum, ride) => sum + ride.monthCount, 0);

  return {
    centsEach: SMS_COST_CENTS,
    weekCount,
    monthCount,
    weekCents: weekCount * SMS_COST_CENTS,
    monthCents: monthCount * SMS_COST_CENTS,
    rides,
  };
}
