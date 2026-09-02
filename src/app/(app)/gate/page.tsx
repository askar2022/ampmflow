import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { formatLongDate, schoolNow } from "@/lib/dates";
import {
  ensureGateTables,
  lastUpdatedStamp,
  loadGateRoster,
  loadImportSummary,
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
  const [students, importSummary] = await Promise.all([
    loadGateRoster(session.schoolId),
    loadImportSummary(session.schoolId),
  ]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <p className="text-xs text-muted">{formatLongDate(schoolNow())}</p>
          <h1 className="font-serif text-3xl">
            The Gate: AM Arrival and PM Dismissal
          </h1>
        </div>
        <div className="no-print">
          <LiveRefresh seconds={8} />
        </div>
      </div>
      <GateBoard
        students={students}
        lastUpdated={lastUpdatedStamp(students)}
        importSummary={importSummary}
      />
    </div>
  );
}
