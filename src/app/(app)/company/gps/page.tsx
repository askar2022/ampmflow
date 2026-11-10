import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { loadCompanySchools } from "@/lib/company-access";
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

export default async function CompanyLiveGpsPage({
  searchParams,
}: {
  searchParams: Promise<{ school?: string }>;
}) {
  const session = await getSession();
  if (!session) return null;
  if (session.role !== "BUS_COMPANY") redirect("/gps");

  const { school: wanted } = await searchParams;
  const schools = await loadCompanySchools(session);
  const selected =
    schools.find((school) => school.id === wanted || school.slug === wanted) ||
    schools[0];

  if (!selected) {
    return (
      <div>
        <h1 className="font-serif text-4xl text-navy">Live GPS</h1>
        <p className="mt-2 text-muted">
          No school is assigned to this login yet.
        </p>
      </div>
    );
  }

  const [routes, feed] = await Promise.all([
    prisma.busRoute.findMany({
      where: { schoolId: selected.id },
      select: { number: true },
      orderBy: { number: "asc" },
    }),
    fetchOneStepLiveBuses(selected.name),
  ]);

  const aimSchool = /aim/i.test(selected.name);
  if (feed.live && aimSchool) {
    await recordLiveGpsBuses({
      schoolId: selected.id,
      company: "Minnehaha",
      buses: feed.buses,
    });
  }

  const day = todayKey();
  const [arrivals, arrivalDays] = await Promise.all([
    loadGpsArrivals({ schoolId: selected.id, dayKey: day }),
    loadGpsArrivalDays(selected.id),
  ]);

  return (
    <LiveGpsBoard
      schoolName={selected.name}
      schoolId={selected.id}
      busLabels={routes.map((route) => route.number)}
      audience="company"
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
