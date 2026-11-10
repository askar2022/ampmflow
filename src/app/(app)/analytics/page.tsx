import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { loadCoordinatorAnalytics } from "@/lib/analytics";
import { todayKey } from "@/lib/dates";
import {
  loadGpsArrivalDays,
  loadGpsTripReport,
  recordLiveGpsBuses,
} from "@/lib/gps-log";
import { fetchOneStepLiveBuses } from "@/lib/onestep-gps";
import { prisma } from "@/lib/prisma";
import { AnalyticsBoard } from "./AnalyticsBoard";

export default async function AnalyticsPage() {
  const session = await getSession();
  if (!session) return null;
  if (
    session.role !== "ADMINISTRATOR" &&
    session.role !== "COORDINATOR" &&
    session.role !== "FRONT_DESK"
  ) {
    redirect("/dashboard");
  }

  const school = await prisma.school.findUnique({
    where: { id: session.schoolId },
    select: { name: true },
  });
  const day = todayKey();
  const feed = await fetchOneStepLiveBuses(school?.name);
  const aimSchool = Boolean(school?.name && /aim/i.test(school.name));
  if (feed.live && aimSchool) {
    await recordLiveGpsBuses({
      schoolId: session.schoolId,
      company: "Minnehaha",
      buses: feed.buses,
    });
  }

  const [data, gpsRows, gpsDays] = await Promise.all([
    loadCoordinatorAnalytics(session.schoolId),
    loadGpsTripReport({ schoolId: session.schoolId, dayKey: day }),
    loadGpsArrivalDays(session.schoolId),
  ]);

  return (
    <AnalyticsBoard
      data={data}
      schoolName={school?.name || "School"}
      schoolId={session.schoolId}
      gpsDayKey={day}
      gpsDays={gpsDays}
      gpsRows={gpsRows.map((row) => ({
        ...row,
        firstPickupAt: row.firstPickupAt?.toISOString() || null,
        arrivedSchoolAt: row.arrivedSchoolAt?.toISOString() || null,
        leftSchoolAt: row.leftSchoolAt?.toISOString() || null,
        lastStopAt: row.lastStopAt?.toISOString() || null,
      }))}
    />
  );
}
