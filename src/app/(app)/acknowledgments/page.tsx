import { getSession } from "@/lib/auth";
import { eventPlanLabel, loadChangeEvents } from "@/lib/operations";
import { formatDateTime } from "@/lib/dates";

export default async function AcknowledgmentsPage() {
  const session = await getSession();
  if (!session) return null;
  const events = (await loadChangeEvents(session.schoolId)).filter(
    (event) => event.acknowledgments.length,
  );

  return (
    <div className="space-y-4">
      <h1 className="font-serif text-4xl">Teacher Acknowledgments</h1>
      <p className="text-muted">
        Last-minute changes stay open until the teacher presses Acknowledged.
        That is the school’s evidence the update was received.
      </p>
      <div className="space-y-3">
        {events.map((event) => {
          const open = event.acknowledgments.filter((a) => !a.acknowledgedAt);
          return (
            <article
              key={event.id}
              className={`rounded-2xl border p-5 ${
                open.length ? "border-orange-400 bg-orange-50" : "border-line bg-card"
              }`}
            >
              <div className="flex flex-wrap justify-between gap-2">
                <strong>
                  {event.student.firstName} {event.student.lastName}
                </strong>
                {open.length ? (
                  <span className="font-semibold text-orange-900">
                    ⚠️ Last-minute change not yet acknowledged
                  </span>
                ) : (
                  <span className="text-green">Acknowledged</span>
                )}
              </div>
              <p className="mt-1 text-sm">
                Changed at{" "}
                {event.createdAt.toLocaleTimeString("en-US", {
                  hour: "numeric",
                  minute: "2-digit",
                })}{" "}
                by {event.createdBy.name}: {eventPlanLabel(event.previousPlan)} →{" "}
                {eventPlanLabel(event.newPlan)}
              </p>
              <ul className="mt-2 text-sm text-muted">
                {event.acknowledgments.map((ack) => (
                  <li key={ack.id}>
                    {ack.user.name}:{" "}
                    {ack.acknowledgedAt
                      ? formatDateTime(ack.acknowledgedAt)
                      : "waiting"}
                  </li>
                ))}
              </ul>
            </article>
          );
        })}
      </div>
    </div>
  );
}
