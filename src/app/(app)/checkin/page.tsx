import { getSession } from "@/lib/auth";
import { loadCheckIns, loadCompanyApprovedBuses } from "@/lib/operations";
import { rosterChangeLabel } from "@/lib/format";
import { LiveRefresh } from "@/components/LiveRefresh";
import { CheckInExplorer } from "./CheckInExplorer";

export default async function CheckInPage({
  searchParams,
}: {
  searchParams: Promise<{ bus?: string }>;
}) {
  const session = await getSession();
  if (!session) return null;
  const { bus } = await searchParams;
  const initialBus = session.assignedBus || bus || "";
  const companyApproved = await loadCompanyApprovedBuses(session.schoolId);
  const rows = await loadCheckIns(session.schoolId);

  const changeNotes = Object.fromEntries(
    rows.flatMap(({ student }) => {
      const note = rosterChangeLabel(student, companyApproved.get(student.id));
      return note ? [[student.id, note]] : [];
    }),
  );

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div>
        <h1 className="font-serif text-3xl">Bus roster check-in</h1>
        <p className="mt-1 text-sm text-muted">
          Search a name or tap one bus. On Bus, Missing, Not assigned, and Left
          school save right away. Leadership can open today’s check-in to see
          how many rode Bus 5 or were missing on Bus 4. Left school also
          reports the bus company to remove that house. Marks reset tomorrow.
        </p>
        <LiveRefresh />
        {session.role === "ADMINISTRATOR" || session.role === "COORDINATOR" ? (
          <p className="mt-2 text-sm">
            <a href="/leadership" className="font-semibold text-blue">
              Open today’s counts for leadership
            </a>
            {" · "}
            <a href="/print?kind=checkin" className="font-semibold text-blue">
              Print / share
            </a>
            {" · "}
            <a href="/print/export?kind=checkin" className="font-semibold text-blue">
              Download Excel
            </a>
          </p>
        ) : null}
      </div>
      <CheckInExplorer
        rows={rows}
        changeNotes={changeNotes}
        initialBus={initialBus}
      />
    </div>
  );
}
