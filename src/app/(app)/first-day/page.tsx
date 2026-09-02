import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { formatLongDate, schoolNow } from "@/lib/dates";
import { gateCounts, lastUpdatedStamp, loadGateRoster } from "@/lib/gate";
import { FirstDayDashboard } from "./FirstDayDashboard";

export const dynamic = "force-dynamic";

export default async function FirstDayPage() {
  const session = await getSession();
  if (
    !session ||
    (session.role !== "ADMINISTRATOR" &&
      session.role !== "COORDINATOR" &&
      session.role !== "FRONT_DESK")
  ) {
    redirect("/dashboard");
  }

  const students = await loadGateRoster(session.schoolId);
  const counts = gateCounts(students);

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-muted">{formatLongDate(schoolNow())}</p>
        <h1 className="font-serif text-4xl">First-day leadership dashboard</h1>
        <p className="mt-2 max-w-3xl text-muted">
          Counts come from the same master list used at The Gate. Transportation
          cards show both students and unique families.
        </p>
      </div>
      <FirstDayDashboard
        counts={counts}
        lastUpdated={lastUpdatedStamp(students)}
      />
    </div>
  );
}
