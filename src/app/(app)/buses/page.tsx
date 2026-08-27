import Link from "next/link";
import { getSession } from "@/lib/auth";
import { loadStudents } from "@/lib/transportation";
import { loadCompanyApprovedBuses } from "@/lib/operations";
import { groupByBus } from "@/lib/reports";
import { planSummary, rosterChangeLabel } from "@/lib/format";

export default async function BusesPage() {
  const session = await getSession();
  if (!session) return null;
  const students = await loadStudents(session.schoolId);
  const groups = groupByBus(students, "PM");
  const companyApproved = await loadCompanyApprovedBuses(session.schoolId);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-4xl">Buses</h1>
        <p className="mt-1 max-w-2xl text-muted">
          Today’s school roster by bus — the same names as Bus Check-In, without
          the On Bus / Missing buttons. A red line is a today change. Show it
          to the driver if they did not print a new company roster.
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {groups.map(([number, riders]) => (
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
                      change
                        ? "row-red border-red border-l-4"
                        : "border-line"
                    }`}
                  >
                    <div className="flex justify-between gap-3">
                      <Link href={`/students/${student.id}`} className="font-semibold hover:underline">
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
    </div>
  );
}
