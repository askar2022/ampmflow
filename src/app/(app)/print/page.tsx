import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { loadStudents } from "@/lib/transportation";
import {
  changeList,
  groupByBus,
  groupByTeacher,
  missingList,
  pickupList,
  reportTitle,
  stamp,
  type ReportKind,
} from "@/lib/reports";
import { planSummary, planTone, rosterChangeLabel } from "@/lib/format";
import { loadCheckInSummary, loadCompanyApprovedBuses } from "@/lib/operations";
import type { CheckInBusSummary } from "@/lib/operations";
import { lastTeacherEmail, teacherEmailPlan } from "@/lib/teacher-snapshot";
import { formatDateTime } from "@/lib/dates";
import { StatusBadge } from "@/components/StatusBadge";
import { Suspense } from "react";
import { PrintActions } from "./PrintActions";
import type { EffectiveStudent } from "@/lib/types";

export default async function PrintPage({
  searchParams,
}: {
  searchParams: Promise<{ kind?: string; group?: string }>;
}) {
  const session = await getSession();
  if (!session) return null;
  const { kind = "", group = "" } = await searchParams;
  const all = await loadStudents(session.schoolId);
  let students = all;
  if (session.role === "TEACHER" && session.teacherId) {
    const teacher = await prisma.teacher.findUnique({
      where: { id: session.teacherId },
    });
    if (teacher) {
      students = all.filter((s) => s.classroomId === teacher.classroomId);
    }
  }

  const header = stamp();
  const selected = ((kind === "missing" ? "company" : kind) || "teacher") as ReportKind;
  const companyApproved = await loadCompanyApprovedBuses(session.schoolId);
  const checkIns = await loadCheckInSummary(session.schoolId);
  const lastEmail = session.role === "TEACHER" ? null : await lastTeacherEmail(session.schoolId);
  const emailPlan = session.role === "TEACHER" ? { ready: [], missing: [] } : await teacherEmailPlan(session.schoolId);

  return (
    <div className="space-y-6">
      <div className="no-print">
        <h1 className="font-serif text-4xl">Reports</h1>
        <p className="mt-2 max-w-2xl text-muted">
          Choose a list, then print it or download Excel. The date and time
          are on every copy so staff do not use an older one.
        </p>
        {lastEmail && selected === "teacher" ? (
          <p className="mt-2 text-sm text-muted">
            Last emailed {formatDateTime(lastEmail.createdAt)}.
          </p>
        ) : null}
        <Suspense>
          <PrintActions
            isTeacher={session.role === "TEACHER"}
            ready={emailPlan.ready}
            missing={emailPlan.missing}
          />
        </Suspense>
      </div>

      {selected === "teacher" ? (
        <PrintGroups
          title="Classroom lists"
          header={header}
          groups={
            group
              ? groupByTeacher(students).filter(([name]) => name === group)
              : groupByTeacher(students)
          }
        />
      ) : null}
      {selected === "master" ? (
        <PrintTable title={reportTitle("master")} header={header} students={students} />
      ) : null}
      {selected === "bus" ? (
        <PrintGroups
          title="Bus lists"
          header={header}
          groups={groupByBus(students).map(([n, rows]) => [`Bus ${n}`, rows])}
          companyApproved={companyApproved}
        />
      ) : null}
      {selected === "pickup" ? (
        <PrintTable title={reportTitle("pickup")} header={header} students={pickupList(students)} />
      ) : null}
      {selected === "changes" ? (
        <PrintTable title={reportTitle("changes")} header={header} students={changeList(students)} />
      ) : null}
      {selected === "missing" ? (
        <PrintTable title={reportTitle("missing")} header={header} students={missingList(students)} />
      ) : null}
      {selected === "company" ? (
        <PrintTable
          title={reportTitle("company")}
          header={header}
          students={missingList(students)}
        />
      ) : null}
      {selected === "checkin" ? (
        <CheckInPrint title={reportTitle("checkin")} header={header} groups={checkIns} />
      ) : null}
    </div>
  );
}

function CheckInPrint({
  title,
  header,
  groups,
}: {
  title: string;
  header: { generated: string; version: string };
  groups: CheckInBusSummary[];
}) {
  return (
    <section className="print-sheet rounded-2xl border border-line bg-card p-5">
      <PrintHeader title={title} header={header} />
      <p className="mb-3 text-sm text-muted">
        Not selected yet means staff has not tapped On Bus, Missing, Not
        assigned, or Left school for that student.
      </p>
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="text-muted">
            <th className="py-2">Bus</th>
            <th>On list</th>
            <th>Rode</th>
            <th>Missing</th>
            <th>Not assigned</th>
            <th>Left school</th>
            <th>Not selected yet</th>
          </tr>
        </thead>
        <tbody>
          {groups.map((row) => (
            <tr key={row.busNumber} className="border-t border-line align-top">
              <td className="py-2 font-medium">
                {row.busNumber === "No bus yet" ? "Waiting" : `Bus ${row.busNumber}`}
              </td>
              <td className="py-2">{row.onList}</td>
              <td className="py-2">
                {row.onBus}
                {row.onBusNames.length ? (
                  <div className="text-xs">{row.onBusNames.join(", ")}</div>
                ) : null}
              </td>
              <td className="py-2">
                {row.missing}
                {row.missingNames.length ? (
                  <div className="text-xs">{row.missingNames.join(", ")}</div>
                ) : null}
              </td>
              <td className="py-2">
                {row.unassigned}
                {row.unassignedNames.length ? (
                  <div className="text-xs">{row.unassignedNames.join(", ")}</div>
                ) : null}
              </td>
              <td className="py-2">
                {row.leftSchool}
                {row.leftSchoolNames.length ? (
                  <div className="text-xs">{row.leftSchoolNames.join(", ")}</div>
                ) : null}
              </td>
              <td className="py-2">
                {row.notMarked}
                {row.notMarkedNames.length ? (
                  <div className="text-xs">{row.notMarkedNames.join(", ")}</div>
                ) : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function PrintHeader({
  title,
  header,
}: {
  title: string;
  header: { generated: string; version: string };
}) {
  return (
    <div className="mb-3 border-b border-line pb-2">
      <div className="mb-2 text-center">
        <div className="text-lg font-semibold tracking-tight">AMPM Flow</div>
        <div className="text-xs tracking-[0.12em] text-muted uppercase">
          Student Transportation & Dismissal
        </div>
      </div>
      <h2 className="font-serif text-2xl">{title}</h2>
      <p className="text-sm">
        {header.generated} · {header.version}
      </p>
    </div>
  );
}

function PrintTable({
  title,
  header,
  students,
}: {
  title: string;
  header: { generated: string; version: string };
  students: EffectiveStudent[];
}) {
  return (
    <section className="print-sheet rounded-2xl border border-line bg-card p-5">
      <PrintHeader title={title} header={header} />
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="text-muted">
            <th className="py-2">Student</th>
            <th>Teacher</th>
            <th>Today’s PM plan</th>
            <th>Location</th>
          </tr>
        </thead>
        <tbody>
          {students.map((student) => (
            <tr key={student.id} className="border-t border-line">
              <td className="py-1.5">{student.fullName}</td>
              <td>{student.teacherName}</td>
              <td>
                <StatusBadge tone={planTone(student.pm)}>
                  {planSummary(student.pm, "PM")}
                </StatusBadge>
              </td>
              <td>{student.pm.location}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function PrintGroups({
  title,
  header,
  groups,
  companyApproved,
}: {
  title: string;
  header: { generated: string; version: string };
  groups: [string, EffectiveStudent[]][];
  companyApproved?: Map<string, string>;
}) {
  return (
    <div className="space-y-6">
      {groups.map(([name, rows]) => (
        <section
          key={name}
          className="print-sheet break-after-page rounded-2xl border border-line bg-card p-5"
        >
          <PrintHeader title={`${title} — ${name}`} header={header} />
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="text-muted">
                <th className="py-2">Student</th>
                <th>Today’s PM plan</th>
                <th>Location</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((student) => {
                const change = rosterChangeLabel(
                  student,
                  companyApproved?.get(student.id),
                );
                return (
                  <tr
                    key={student.id}
                    className={`border-t border-line ${change ? "row-red" : ""}`}
                  >
                    <td className="py-1.5">
                      {student.fullName}
                      {change ? (
                        <div className="text-xs font-medium text-red">{change}</div>
                      ) : null}
                    </td>
                    <td>
                      <StatusBadge tone={planTone(student.pm)}>
                        {planSummary(student.pm, "PM")}
                      </StatusBadge>
                    </td>
                    <td>{student.pm.location}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      ))}
    </div>
  );
}
