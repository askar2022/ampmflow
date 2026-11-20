import { after } from "next/server";
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

  const day = todayKey();
  const [school, data, gpsRows, gpsDays] = await Promise.all([
    prisma.school.findUnique({
      where: { id: session.schoolId },
      select: { name: true },
    }),
    loadCoordinatorAnalytics(session.schoolId),
    loadGpsTripReport({ schoolId: session.schoolId, dayKey: day }),
    loadGpsArrivalDays(session.schoolId),
  ]);

  const aimSchool = Boolean(school?.name && /aim/i.test(school.name));
  // GPS snapshot is optional for Analytics — never block the page on OneStep.
  if (aimSchool) {
    after(() =>
      fetchOneStepLiveBuses(school?.name)
        .then((feed) => {
          if (!feed.live) return;
          return recordLiveGpsBuses({
            schoolId: session.schoolId,
            company: "Minnehaha",
            buses: feed.buses,
          });
        })
        .catch(() => undefined),
    );
  }

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
