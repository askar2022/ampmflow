import Link from "next/link";
import { getSession } from "@/lib/auth";
import { formatLongDate, schoolNow } from "@/lib/dates";
import { loadRidership } from "@/lib/ridership";
import { getSchoolIdentityById } from "@/lib/school";
import { PrintOnce } from "../PrintOnce";

export const dynamic = "force-dynamic";

export default async function BusDriverPrintPage({
  searchParams,
}: {
  searchParams: Promise<{ bus?: string; van?: string }>;
}) {
  const session = await getSession();
  if (!session) return null;
  const { bus = "", van = "" } = await searchParams;
  const [list, school] = await Promise.all([
    loadRidership(session.schoolId),
    getSchoolIdentityById(session.schoolId),
  ]);

  const busGroup = bus
    ? list.buses.find(([number]) => number === bus)
    : undefined;
  const vanGroup = van ? list.vans.find((item) => item.id === van) : undefined;
  const title = busGroup
    ? `Bus ${busGroup[0]}`
    : vanGroup
      ? vanGroup.name
      : "Bus and van list";
  const rows = busGroup
      ? busGroup[1].map((student) => ({
        id: student.id,
        name: student.fullName,
        phone: student.parentPhone,
        detail: `Grade ${student.grade} · ${student.teacherName}`,
      }))
    : vanGroup
      ? vanGroup.riders.map((student) => ({
          id: student.id,
          name: student.name,
          phone: student.parentPhone,
          detail: `Grade ${student.grade}`,
        }))
      : [
          ...list.buses.flatMap(([number, riders]) =>
            riders.map((student) => ({
              id: `${number}-${student.id}`,
              name: student.fullName,
              phone: student.parentPhone,
              detail: `Bus ${number} · Grade ${student.grade}`,
            })),
          ),
          ...list.vans.flatMap((item) =>
            item.riders.map((student) => ({
              id: `${item.id}-${student.id}`,
              name: student.name,
              phone: student.parentPhone,
              detail: `${item.name} · Grade ${student.grade}`,
            })),
          ),
        ];

  return (
    <div className="space-y-4">
      <div className="no-print flex flex-wrap items-center gap-3">
        <Link href="/print" className="text-sm font-semibold text-navy">
          Back to Reports
        </Link>
        <PrintOnce />
      </div>

      <section className="print-sheet rounded-2xl border border-line bg-card p-6">
        <p className="text-sm text-muted">{school?.name || "School"}</p>
        <h1 className="font-serif text-4xl">{title}</h1>
        <p className="mt-1 text-muted">
          Driver list · {formatLongDate(schoolNow())} · {rows.length} student
          {rows.length === 1 ? "" : "s"}
        </p>
        <p className="mt-2 text-sm text-muted">
          Give this paper to the driver if they did not get the email.
        </p>
        <table className="mt-5 w-full text-left text-sm">
          <thead>
            <tr className="text-muted">
              <th className="py-2">#</th>
              <th>Student</th>
              <th>Parent phone</th>
              <th>Grade / class</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={row.id} className="border-t border-line">
                <td className="py-2">{index + 1}</td>
                <td className="font-semibold">{row.name}</td>
                <td>{row.phone || "—"}</td>
                <td>{row.detail}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!rows.length ? (
          <p className="mt-4 text-sm text-muted">No students on this vehicle.</p>
        ) : null}
      </section>
    </div>
  );
}
