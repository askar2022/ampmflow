import { getSession } from "@/lib/auth";
import { eventPlanLabel, loadChangeEvents } from "@/lib/operations";
import { lateLabel } from "@/lib/policy";

export default async function ActivityPage() {
  const session = await getSession();
  if (!session) return null;
  const events = await loadChangeEvents(session.schoolId);

  return (
    <div className="space-y-4">
      <h1 className="font-serif text-4xl">Today’s Activity</h1>
      <p className="text-muted">
        Every parent request is stamped with who recorded it and the exact time.
        After 2:15 PM the row is Late/Emergency. After 2:45 PM the teacher must
        acknowledge it.
      </p>
      <div className="overflow-hidden rounded-2xl border border-line bg-card">
        <table className="w-full text-left text-sm">
          <thead className="bg-paper text-muted">
            <tr>
              <th className="px-4 py-3">Time</th>
              <th>Student</th>
              <th>Previous plan</th>
              <th>New plan</th>
              <th>Updated by</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {events.map((event) => (
              <tr
                key={event.id}
                className={`border-t border-line ${event.urgent ? "row-orange" : ""}`}
              >
                <td className="px-4 py-3 whitespace-nowrap">
                  {event.createdAt.toLocaleTimeString("en-US", {
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                </td>
                <td className="font-medium">
                  {event.student.firstName} {event.student.lastName}
                </td>
                <td>{eventPlanLabel(event.previousPlan)}</td>
                <td>{eventPlanLabel(event.newPlan)}</td>
                <td>{event.createdBy.name}</td>
                <td>
                  {lateLabel(event.late, event.urgent)}
                  {event.waitingForRoute ? " · Waiting for route" : ""}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
