import { getSession } from "@/lib/auth";
import {
  activityDisplayRows,
  eventPlanLabel,
  loadChangeEvents,
} from "@/lib/operations";
import { formatTime } from "@/lib/dates";
import {
  deadlineClockLabel,
  isAfterDeadline,
  isAfterSnapshot,
  lateLabel,
  snapshotClockLabel,
} from "@/lib/policy";

export default async function ActivityPage() {
  const session = await getSession();
  if (!session) return null;
  const events = activityDisplayRows(await loadChangeEvents(session.schoolId));

  return (
    <div className="space-y-4">
      <h1 className="font-serif text-4xl">Today’s Activity</h1>
      <p className="text-muted">
        Each real change is listed once in Minnesota time. If AM and PM both
        changed the same way, that is one row. After {deadlineClockLabel()} the
        row is Late/Emergency. After the {snapshotClockLabel()} email the
        teacher must acknowledge it.
      </p>
      <div className="overflow-hidden rounded-2xl border border-line bg-card">
        <table className="w-full text-left text-sm">
          <thead className="bg-paper text-muted">
            <tr>
              <th className="px-4 py-3">Time</th>
              <th>Student</th>
              <th>Trip</th>
              <th>Previous plan</th>
              <th>New plan</th>
              <th>Updated by</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {events.map(({ event, trips }) => {
              const late = isAfterDeadline(event.createdAt);
              const urgent = isAfterSnapshot(event.createdAt);
              return (
                <tr
                  key={event.id}
                  className={`border-t border-line ${urgent ? "row-orange" : ""}`}
                >
                  <td className="px-4 py-3 whitespace-nowrap">
                    {formatTime(event.createdAt)}
                  </td>
                  <td className="font-medium">
                    {event.student.firstName} {event.student.lastName}
                  </td>
                  <td>
                    {trips.slice().sort().join(" · ")}
                  </td>
                  <td>{eventPlanLabel(event.previousPlan)}</td>
                  <td>{eventPlanLabel(event.newPlan)}</td>
                  <td>{event.createdBy.name}</td>
                  <td>
                    {lateLabel(late, urgent)}
                    {event.waitingForRoute ? " · Waiting for route" : ""}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
