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
import { planSummary, planTone } from "@/lib/format";
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
  const selected = (kind || "teacher") as ReportKind;

  return (
    <div className="space-y-6">
      <div className="no-print">
        <h1 className="font-serif text-4xl">Print / Email</h1>
        <p className="mt-1 text-muted">
          Every list includes the date, generation time, and version so staff do
          not use an older copy.
        </p>
        <Suspense>
          <PrintActions isTeacher={session.role === "TEACHER"} />
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
    </div>
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
      <div className="mb-2 flex flex-col items-center text-center">
        <div className="text-xs uppercase tracking-[0.2em] text-muted">
          Sankofa Prep
        </div>
        <div className="font-serif text-lg">ampmflow</div>
        <img
          src="/sankofa-logo.jpg"
          alt="Sankofa Prep"
          className="mt-2 h-12 w-12 rounded-full object-cover"
        />
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
}: {
  title: string;
  header: { generated: string; version: string };
  groups: [string, EffectiveStudent[]][];
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
              {rows.map((student) => (
                <tr key={student.id} className="border-t border-line">
                  <td className="py-1.5">{student.fullName}</td>
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
      ))}
    </div>
  );
}
