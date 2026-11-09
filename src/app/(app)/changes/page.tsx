import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { RequestRecordTable } from "@/components/RequestRecordTable";
import { loadSchoolOpenRequests } from "@/lib/school-open-requests";

export default async function ChangesPage() {
  const session = await getSession();
  if (!session) return null;
  if (session.role === "BUS_COMPANY") redirect("/company");

  const open = await loadSchoolOpenRequests(session.schoolId);
  const rows = open.map((row) => ({
    id: row.id,
    name: row.name,
    grade: row.grade,
    teacher: row.teacher,
    parent: row.parent,
    kind: row.kind,
    detail: row.detail,
    requestDate: row.requestDate,
    request: row.kind,
    company: row.company,
    waiting: row.waiting,
  }));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-serif text-4xl text-navy">Open requests</h1>
          <p className="mt-2 max-w-2xl text-muted">
            This table shows every request sent to the bus company — daycare,
            new address, and new route.
          </p>
        </div>
        {rows.length ? (
          <a
            href="/print/export?kind=changes"
            className="text-sm font-semibold text-blue"
          >
            Download Excel
          </a>
        ) : null}
      </div>

      <RequestRecordTable
        rows={rows}
        showTeacher
        showParent
        showDate
        empty="No open requests yet."
      />
    </div>
  );
}
