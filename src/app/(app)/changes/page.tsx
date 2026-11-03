import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { loadVehicles } from "@/lib/gate";
import { schoolLocalTime, todayKey } from "@/lib/dates";
import { loadFrontDeskChangesToday } from "@/lib/transportation";
import { ChangeRideAssign } from "./ChangeRideAssign";

function gradeOnly(grade: string) {
  return String(grade).replace(/^grade\s+/i, "") || "—";
}

function parentOnly(name: string | null | undefined) {
  return name && name !== "—" ? name : "—";
}

export default async function ChangesPage() {
  const session = await getSession();
  if (!session) return null;
  const [changes, vehicles, routes] = await Promise.all([
    loadFrontDeskChangesToday(session.schoolId),
    loadVehicles(session.schoolId).catch(() => []),
    prisma.busRoute.findMany({
      where: { schoolId: session.schoolId },
      select: { number: true },
      orderBy: { number: "asc" },
    }),
  ]);
  const buses = [...new Set(routes.map((route) => route.number))];
  const vans = vehicles
    .filter(
      (vehicle) =>
        vehicle.vehicleType.toUpperCase() === "VAN" || /van/i.test(vehicle.name),
    )
    .map((vehicle) => ({ id: vehicle.id, name: vehicle.name }));
  const rows = [...changes].sort((a, b) => {
    const teacher = a.teacherName.localeCompare(b.teacherName);
    if (teacher) return teacher;
    return (
      a.lastName.localeCompare(b.lastName) ||
      a.firstName.localeCompare(b.firstName)
    );
  });
  const day = todayKey();
  const assignedToday = await prisma.changeRequest.findMany({
    where: {
      schoolId: session.schoolId,
      status: "COMPLETED",
      studentId: { in: rows.map((student) => student.id) },
      busNumber: { not: null },
    },
    select: { studentId: true, reviewedAt: true, updatedAt: true },
  });
  const assignedIds = new Set(
    assignedToday
      .filter((row) =>
        schoolLocalTime(row.reviewedAt || row.updatedAt).dateKey === day,
      )
      .map((row) => row.studentId)
      .filter(Boolean),
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-4xl">Today’s Changes</h1>
        <p className="mt-2 max-w-2xl text-muted">
          Tap Update when the company sends the bus or van.
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

      {rows.length ? (
        <div className="overflow-hidden rounded-2xl border border-line bg-card">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-paper text-muted">
                <tr>
                  <th className="px-4 py-3">Student</th>
                  <th>Grade</th>
                  <th>Teacher</th>
                  <th>Parent</th>
                  <th className="px-4"></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((student) => (
                  <tr
                    key={student.id}
                    className="row-yellow border-t border-line"
                  >
                    <td className="px-4 py-3 font-semibold">
                      {student.fullName}
                    </td>
                    <td>{gradeOnly(student.grade)}</td>
                    <td>{student.teacherName || "—"}</td>
                    <td>{parentOnly(student.parentName)}</td>
                    <td className="px-4 py-2">
                      <ChangeRideAssign
                        studentId={student.id}
                        studentName={student.fullName}
                        grade={gradeOnly(student.grade)}
                        buses={buses}
                        vans={vans}
                        companyAssigned={assignedIds.has(student.id)}
                        parentEmail={student.parentEmail}
                        parentPhone={
                          student.parentPhone && student.parentPhone !== "—"
                            ? student.parentPhone
                            : ""
                        }
                        teacherEmail={student.teacherEmail}
                        defaultTrips={[
                          ...(student.am.waitingForAssignment ||
                          !student.am.busNumber
                            ? (["AM"] as const)
                            : []),
                          ...(student.pm.waitingForAssignment ||
                          !student.pm.busNumber
                            ? (["PM"] as const)
                            : []),
                        ]}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-line bg-card px-4 py-6 text-sm text-muted">
          No students on this list yet. After Front Desk saves a change, the
          student will show here.
        </div>
      )}
    </div>
  );
}
