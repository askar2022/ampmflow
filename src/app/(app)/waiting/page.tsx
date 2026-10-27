import Link from "next/link";
import { getSession } from "@/lib/auth";
import { loadStudents } from "@/lib/transportation";
import { planSummary } from "@/lib/format";

export default async function WaitingPage() {
  const session = await getSession();
  if (!session) return null;
  const waiting = (await loadStudents(session.schoolId)).filter(
    (s) =>
      s.am.waitingForAssignment ||
      s.pm.waitingForAssignment ||
      s.am.source === "MISSING" ||
      s.pm.source === "MISSING" ||
      (s.am.type === "BUS" && !s.am.busNumber) ||
      (s.pm.type === "BUS" && !s.pm.busNumber),
  );

  return (
    <div className="space-y-4">
      <h1 className="font-serif text-4xl">Request for Route</h1>
      <p className="max-w-2xl text-muted">
        Students waiting for a bus or van. Front Desk emails the company from
        the student card. When the company emails or calls with the number,
        open the student and enter it. They stay here until that happens.
      </p>
      <a
        href="/print/export?kind=missing"
        className="inline-block rounded-xl border border-line bg-card px-4 py-2 text-sm font-semibold"
      >
        Download Excel
      </a>
      {waiting.length ? (
        <div className="overflow-hidden rounded-2xl border border-line bg-card">
          <table className="w-full text-left text-sm">
            <thead className="bg-paper text-muted">
              <tr>
                <th className="px-4 py-3">Student</th>
                <th>Teacher</th>
                <th>AM</th>
                <th>PM</th>
                <th>Address</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {waiting.map((student) => (
                <tr key={student.id} className="row-red border-t border-line">
                  <td className="px-4 py-3 font-medium">{student.fullName}</td>
                  <td>{student.teacherName}</td>
                  <td>{planSummary(student.am, "AM")}</td>
                  <td>{planSummary(student.pm, "PM")}</td>
                  <td>{student.homeAddress}</td>
                  <td className="px-4">
                    <Link
                      href={`/dashboard?student=${student.id}`}
                      className="font-semibold text-blue"
                    >
                      Open / assign
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="rounded-2xl border border-line bg-card px-4 py-6 text-sm text-muted">
          No route requests right now.
        </p>
      )}
    </div>
  );
}
