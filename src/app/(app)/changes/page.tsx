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
  const waitingCount = rows.filter((row) => row.waiting).length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-4xl text-navy">Open requests</h1>
        <p className="mt-2 max-w-2xl text-muted">
          One place for the school to see every unfinished request — new route,
          new address, or new daycare — with the date and Minnehaha’s update.
          Use Submit new request only to add a new route.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <p className="text-sm font-semibold text-navy">
            {rows.length
              ? `${waitingCount} waiting · ${rows.length} open request${rows.length === 1 ? "" : "s"}`
              : "No open requests"}
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
        showKind
        showDate
        empty="No open requests yet. Submit a new route, or save an address/daycare change on Front Desk — they all show here until the bus company assigns a bus."
      />
    </div>
  );
}
