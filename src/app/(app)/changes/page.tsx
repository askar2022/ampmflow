import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { loadFrontDeskChangesToday } from "@/lib/transportation";
import {
  changeRequestLabel,
  companyAssignmentLabel,
  isWaitingRide,
} from "@/lib/format";
import { RequestRecordTable } from "@/components/RequestRecordTable";

function parentOnly(name: string | null | undefined) {
  return name && name !== "—" ? name : "—";
}

export default async function ChangesPage() {
  const session = await getSession();
  if (!session) return null;
  if (session.role === "BUS_COMPANY") redirect("/company");
  const changes = await loadFrontDeskChangesToday(session.schoolId);
  const rows = [...changes]
    .sort((a, b) => {
      const teacher = a.teacherName.localeCompare(b.teacherName);
      if (teacher) return teacher;
      return (
        a.lastName.localeCompare(b.lastName) ||
        a.firstName.localeCompare(b.firstName)
      );
    })
    .map((student) => ({
      id: student.id,
      name: student.fullName,
      grade: student.grade,
      teacher: student.teacherName || "—",
      parent: parentOnly(student.parentName),
      request: changeRequestLabel(student),
      company: companyAssignmentLabel(student),
      waiting: isWaitingRide(student),
    }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-4xl">Today’s Changes</h1>
        <p className="mt-2 max-w-2xl text-muted">
          Front Desk sends the request. The bus company assigns the bus or van.
          This page is the record — the request and the company update. The
          school does not type a bus or van here.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <p className="text-sm font-semibold text-navy">
            {rows.length
              ? `${rows.length} student${rows.length === 1 ? "" : "s"} changed today`
              : "No students changed today"}
          </p>
          {rows.length ? (
            <a
              href="/print/export?kind=changes"
              className="text-sm font-semibold text-blue"
            >
              Download Excel
            </a>
          ) : null}
        </div>
      </div>

      <RequestRecordTable
        rows={rows}
        showTeacher
        showParent
        empty="No students on this list yet. After Front Desk saves a change, the request shows here. The company assignment appears when they update it."
      />
    </div>
  );
}
