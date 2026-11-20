import { after } from "next/server";
import { getSession } from "@/lib/auth";
import { LiveGpsBoard } from "@/components/LiveGpsBoard";
import { todayKey } from "@/lib/dates";
import {
  formatGpsStamp,
  loadGpsArrivalDays,
  loadGpsArrivals,
  recordLiveGpsBuses,
} from "@/lib/gps-log";
import { fetchOneStepLiveBuses } from "@/lib/onestep-gps";
import { prisma } from "@/lib/prisma";

export default async function LiveGpsPage() {
  const session = await getSession();
  if (!session) return null;

  const day = todayKey();
  const [school, routes, arrivals, arrivalDays] = await Promise.all([
    prisma.school.findUnique({
      where: { id: session.schoolId },
      select: { name: true },
    }),
    prisma.busRoute.findMany({
      where: { schoolId: session.schoolId },
      select: { number: true },
      orderBy: { number: "asc" },
    }),
    loadGpsArrivals({ schoolId: session.schoolId, dayKey: day }),
    loadGpsArrivalDays(session.schoolId),
  ]);

  const feed = await fetchOneStepLiveBuses(school?.name).catch(() => ({
    configured: false,
    live: false,
    school: null,
    buses: [] as Awaited<ReturnType<typeof fetchOneStepLiveBuses>>["buses"],
    fetchedAt: new Date().toISOString(),
    error: "Live GPS unavailable right now.",
  }));

  const aimSchool = Boolean(school?.name && /aim/i.test(school.name));
  if (feed.live && aimSchool) {
    after(() =>
      recordLiveGpsBuses({
        schoolId: session.schoolId,
        company: "Minnehaha",
        buses: feed.buses,
      }).catch(() => undefined),
    );
  }

  return (
    <LiveGpsBoard
      schoolName={school?.name || "School"}
      schoolId={session.schoolId}
      busLabels={routes.map((route) => route.number)}
      audience="school"
      initialFeed={feed}
      initialStamp={formatGpsStamp()}
      initialDayKey={day}
      initialArrivals={arrivals.map((row) => ({
        ...row,
        recordedAt: row.recordedAt.toISOString(),
        stamp: formatGpsStamp(row.recordedAt),
      }))}
      initialArrivalDays={arrivalDays}
    />
  );
}
