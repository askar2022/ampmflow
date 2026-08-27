import Link from "next/link";
import { getSession, isSchoolOperator } from "@/lib/auth";
import { loadStudents } from "@/lib/transportation";
import { changeList, groupByTeacher } from "@/lib/reports";
import { planSummary, planTone } from "@/lib/format";
import { StatusBadge } from "@/components/StatusBadge";
import { formatDateTime } from "@/lib/dates";
import { opsChangesClockLabel } from "@/lib/policy";
import {
  lastOpsChangeEmail,
  loadSavedOpsEmails,
} from "@/lib/ops-change-emails";
import { OpsChangeEmails } from "./OpsChangeEmails";

export default async function ChangesPage() {
  const session = await getSession();
  if (!session) return null;
  const changes = changeList(await loadStudents(session.schoolId));
  const groups = groupByTeacher(changes);
  const emails = await loadSavedOpsEmails(session.schoolId);
  const lastEmail = await lastOpsChangeEmail(session.schoolId);

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-semibold uppercase tracking-wider text-gold">
          Most important before dismissal
        </p>
        <h1 className="font-serif text-4xl">Today’s Changes</h1>
        <p className="mt-2 max-w-2xl text-muted">
          These students have a today-only or date-range exception. When the dates
          end, they automatically return to their permanent AM and PM assignments.
        </p>
        <a
          href="/print/export?kind=changes"
          className="mt-3 inline-block rounded-xl border border-line bg-card px-4 py-2 text-sm font-semibold"
        >
          Download Excel
        </a>
      </div>

      <OpsChangeEmails
        emails={emails}
        canEdit={isSchoolOperator(session.role)}
        lastSent={lastEmail ? formatDateTime(lastEmail.createdAt) : null}
        sendAt={opsChangesClockLabel()}
      />

      {groups.length ? (
        groups.map(([name, rows]) => (
          <div key={name} className="overflow-hidden rounded-2xl border border-line bg-card">
            <div className="border-b border-line bg-paper px-4 py-3">
              <h2 className="font-semibold text-navy">{name}</h2>
              <p className="text-sm text-muted">
                {rows.length} student{rows.length === 1 ? "" : "s"} changed today
              </p>
            </div>
            <table className="w-full text-left text-sm">
              <thead className="bg-paper text-muted">
                <tr>
                  <th className="px-4 py-3">Student</th>
                  <th>AM plan</th>
                  <th>PM plan</th>
                  <th>Window</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((student) => (
                  <tr key={student.id} className="row-yellow border-t border-line">
                    <td className="px-4 py-3 font-medium">{student.fullName}</td>
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
                      {student.pm.startDate || student.am.startDate} –{" "}
                      {student.pm.endDate || student.am.endDate}
                    </td>
                    <td className="px-4">
                      <Link href={`/students/${student.id}`} className="font-semibold text-blue">
                        Record
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))
      ) : (
        <div className="rounded-2xl border border-line bg-card px-4 py-6 text-sm text-muted">
          No today-only or date-range changes right now.
        </div>
      )}
    </div>
  );
}
