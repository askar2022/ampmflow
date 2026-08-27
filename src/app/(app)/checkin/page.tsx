import { getSession } from "@/lib/auth";
import { loadCheckIns, loadCompanyApprovedBuses } from "@/lib/operations";
import { rosterChangeLabel } from "@/lib/format";
import { LiveRefresh } from "@/components/LiveRefresh";
import { CheckInBoard } from "./CheckInBoard";

export default async function CheckInPage({
  searchParams,
}: {
  searchParams: Promise<{ bus?: string }>;
}) {
  const session = await getSession();
  if (!session) return null;
  const { bus } = await searchParams;
  const onlyBus = session.assignedBus || bus || "";
  const rows = onlyBus
    ? await loadCheckIns(session.schoolId, onlyBus)
    : await loadCheckIns(session.schoolId);
  const companyApproved = await loadCompanyApprovedBuses(session.schoolId);
  const changeNotes = Object.fromEntries(
    rows
      .map(({ student }) => {
        const note = rosterChangeLabel(student, companyApproved.get(student.id));
        return note ? [student.id, note] : null;
      })
      .filter((row): row is [string, string] => Boolean(row)),
  );

  const byBus = new Map<string, typeof rows>();
  for (const row of rows) {
    const number = row.student.pm.busNumber || "Unassigned";
    const list = byBus.get(number) ?? [];
    list.push(row);
    byBus.set(number, list);
  }
  const groups = [...byBus.entries()].sort(
    ([a], [b]) => Number(a) - Number(b) || a.localeCompare(b),
  );

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div>
        <h1 className="font-serif text-3xl">Bus roster check-in</h1>
        <p className="mt-1 text-sm text-muted">
          Same students as the Buses list. The only difference is you can tap
          On Bus, Missing, or Not assigned. A red line is a today change — show
          it to the driver if they do not have the new company roster. Marks
          reset tomorrow.
        </p>
        <LiveRefresh />
      </div>
      {groups.length === 0 ? (
        <p className="rounded-2xl border border-line bg-card p-5 text-sm text-muted">
          No bus riders on today’s school list yet.
        </p>
      ) : null}
      {groups.map(([number, groupRows]) => (
        <CheckInBoard
          key={number}
          title={`Bus ${number}`}
          rows={groupRows}
          changeNotes={changeNotes}
        />
      ))}
    </div>
  );
}
