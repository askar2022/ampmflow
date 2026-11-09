import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { loadCompanySchools } from "@/lib/company-access";
import { GpsReportBoard } from "@/components/GpsReportBoard";
import { todayKey } from "@/lib/dates";
import { loadGpsArrivalDays, loadGpsTripReport } from "@/lib/gps-log";

export default async function CompanyGpsReportPage({
  searchParams,
}: {
  searchParams: Promise<{ school?: string }>;
}) {
  const session = await getSession();
  if (!session) return null;
  if (session.role !== "BUS_COMPANY") redirect("/gps-report");

  const { school: wanted } = await searchParams;
  const schools = await loadCompanySchools(session);
  const selected =
    schools.find((school) => school.id === wanted || school.slug === wanted) ||
    schools[0];

  if (!selected) {
    return (
      <div>
        <h1 className="font-serif text-4xl text-navy">GPS Report</h1>
        <p className="mt-2 text-muted">
          No school is assigned to this login yet.
        </p>
      </div>
    );
  }

  const day = todayKey();
  const [rows, days] = await Promise.all([
    loadGpsTripReport({ schoolId: selected.id, dayKey: day }),
    loadGpsArrivalDays(selected.id),
  ]);

  return (
    <GpsReportBoard
      schoolName={selected.name}
      schoolId={selected.id}
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
