import Link from "next/link";
import { getSession } from "@/lib/auth";
import { formatLongDate, schoolNow } from "@/lib/dates";
import { planSummary } from "@/lib/format";
import { loadRidership } from "@/lib/ridership";
import { BusesToolbar } from "./BusesToolbar";

export const dynamic = "force-dynamic";

export default async function BusesPage() {
  const session = await getSession();
  if (!session) return null;

  const list = await loadRidership(session.schoolId);

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-muted">{formatLongDate(schoolNow())}</p>
        <h1 className="font-serif text-4xl">Buses-Vans</h1>
        <p className="mt-1 max-w-2xl text-muted">
          Students who ride each bus or van today — not parent pickup. Print a
          list and give it to the driver if they did not get the email from the
          bus company.
        </p>
        <p className="mt-2 text-sm font-semibold text-navy">
          {list.busRiders} on buses
          {list.vanRiders ? ` · ${list.vanRiders} on vans` : ""}
        </p>
        <BusesToolbar />
      </div>

      {list.buses.length ? (
        <div className="grid gap-4 md:grid-cols-2">
          {list.buses.map(([number, riders]) => (
            <section
              key={number}
              className="print-sheet rounded-2xl border border-line bg-card p-5"
            >
              <div className="flex items-baseline justify-between gap-3">
                <h2 className="font-serif text-2xl">Bus {number}</h2>
                <span className="text-sm text-muted">
                  {riders.length} student{riders.length === 1 ? "" : "s"}
                </span>
              </div>
              <Link
                href={`/buses/print?bus=${encodeURIComponent(number)}`}
                className="no-print mt-2 inline-block text-sm font-semibold text-navy"
              >
                Print for driver
              </Link>
              <ul className="mt-3 space-y-2 text-sm">
                {riders.map((student) => (
                  <li
                    key={student.id}
                    className="rounded-xl border border-line px-3 py-2"
                  >
                    <div className="flex justify-between gap-3">
                      <Link
                        href={`/dashboard?student=${student.id}`}
                        className="font-semibold hover:underline"
                      >
                        {student.fullName}
                      </Link>
                      <span className="text-muted">
                        {planSummary(student.pm, "PM")}
                      </span>
                    </div>
                    <p className="mt-1 text-muted">
                      {student.studentId} · Grade {student.grade} ·{" "}
                      {student.teacherName}
                    </p>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      ) : null}

      {list.vans.length ? (
        <div className="space-y-3">
          <h2 className="font-serif text-2xl">Special vans</h2>
          <div className="grid gap-4 md:grid-cols-2">
            {list.vans.map((van) => (
              <section
                key={van.id}
                className="print-sheet rounded-2xl border border-line bg-card p-5"
              >
                <div className="flex items-baseline justify-between gap-3">
                  <h2 className="font-serif text-2xl">{van.name}</h2>
                  <span className="text-sm text-muted">
                    {van.riders.length} student
                    {van.riders.length === 1 ? "" : "s"}
                  </span>
                </div>
                {van.driverName ? (
                  <p className="mt-1 text-sm text-muted">{van.driverName}</p>
                ) : null}
                <Link
                  href={`/buses/print?van=${van.id}`}
                  className="no-print mt-2 inline-block text-sm font-semibold text-navy"
                >
                  Print for driver
                </Link>
                <ul className="mt-3 space-y-2 text-sm">
                  {van.riders.map((student) => (
                    <li
                      key={student.id}
                      className="rounded-xl border border-line px-3 py-2"
                    >
                      <Link
                        href={`/dashboard?student=${student.id}`}
                        className="font-semibold hover:underline"
                      >
                        {student.name}
                      </Link>
                      <p className="mt-1 text-muted">Grade {student.grade}</p>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        </div>
      ) : null}

      {!list.buses.length && !list.vans.length ? (
        <p className="rounded-2xl border border-line bg-card px-4 py-6 text-sm text-muted">
          No bus or van students yet. Save a bus number on Front Desk and the
          student will show here. Parent pickup stays off this list.
        </p>
      ) : null}
    </div>
  );
}
