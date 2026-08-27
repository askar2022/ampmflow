import Link from "next/link";
import { getSession } from "@/lib/auth";
import { loadStudents } from "@/lib/transportation";
import { pickupList } from "@/lib/reports";
import { StatusBadge } from "@/components/StatusBadge";

export default async function PickupPage() {
  const session = await getSession();
  if (!session) return null;
  const students = pickupList(await loadStudents(session.schoolId), "PM");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-4xl">Parent Pickup</h1>
        <p className="mt-1 text-muted">
          Students whose effective PM plan is parent pickup today.
        </p>
        <a
          href="/print/export?kind=pickup"
          className="mt-3 inline-block rounded-xl border border-line bg-card px-4 py-2 text-sm font-semibold"
        >
          Download Excel
        </a>
      </div>
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
            {students.map((student) => (
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
                  <StatusBadge tone={student.pm.source === "PERMANENT" ? "blue" : "yellow"} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
