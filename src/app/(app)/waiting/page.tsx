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
      (s.am.type === "BUS" && !s.am.busNumber) ||
      (s.pm.type === "BUS" && !s.pm.busNumber),
  );

  return (
    <div className="space-y-4">
      <h1 className="font-serif text-4xl">Waiting for Route</h1>
      <p className="max-w-2xl text-muted">
        A new address or daycare never silently becomes a bus assignment. Status
        stays <strong>Waiting for Bus Company Assignment</strong> until the
        company proposes a number and the coordinator confirms it.
      </p>
      <div className="overflow-hidden rounded-2xl border border-line bg-card">
        <table className="w-full text-left text-sm">
          <thead className="bg-paper text-muted">
            <tr>
              <th className="px-4 py-3">Student</th>
              <th>Teacher</th>
              <th>AM</th>
              <th>PM</th>
              <th>Address</th>
            </tr>
          </thead>
          <tbody>
            {waiting.map((student) => (
              <tr key={student.id} className="row-red border-t border-line">
                <td className="px-4 py-3 font-medium">
                  <Link href={`/students/${student.id}`} className="hover:underline">
                    {student.fullName}
                  </Link>
                </td>
                <td>{student.teacherName}</td>
                <td>{planSummary(student.am, "AM")}</td>
                <td>{planSummary(student.pm, "PM")}</td>
                <td>{student.homeAddress}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
