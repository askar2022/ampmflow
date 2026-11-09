import { getSession } from "@/lib/auth";
import { GpsReportBoard } from "@/components/GpsReportBoard";
import { todayKey } from "@/lib/dates";
import {
  loadGpsArrivalDays,
  loadGpsTripReport,
  recordLiveGpsBuses,
} from "@/lib/gps-log";
import { fetchOneStepLiveBuses } from "@/lib/onestep-gps";
import { prisma } from "@/lib/prisma";

export default async function GpsReportPage() {
  const session = await getSession();
  if (!session) return null;

  const school = await prisma.school.findUnique({
    where: { id: session.schoolId },
    select: { name: true },
  });
  const day = todayKey();

  const feed = await fetchOneStepLiveBuses(school?.name);
  if (feed.live) {
    await recordLiveGpsBuses({
      schoolId: session.schoolId,
      company: "Minnehaha",
      buses: feed.buses,
    });
  }

  const [rows, days] = await Promise.all([
    loadGpsTripReport({ schoolId: session.schoolId, dayKey: day }),
    loadGpsArrivalDays(session.schoolId),
  ]);

  return (
    <GpsReportBoard
      schoolName={school?.name || "School"}
      schoolId={session.schoolId}
      initialDayKey={day}
      initialDays={days}
      initialRows={rows.map((row) => ({
        ...row,
        firstPickupAt: row.firstPickupAt?.toISOString() || null,
        arrivedSchoolAt: row.arrivedSchoolAt?.toISOString() || null,
        leftSchoolAt: row.leftSchoolAt?.toISOString() || null,
        lastStopAt: row.lastStopAt?.toISOString() || null,
      }))}
    />
  );
}
