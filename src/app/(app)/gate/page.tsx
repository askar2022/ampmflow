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
    <div className="gate-wrap">
      <div className="gate-titlebar">
        <h1>
          The Gate: AM Arrival and PM Dismissal
          <span> · {formatLongDate(schoolNow())}</span>
        </h1>
        <div className="no-print">
          <LiveRefresh seconds={8} compact />
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
