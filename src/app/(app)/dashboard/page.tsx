import Link from "next/link";
import { getSession } from "@/lib/auth";
import { dashboardSummary, loadStudents, studentsOnBothLists } from "@/lib/transportation";
import {
  loadChangeEvents,
  unacknowledgedUrgent,
  uniqueStudentCount,
} from "@/lib/operations";
import { formatLongDate, schoolNow } from "@/lib/dates";
import {
  deadlineClockLabel,
  snapshotClockLabel,
} from "@/lib/policy";
import { eventPlanLabel } from "@/lib/operations";

const tiles = [
  { href: "/changes", title: "Today’s Changes", copy: "Live exceptions teachers must see first." },
  { href: "/buses", title: "Buses", copy: "Full printable roster. Red line = changed today." },
  { href: "/pickup", title: "Parent Pickup", copy: "Students going home with a parent." },
  { href: "/waiting", title: "Waiting for Route", copy: "New address or daycare — not final until assigned." },
  { href: "/acknowledgments", title: "Teacher Acknowledgments", copy: "Evidence the teacher saw a last-minute change." },
  { href: "/checkin", title: "Bus Check-In", copy: "Tap On Bus, Missing, or Left school. Leadership keeps the daily count." },
  { href: "/students", title: "Students", copy: "Search and record a parent request." },
  { href: "/print", title: "Reports", copy: "Daily snapshot, print, and weekly leadership report." },
];

export default async function DashboardPage() {
  const session = await getSession();
  if (!session) return null;
  const students = await loadStudents(session.schoolId);
  const summary = dashboardSummary(students);
  const conflicts = studentsOnBothLists(students);
  const events = await loadChangeEvents(session.schoolId);
  const urgentOpen = await unacknowledgedUrgent(session.schoolId);
  const waiting = students.filter(
    (s) => s.am.waitingForAssignment || s.pm.waitingForAssignment,
  ).length;
  const snapshot = snapshotClockLabel();
  const deadline = deadlineClockLabel();

  return (
    <div className="space-y-8">
      <div>
        <p className="text-sm text-muted">{formatLongDate(schoolNow())}</p>
        <h1 className="font-serif text-4xl">
          {session.role === "FRONT_DESK" ? "Reception desk" : "Live dismissal board"}
        </h1>
        <p className="mt-2 max-w-2xl text-muted">
          The {snapshot} email is a snapshot
          {snapshot === "11:45 AM" ? " — Friday school closes at 12" : ""}.
          This board stays live because a parent can still call after that.
          Normal cutoff is {deadline}; later requests are labeled Late/Emergency.
        </p>
      </div>

      {urgentOpen.length ? (
        <p className="rounded-xl bg-orange-50 px-4 py-3 text-sm font-semibold text-orange-900">
          ⚠️ Last-minute change not yet acknowledged ({urgentOpen.length})
        </p>
      ) : null}

      {conflicts.length ? (
        <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red">
          Safety warning: {conflicts.length} student(s) appear on both the bus and
          parent-pickup lists.
        </p>
      ) : null}

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted">
          Today
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {[
            ["Bus students", summary.busRiders, "/buses"],
            ["Parent pickup", summary.parentPickup, "/pickup"],
            [
              "Students changed today",
              uniqueStudentCount(events) || summary.temporaryChanges,
              "/activity",
            ],
            ["Waiting for bus assignment", waiting, "/waiting"],
            ["Unacknowledged urgent changes", urgentOpen.length, "/acknowledgments"],
          ].map(([label, count, href]) => (
            <Link
              key={String(label)}
              href={String(href)}
              className="rounded-2xl border border-line bg-card p-5 shadow-sm hover:border-gold"
            >
              <div className="text-sm text-muted">{label}</div>
              <div className="mt-2 font-serif text-4xl">{count}</div>
            </Link>
          ))}
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
        {tiles.map((tile) => (
          <Link
            key={tile.href}
            href={tile.href}
            className={`rounded-2xl border bg-card p-5 shadow-sm hover:border-gold ${
              tile.title === "Today’s Changes" ? "border-gold" : "border-line"
            }`}
          >
            <h3 className="font-serif text-xl">{tile.title}</h3>
            <p className="mt-1 text-sm text-muted">{tile.copy}</p>
          </Link>
        ))}
      </section>

      <section className="rounded-2xl border border-line bg-card p-6">
        <div className="flex items-center justify-between">
          <h2 className="font-serif text-2xl">Today’s Activity</h2>
          <Link href="/activity" className="text-sm font-semibold text-blue">
            Full log
          </Link>
        </div>
        <table className="mt-4 w-full text-left text-sm">
          <thead className="text-muted">
            <tr>
              <th className="py-2">Time</th>
              <th>Student</th>
              <th>Previous plan</th>
              <th>New plan</th>
              <th>Updated by</th>
            </tr>
          </thead>
          <tbody>
            {events.slice(0, 8).map((event) => (
              <tr key={event.id} className="border-t border-line">
                <td className="py-2 whitespace-nowrap">
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
              </tr>
            ))}
          </tbody>
        </table>
        {!events.length ? (
          <p className="mt-3 text-sm text-muted">
            No recorded activity yet. Run the live-ops SQL if this table is empty
            after a change.
          </p>
        ) : null}
      </section>
    </div>
  );
}
