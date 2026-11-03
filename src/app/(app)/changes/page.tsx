import Link from "next/link";
import { getSession, isSchoolOperator } from "@/lib/auth";
import { loadVehicles } from "@/lib/gate";
import { loadFrontDeskChangesToday } from "@/lib/transportation";
import { groupByTeacher } from "@/lib/reports";
import { planSummary, planTone } from "@/lib/format";
import { StatusBadge } from "@/components/StatusBadge";
import { formatDateTime } from "@/lib/dates";
import { opsChangesClockLabel } from "@/lib/policy";
import {
  lastOpsChangeEmail,
  loadSavedOpsEmails,
} from "@/lib/ops-change-emails";
import { ChangeRideAssign } from "./ChangeRideAssign";
import { OpsChangeEmails } from "./OpsChangeEmails";

function windowLabel(start?: string | null, end?: string | null) {
  if (!start && !end) return "Today";
  if (start && end && start === end) return start;
  if (start && end) return `${start} – ${end}`;
  return start || end || "Today";
}

export default async function ChangesPage() {
  const session = await getSession();
  if (!session) return null;
  const [changes, vehicles] = await Promise.all([
    loadFrontDeskChangesToday(session.schoolId),
    loadVehicles(session.schoolId).catch(() => []),
  ]);
  const groups = groupByTeacher(changes);
  const emails = await loadSavedOpsEmails(session.schoolId);
  const lastEmail = await lastOpsChangeEmail(session.schoolId);
  const vans = vehicles
    .filter(
      (vehicle) =>
        vehicle.vehicleType.toUpperCase() === "VAN" || /van/i.test(vehicle.name),
    )
    .map((vehicle) => ({ id: vehicle.id, name: vehicle.name }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-4xl">Today’s Changes</h1>
        <p className="mt-2 max-w-2xl text-muted">
          When the company emails the correct bus or van, tap Update from
          company on that row. Do not open Front Desk for that.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <p className="text-sm font-semibold text-navy">
            {changes.length
              ? `${changes.length} student${changes.length === 1 ? "" : "s"} changed today`
              : "No students changed today"}
          </p>
          {changes.length ? (
            <a
              href="/print/export?kind=changes"
              className="text-sm font-semibold text-blue"
            >
              Download Excel
            </a>
          ) : null}
        </div>
      </div>

      <OpsChangeEmails
        emails={emails}
        canEdit={isSchoolOperator(session.role)}
        lastSent={lastEmail ? formatDateTime(lastEmail.createdAt) : null}
        sendAt={opsChangesClockLabel()}
      />

      {groups.length ? (
        groups.map(([name, rows]) => (
          <div
            key={name}
            className="overflow-hidden rounded-2xl border border-line bg-card"
          >
            <div className="border-b border-line bg-paper px-4 py-3">
              <h2 className="font-semibold text-navy">{name}</h2>
              <p className="text-sm text-muted">
                {rows.length} student{rows.length === 1 ? "" : "s"}
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-paper text-muted">
                  <tr>
                    <th className="px-4 py-3">Student</th>
                    <th>Grade / class</th>
                    <th>Morning</th>
                    <th>Afternoon</th>
                    <th>When</th>
                    <th>Entered by</th>
                    <th></th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((student) => (
                    <tr
                      key={student.id}
                      className="row-yellow border-t border-line"
                    >
                      <td className="px-4 py-3">
                        <div className="font-semibold">{student.fullName}</div>
                      </td>
                      <td>
                        {String(student.grade).replace(/^grade\s+/i, "")}
                        {student.classroomName
                          ? ` · ${student.classroomName}`
                          : ""}
                      </td>
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
                      <td>
                        {windowLabel(
                          student.pm.startDate || student.am.startDate,
                          student.pm.endDate || student.am.endDate,
                        )}
                      </td>
                      <td>{student.lastUpdatedBy || "Front Desk"}</td>
                      <td className="px-4 py-2">
                        <ChangeRideAssign
                          studentId={student.id}
                          studentName={student.fullName}
                          morning={planSummary(student.am, "AM")}
                          afternoon={planSummary(student.pm, "PM")}
                          vans={vans}
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
                      <td className="px-4">
                        <Link
                          href={`/dashboard?student=${student.id}`}
                          className="text-xs font-medium text-muted underline"
                        >
                          Wrong student?
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))
      ) : (
        <div className="rounded-2xl border border-line bg-card px-4 py-6 text-sm text-muted">
          No students on this list yet. After Front Desk saves a change, the
          student will show here so you can confirm it was the right child.
        </div>
      )}
    </div>
  );
}
