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
  const canImport =
    session.role === "COORDINATOR" || session.role === "ADMINISTRATOR";
  const empty = students.length === 0 && !q;

  const uploadButton = canImport ? (
    <Link
      href="/students/import"
      className="inline-flex min-h-11 items-center justify-center rounded-xl border-2 border-[#c4a056] bg-[#0e2438] px-5 text-base font-semibold text-[#ffffff]"
    >
      Upload students
    </Link>
  ) : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-serif text-4xl">Students</h1>
          <p className="mt-1 text-muted">
            Search by name, student ID, grade, teacher, bus, or parent phone.
          </p>
        </div>
        {uploadButton}
      </div>

      <form className="flex gap-2">
        <input
          name="q"
          defaultValue={q}
          placeholder="Name, student ID, bus, or phone"
          className="w-full max-w-xl rounded-xl border border-line bg-card px-4 py-2.5"
        />
        <button className="rounded-xl bg-[#0e2438] px-4 py-2 font-semibold text-[#ffffff]">
          Search
        </button>
      </form>

      {empty ? (
        <div className="rounded-2xl border border-line bg-card px-6 py-10 text-center">
          <h2 className="text-2xl font-semibold text-navy">No students yet</h2>
          <p className="mx-auto mt-2 max-w-lg text-muted">
            Upload an Excel or CSV file here. Put bus numbers in{" "}
            <span className="font-medium text-navy">am_bus</span> and{" "}
            <span className="font-medium text-navy">pm_bus</span> to create the
            routes.
          </p>
          {uploadButton ? <div className="mt-5">{uploadButton}</div> : null}
        </div>
      ) : (
        <>
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
        </>
      )}
    </div>
  );
}
