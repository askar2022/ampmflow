import Link from "next/link";
import { getSession } from "@/lib/auth";
import { formatLongDate, schoolNow } from "@/lib/dates";
import {
  PM_LABEL,
  loadGateRoster,
  parentPickupToday,
} from "@/lib/gate";
import { pickupList } from "@/lib/reports";
import { loadStudents } from "@/lib/transportation";
import { StatusBadge } from "@/components/StatusBadge";

export const dynamic = "force-dynamic";

export default async function PickupPage() {
  const session = await getSession();
  if (!session) return null;

  const roster = await loadGateRoster(session.schoolId);
  const gatePickup = parentPickupToday(roster);
  const fallback =
    gatePickup.length === 0
      ? pickupList(await loadStudents(session.schoolId), "PM")
      : [];
  const confirmed = gatePickup.filter(
    (student) => student.pmDismissal === "PARENT_PICKUP_CONFIRMED",
  );
  const todayOnly = gatePickup.filter(
    (student) => student.pmDismissal === "PARENT_PICKUP_TODAY_BUS_TOMORROW",
  );

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-muted">{formatLongDate(schoolNow())}</p>
        <h1 className="font-serif text-4xl">Parent Pickup</h1>
        <p className="mt-1 max-w-3xl text-muted">
          Students marked parent pickup today on The Gate: Parent
          Pickup—Confirmed and Parent Pickup Today Only—Bus Needed Tomorrow.
          These students do not ride a bus today.
        </p>
        <div className="mt-3 flex flex-wrap gap-2 no-print">
          <a
            href="/print?kind=pickup"
            className="rounded-xl border border-line bg-card px-4 py-2 text-sm font-semibold"
          >
            Print pickup list
          </a>
          <a
            href="/print/export?kind=pickup"
            className="rounded-xl border border-line bg-card px-4 py-2 text-sm font-semibold"
          >
            Download Excel
          </a>
        </div>
      </div>

      {gatePickup.length ? (
        <>
          <PickupTable
            title="Parent Pickup—Confirmed"
            count={confirmed.length}
            rows={confirmed}
            tone="blue"
          />
          <PickupTable
            title="Parent Pickup Today Only—Bus Needed Tomorrow"
            count={todayOnly.length}
            rows={todayOnly}
            tone="orange"
          />
        </>
      ) : fallback.length ? (
        <div className="overflow-hidden rounded-2xl border border-line bg-card">
          <table className="w-full text-left text-sm">
            <thead className="bg-paper text-muted">
              <tr>
                <th className="px-4 py-3">Student</th>
                <th>Teacher</th>
                <th>Parent</th>
                <th>Phone</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {fallback.map((student) => (
                <tr key={student.id} className="row-blue border-t border-line">
                  <td className="px-4 py-3 font-medium">
                    <Link href={`/students/${student.id}`} className="hover:underline">
                      {student.fullName}
                    </Link>
                  </td>
                  <td>{student.teacherName}</td>
                  <td>{student.parentName}</td>
                  <td>{student.parentPhone}</td>
                  <td>
                    <StatusBadge
                      tone={student.pm.source === "PERMANENT" ? "blue" : "yellow"}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="rounded-2xl border border-line bg-card px-4 py-6 text-sm text-muted">
          No students are marked parent pickup today. Confirm them on{" "}
          <Link href="/gate" className="font-semibold text-blue">
            The Gate
          </Link>{" "}
          or Dismissal by Grade/Class.
        </p>
      )}
    </div>
  );
}

function PickupTable({
  title,
  count,
  rows,
  tone,
}: {
  title: string;
  count: number;
  rows: Awaited<ReturnType<typeof parentPickupToday>>;
  tone: "blue" | "orange";
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-line bg-card print-sheet">
      <div className="flex items-baseline justify-between gap-3 px-4 py-3">
        <h2 className="font-serif text-2xl">{title}</h2>
        <span className="text-sm text-muted">{count} students</span>
      </div>
      {rows.length ? (
        <table className="w-full text-left text-sm">
          <thead className="bg-paper text-muted">
            <tr>
              <th className="px-4 py-3">Student</th>
              <th>Grade</th>
              <th>Teacher</th>
              <th>Parent</th>
              <th>Phone</th>
              <th>PM Dismissal</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((student) => (
              <tr key={student.id} className="border-t border-line">
                <td className="px-4 py-3 font-medium">
                  <Link href={`/students/${student.id}`} className="hover:underline">
                    {student.fullName}
                  </Link>
                </td>
                <td>{student.grade}</td>
                <td>{student.teacherName}</td>
                <td>{student.parentName}</td>
                <td>{student.parentPhone}</td>
                <td>
                  <StatusBadge tone={tone}>
                    {PM_LABEL[student.pmDismissal]}
                  </StatusBadge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="px-4 pb-4 text-sm text-muted">None in this group.</p>
      )}
    </section>
  );
}
