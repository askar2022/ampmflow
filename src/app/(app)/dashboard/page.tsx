import Link from "next/link";
import { getSession } from "@/lib/auth";
import { dashboardSummary, loadStudents, studentsOnBothLists } from "@/lib/transportation";
import { formatLongDate, schoolNow } from "@/lib/dates";
import { planSummary, planTone } from "@/lib/format";
import { StatusBadge } from "@/components/StatusBadge";

const tiles = [
  { href: "/buses", title: "Buses", copy: "Today’s riders grouped by bus number." },
  { href: "/pickup", title: "Parent Pickup", copy: "Students going home with a parent." },
  { href: "/changes", title: "Today’s Changes", copy: "The first list teachers should check." },
  { href: "/students", title: "Students", copy: "Search and update AM or PM plans." },
  { href: "/teachers", title: "Teacher Lists", copy: "Read-only classroom dismissal pages." },
  { href: "/company", title: "Bus Company Updates", copy: "Requests waiting for a route number." },
  { href: "/print", title: "Print / Email", copy: "Dated lists so staff never use yesterday’s copy." },
];

export default async function DashboardPage() {
  const session = await getSession();
  if (!session) return null;
  const students = await loadStudents(session.schoolId);
  const summary = dashboardSummary(students);
  const conflicts = studentsOnBothLists(students);
  const changes = students.filter(
    (s) =>
      s.pm.source === "TODAY" ||
      s.pm.source === "DATE_RANGE" ||
      s.am.source === "TODAY" ||
      s.am.source === "DATE_RANGE",
  );

  return (
    <div className="space-y-8">
      <div>
        <p className="text-sm text-muted">{formatLongDate(schoolNow())}</p>
        <h1 className="font-serif text-4xl">Coordinator dashboard</h1>
        <p className="mt-2 max-w-2xl text-muted">
          Every student has an AM plan and a PM plan. Temporary changes are layered
          on top of the permanent assignment and expire on their own.
        </p>
      </div>

      {conflicts.length ? (
        <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red">
          Safety warning: {conflicts.length} student
          {conflicts.length === 1 ? "" : "s"} currently appear on both the bus
          and parent-pickup lists. Review their PM plans before dismissal.
        </p>
      ) : null}

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted">
          Today’s transportation
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ["Bus riders", summary.busRiders, "/buses"],
            ["Parent pickup", summary.parentPickup, "/pickup"],
            ["Temporary changes", summary.temporaryChanges, "/changes"],
            ["Missing assignments", summary.missingAssignments, "/print?kind=missing"],
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

      <section className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
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
        <div className="flex items-center justify-between gap-4">
          <h2 className="font-serif text-2xl">Today’s Changes</h2>
          <Link href="/changes" className="text-sm font-semibold text-blue">
            Open full list
          </Link>
        </div>
        <p className="mt-1 text-sm text-muted">
          Teachers need this information before dismissal. Tomorrow these students
          return to their permanent plan unless another date range still applies.
        </p>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-muted">
              <tr>
                <th className="py-2">Student</th>
                <th>AM plan</th>
                <th>PM plan</th>
                <th>Teacher</th>
              </tr>
            </thead>
            <tbody>
              {changes.slice(0, 8).map((student) => (
                <tr key={student.id} className="border-t border-line">
                  <td className="py-2 font-medium">
                    <Link href={`/students/${student.id}`} className="hover:underline">
                      {student.fullName}
                    </Link>
                  </td>
                  <td>
                    <StatusBadge tone={planTone(student.am)}>
                      {planSummary(student.am, "AM")}
                    </StatusBadge>
                  </td>
                  <td>
                    <StatusBadge tone={planTone(student.pm)}>
                      {planSummary(student.pm, "PM")}
                    </StatusBadge>
                  </td>
                  <td>{student.teacherName}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
