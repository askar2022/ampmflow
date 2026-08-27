import { getSession } from "@/lib/auth";
import { leadershipStats, loadCheckInSummary } from "@/lib/operations";
import { checkInReportText } from "@/lib/reports";
import { CopyReport } from "@/components/CopyReport";

export default async function LeadershipPage() {
  const session = await getSession();
  if (!session) return null;
  const stats = await leadershipStats(session.schoolId);
  const checkIns = await loadCheckInSummary(session.schoolId);
  const checkInText = checkInReportText(checkIns);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-serif text-4xl">Leadership dashboard</h1>
        <p className="mt-2 max-w-2xl text-muted">
          This view shows the workload behind transportation. Each student
          counts once, even if the same change was saved many times. Reporting
          period for the weekly email is Monday through Friday at 12:00 PM.
        </p>
      </div>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ["Enrolled students", stats.students.length],
          ["Bus riders", stats.summary.busRiders],
          ["Parent pickup", stats.summary.parentPickup],
          ["Awaiting assignment", stats.waiting.length],
          ["Students changed today", stats.todayChangeStudents],
          ["Students changed this week", stats.weekChangeStudents],
          ["Late changes this week", stats.lateCount],
          ["Teacher acknowledgment rate", `${stats.ackRate}%`],
        ].map(([label, value]) => (
          <div key={String(label)} className="rounded-2xl border border-line bg-card p-5">
            <div className="text-sm text-muted">{label}</div>
            <div className="mt-2 font-serif text-3xl">{value}</div>
          </div>
        ))}
      </section>

      <section className="rounded-2xl border border-line bg-card p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-serif text-2xl">Today’s bus check-in</h2>
            <p className="mt-1 max-w-2xl text-sm text-muted">
              This is the daily record from Bus Check-In. Rode, Missing, Not
              assigned, and Left school are buttons staff already tapped. Not
              selected yet means nobody tapped a button for that student.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <CopyReport text={checkInText} />
            <a
              href="/print?kind=checkin"
              className="rounded-xl border border-line px-4 py-2 text-sm font-semibold"
            >
              Print / share
            </a>
            <a
              href="/print/export?kind=checkin"
              className="rounded-xl border border-line px-4 py-2 text-sm font-semibold"
            >
              Download Excel
            </a>
          </div>
        </div>
        {checkIns.length ? (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-muted">
                <tr>
                  <th className="py-2">Bus</th>
                  <th>On list</th>
                  <th>Rode</th>
                  <th>Missing</th>
                  <th>Not assigned</th>
                  <th>Left school</th>
                  <th>Not selected yet</th>
                </tr>
              </thead>
              <tbody>
                {checkIns.map((row) => (
                  <tr key={row.busNumber} className="border-t border-line align-top">
                    <td className="py-2 font-medium">
                      {row.busNumber === "No bus yet"
                        ? "Waiting"
                        : `Bus ${row.busNumber}`}
                    </td>
                    <td className="py-2">{row.onList}</td>
                    <td className="py-2">
                      {row.onBus}
                      {row.onBusNames.length ? (
                        <div className="text-xs text-muted">
                          {row.onBusNames.join(", ")}
                        </div>
                      ) : null}
                    </td>
                    <td className="py-2">
                      {row.missing}
                      {row.missingNames.length ? (
                        <div className="text-xs text-muted">
                          {row.missingNames.join(", ")}
                        </div>
                      ) : null}
                    </td>
                    <td className="py-2">
                      {row.unassigned}
                      {row.unassignedNames.length ? (
                        <div className="text-xs text-muted">
                          {row.unassignedNames.join(", ")}
                        </div>
                      ) : null}
                    </td>
                    <td className="py-2">
                      {row.leftSchool}
                      {row.leftSchoolNames.length ? (
                        <div className="text-xs text-muted">
                          {row.leftSchoolNames.join(", ")}
                        </div>
                      ) : null}
                    </td>
                    <td className="py-2">
                      {row.notMarked}
                      {row.notMarkedNames.length ? (
                        <div className="text-xs text-muted">
                          {row.notMarkedNames.join(", ")}
                        </div>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="mt-3 text-sm text-muted">
            No bus riders yet. Marks from Bus Check-In appear here the same day.
          </p>
        )}
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-line bg-card p-5">
          <h2 className="font-serif text-2xl">Transportation summary</h2>
          <table className="mt-3 w-full text-sm">
            <tbody>
              {stats.buses.map(([number, count]) => (
                <tr key={number} className="border-t border-line">
                  <td className="py-2">Bus {number}</td>
                  <td className="text-right font-medium">{count}</td>
                </tr>
              ))}
              <tr className="border-t border-line">
                <td className="py-2">Parent pickup</td>
                <td className="text-right font-medium">{stats.summary.parentPickup}</td>
              </tr>
              <tr className="border-t border-line">
                <td className="py-2">Awaiting assignment</td>
                <td className="text-right font-medium">{stats.waiting.length}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div className="rounded-2xl border border-line bg-card p-5">
          <h2 className="font-serif text-2xl">Five-day pattern</h2>
          <table className="mt-3 w-full text-left text-sm">
            <thead className="text-muted">
              <tr>
                <th className="py-2">Day</th>
                <th>Total</th>
                <th>Temporary</th>
                <th>Permanent</th>
                <th>Late</th>
              </tr>
            </thead>
            <tbody>
              {stats.days.map((day) => (
                <tr key={day.date} className="border-t border-line">
                  <td className="py-2">{day.day}</td>
                  <td>{day.total}</td>
                  <td>{day.temporary}</td>
                  <td>{day.permanent}</td>
                  <td>{day.late}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-2xl border border-line bg-card p-5">
        <h2 className="font-serif text-2xl">Repeated changes this week</h2>
        {stats.repeated.length ? (
          <ul className="mt-3 space-y-1 text-sm">
            {stats.repeated.map((row) => (
              <li key={row.name}>
                {row.name}: {row.count} changes
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-sm text-muted">No student has more than one change this week.</p>
        )}
        <p className="mt-4 text-sm text-muted">
          This week, {stats.weekChangeStudents} student
          {stats.weekChangeStudents === 1 ? "" : "s"} had a transportation
          change. {stats.lateCount}{" "}
          {stats.lateCount === 1 ? "was" : "were"} received after the daily cutoff
          {stats.repeated.length
            ? `, and ${stats.repeated.length} student(s) had more than one different change.`
            : "."}
        </p>
      </section>
    </div>
  );
}
