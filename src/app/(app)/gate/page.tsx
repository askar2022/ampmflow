import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { formatLongDate, schoolNow } from "@/lib/dates";
import {
  ensureGateTables,
  lastUpdatedStamp,
  loadGateRoster,
} from "@/lib/gate";
import { LiveRefresh } from "@/components/LiveRefresh";
import { GateBoard } from "./GateBoard";

export const dynamic = "force-dynamic";

export default async function GatePage() {
  const session = await getSession();
  if (
    !session ||
    (session.role !== "ADMINISTRATOR" &&
      session.role !== "COORDINATOR" &&
      session.role !== "FRONT_DESK")
  ) {
    redirect("/dashboard");
  }

  await ensureGateTables();
  const students = await loadGateRoster(session.schoolId);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm text-muted">{formatLongDate(schoolNow())}</p>
          <h1 className="font-serif text-4xl">
            The Gate: AM Arrival and PM Dismissal
          </h1>
          <p className="mt-2 max-w-3xl text-muted">
            Search a student or parent, confirm the family, then set arrival and
            dismissal. Parent Pickup Today Only—Bus Needed Tomorrow is pickup
            today, not a bus ride today.
          </p>
        </div>
        <div className="no-print text-right">
          <LiveRefresh seconds={8} />
        </div>
      </div>
      <GateBoard students={students} lastUpdated={lastUpdatedStamp(students)} />
    </div>
  );
}
