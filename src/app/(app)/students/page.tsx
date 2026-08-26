import Link from "next/link";
import { getSession } from "@/lib/auth";
import { loadStudents, searchStudents } from "@/lib/transportation";
import { planSummary, planTone } from "@/lib/format";
import { StatusBadge } from "@/components/StatusBadge";

export default async function StudentsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const session = await getSession();
  if (!session) return null;
  const { q = "" } = await searchParams;
  const students = searchStudents(await loadStudents(session.schoolId), q);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-serif text-4xl">Students</h1>
          <p className="mt-1 text-muted">
            Search by name, student ID, grade, teacher, bus, or parent phone.
          </p>
        </div>
        {session.role === "COORDINATOR" ? (
          <Link
            href="/students/import"
            className="rounded-full bg-navy px-4 py-2 text-sm font-semibold text-white"
          >
            Import Excel / CSV
          </Link>
        ) : null}
      </div>

      <form className="flex gap-2">
        <input
          name="q"
          defaultValue={q}
          placeholder="Mohammed, RIV-1001, Bus 3, 217-555-0144…"
          className="w-full max-w-xl rounded-xl border border-line bg-card px-4 py-2.5"
        />
        <button className="rounded-xl bg-navy px-4 py-2 font-semibold text-white">
          Search
        </button>
      </form>

      <div className="overflow-hidden rounded-2xl border border-line bg-card">
        <table className="w-full text-left text-sm">
          <thead className="bg-paper text-muted">
            <tr>
              <th className="px-4 py-3">Student</th>
              <th>ID</th>
              <th>Grade</th>
              <th>Teacher</th>
              <th>AM plan</th>
              <th>PM plan</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {students.map((student) => (
              <tr key={student.id} className="border-t border-line">
                <td className="px-4 py-3 font-medium">
                  <Link href={`/students/${student.id}`} className="hover:underline">
                    {student.fullName}
                  </Link>
                </td>
                <td>{student.studentId}</td>
                <td>{student.grade}</td>
                <td>{student.teacherName}</td>
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
                <td className="px-4">
                  {session.role === "COORDINATOR" || session.role === "FRONT_DESK" ? (
                    <Link
                      href={`/students/${student.id}/update`}
                      className="font-semibold text-blue"
                    >
                      Record change
                    </Link>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-sm text-muted">{students.length} students</p>
    </div>
  );
}
