import Link from "next/link";
import { getSession } from "@/lib/auth";
import { loadStudents, searchStudents } from "@/lib/transportation";
import { planSummary, planTone } from "@/lib/format";
import { StatusBadge } from "@/components/StatusBadge";

export default async function StudentsPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    imported?: string;
    updated?: string;
    issues?: string;
    uploaded?: string;
  }>;
}) {
  const session = await getSession();
  if (!session) return null;
  const { q = "", imported, updated, issues, uploaded } = await searchParams;
  const students = searchStudents(await loadStudents(session.schoolId), q);
  const canImport =
    session.role === "COORDINATOR" || session.role === "ADMINISTRATOR";
  const empty = students.length === 0 && !q;

  const uploadButton = canImport ? (
    <Link
      href="/students/import"
      className="action-button inline-flex min-h-12 items-center justify-center rounded-xl px-6 text-lg font-bold"
    >
      Upload students
    </Link>
  ) : null;

  return (
    <div className="space-y-6">
      {imported != null && imported !== "" ? (
        <p className="rounded-2xl border border-green bg-green-50 px-4 py-3 text-base font-semibold text-green">
          Upload complete. Imported {imported} new students
          {updated && updated !== "0" ? ` and updated ${updated}` : ""}.
          {issues && issues !== "0" ? ` ${issues} rows need review.` : ""}{" "}
          {students.length} students are on the list. Open AM & PM Plans to set
          regular buses and parent pickup.
        </p>
      ) : null}
      {uploaded === "1" && !(imported != null && imported !== "") ? (
        <p className="rounded-2xl border border-green bg-green-50 px-4 py-3 text-base font-semibold text-green">
          Upload finished. There {students.length === 1 ? "is" : "are"} now{" "}
          {students.length} student{students.length === 1 ? "" : "s"} on the
          list. If you see the names below, the Excel file loaded. Open The Gate
          when you are ready.
        </p>
      ) : null}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-serif text-4xl">Students</h1>
          <p className="mt-1 text-muted">
            Search by name, student ID, grade, teacher, bus, or parent phone.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <a
            href="/print/export?kind=master"
            className="inline-flex min-h-12 items-center justify-center rounded-xl border border-line bg-card px-4 text-sm font-semibold"
          >
            Download Excel
          </a>
          {!empty ? uploadButton : null}
        </div>
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
            Use the two buttons below. First download the sample, then upload
            that file or your own Excel or CSV.
          </p>
          {canImport ? (
            <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <a
                href="/sample-import.csv"
                download
                className="action-button-secondary inline-flex min-h-12 items-center justify-center rounded-xl px-6 text-lg font-bold"
              >
                1. Download sample
              </a>
              <Link
                href="/students/import"
                className="action-button inline-flex min-h-12 items-center justify-center rounded-xl px-6 text-lg font-bold"
              >
                2. Upload students
              </Link>
            </div>
          ) : null}
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
                      {session.role === "COORDINATOR" ||
                      session.role === "ADMINISTRATOR" ||
                      session.role === "FRONT_DESK" ? (
                        <Link
                          href={`/students/${student.id}/update`}
                          className="font-semibold text-navy underline"
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
