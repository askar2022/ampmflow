import { getSession } from "@/lib/auth";
import { leadershipStats } from "@/lib/operations";

export default async function LeadershipPage() {
  const session = await getSession();
  if (!session) return null;
  const stats = await leadershipStats(session.schoolId);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-serif text-4xl">Leadership dashboard</h1>
        <p className="mt-2 max-w-2xl text-muted">
          This view shows the workload behind transportation: how many changes
          staff manage, when parents submit them, and where policy may need to be
          clearer. Reporting period for the weekly email is Monday through Friday
          at 12:00 PM.
        </p>
      </div>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ["Enrolled students", stats.students.length],
          ["Bus riders", stats.summary.busRiders],
          ["Parent pickup", stats.summary.parentPickup],
          ["Awaiting assignment", stats.waiting.length],
          ["Changes today", stats.events.length],
          ["Changes this week", stats.weekEvents.length],
          ["Late changes this week", stats.lateCount],
          ["Teacher acknowledgment rate", `${stats.ackRate}%`],
        ].map(([label, value]) => (
          <div key={String(label)} className="rounded-2xl border border-line bg-card p-5">
            <div className="text-sm text-muted">{label}</div>
            <div className="mt-2 font-serif text-3xl">{value}</div>
          </div>
        ))}
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
          This week, {stats.weekEvents.length} transportation changes were
          submitted. {stats.lateCount} were received after 2:15 PM
          {stats.repeated.length
            ? `, and ${stats.repeated.length} student(s) had multiple changes.`
            : "."}
        </p>
      </section>
    </div>
  );
}
