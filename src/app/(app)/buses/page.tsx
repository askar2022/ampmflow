import Link from "next/link";
import { getSession } from "@/lib/auth";
import { formatLongDate, schoolNow } from "@/lib/dates";
import { groupConfirmedBus, loadGateRoster, PM_LABEL } from "@/lib/gate";
import { loadCompanyApprovedBuses } from "@/lib/operations";
import { groupByBus } from "@/lib/reports";
import { loadStudents } from "@/lib/transportation";
import { planSummary, rosterChangeLabel } from "@/lib/format";
import { StatusBadge } from "@/components/StatusBadge";

export const dynamic = "force-dynamic";

export default async function BusesPage() {
  const session = await getSession();
  if (!session) return null;

  const roster = await loadGateRoster(session.schoolId);
  const gateGroups = groupConfirmedBus(roster);
  const students = gateGroups.length ? [] : await loadStudents(session.schoolId);
  const oldGroups = gateGroups.length ? [] : groupByBus(students, "PM");
  const companyApproved = oldGroups.length
    ? await loadCompanyApprovedBuses(session.schoolId)
    : new Map<string, string>();

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-muted">{formatLongDate(schoolNow())}</p>
        <h1 className="font-serif text-4xl">Buses</h1>
        <p className="mt-1 max-w-2xl text-muted">
          Only students marked Confirmed Bus ride a bus today. Parent pickup
          today is on Parent Pickup. New bus riders beginning tomorrow are on
          Bus Needed Tomorrow.
        </p>
        <div className="mt-3 flex flex-wrap gap-2 no-print">
          <a
            href="/print?kind=bus"
            className="rounded-xl border border-line bg-card px-4 py-2 text-sm font-semibold"
          >
            Print bus lists
          </a>
          <a
            href="/print/export?kind=bus"
            className="rounded-xl border border-line bg-card px-4 py-2 text-sm font-semibold"
          >
            Download Excel
          </a>
        </div>
      </div>

      {gateGroups.length ? (
        <div className="grid gap-4 md:grid-cols-2">
          {gateGroups.map(([name, riders]) => (
            <section key={name} className="rounded-2xl border border-line bg-card p-5 print-sheet">
              <div className="flex items-baseline justify-between gap-3">
                <h2 className="font-serif text-2xl">{name}</h2>
                <span className="text-sm text-muted">{riders.length} students</span>
              </div>
              <ul className="mt-3 space-y-2 text-sm">
                {riders.map((student) => (
                  <li key={student.id} className="rounded-xl border border-line px-3 py-2">
                    <div className="flex justify-between gap-3">
                      <Link
                        href={`/students/${student.id}`}
                        className="font-semibold hover:underline"
                      >
                        {student.fullName}
                      </Link>
                      <StatusBadge tone="green">{PM_LABEL[student.pmDismissal]}</StatusBadge>
                    </div>
                    <p className="mt-1 text-muted">
                      {student.grade} · {student.teacherName}
                    </p>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      ) : oldGroups.length ? (
        <div className="grid gap-4 md:grid-cols-2">
          {oldGroups.map(([number, riders]) => (
            <section key={number} className="rounded-2xl border border-line bg-card p-5">
              <div className="flex items-baseline justify-between gap-3">
                <h2 className="font-serif text-2xl">Bus {number}</h2>
                <span className="text-sm text-muted">{riders.length} students</span>
              </div>
              <Link
                href={`/checkin?bus=${number}`}
                className="mt-2 inline-block text-sm font-semibold text-blue"
              >
                Check in this bus
              </Link>
              <ul className="mt-3 space-y-2 text-sm">
                {riders.map((student) => {
                  const change = rosterChangeLabel(
                    student,
                    companyApproved.get(student.id),
                  );
                  return (
                    <li
                      key={student.id}
                      className={`rounded-xl border px-3 py-2 ${
                        change ? "row-red border-red border-l-4" : "border-line"
                      }`}
                    >
                      <div className="flex justify-between gap-3">
                        <Link
                          href={`/students/${student.id}`}
                          className="font-semibold hover:underline"
                        >
                          {student.fullName}
                        </Link>
                        <span className="text-muted">{planSummary(student.pm, "PM")}</span>
                      </div>
                      {change ? (
                        <p className="mt-1 text-xs font-medium text-red">{change}</p>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      ) : (
        <p className="rounded-2xl border border-line bg-card px-4 py-6 text-sm text-muted">
          No students are marked Confirmed Bus yet. Confirm a bus on{" "}
          <Link href="/gate" className="font-semibold text-blue">
            The Gate
          </Link>
          . Parent pickup today is on{" "}
          <Link href="/pickup" className="font-semibold text-blue">
            Parent Pickup
          </Link>
          . Tomorrow’s new bus riders are on{" "}
          <Link href="/bus-tomorrow" className="font-semibold text-blue">
            Bus Needed Tomorrow
          </Link>
          .
        </p>
      )}
    </div>
  );
}
