"use client";

import Link from "next/link";
import { ParentChangeButton } from "@/components/ParentChangeCard";
import { planSummary, planTone } from "@/lib/format";
import { StatusBadge } from "@/components/StatusBadge";
import type { EffectiveStudent } from "@/lib/types";

export function StudentsTable({
  students,
  buses,
  allowPermanent,
  canChange,
}: {
  students: EffectiveStudent[];
  buses: string[];
  allowPermanent: boolean;
  canChange: boolean;
}) {
  return (
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
                  {canChange ? (
                    <div className="flex flex-col items-start gap-1">
                      <ParentChangeButton
                        student={student}
                        buses={buses}
                        allowPermanent={allowPermanent}
                      />
                      <Link
                        href={`/students/${student.id}/update`}
                        className="text-xs font-semibold text-muted underline"
                      >
                        Full form
                      </Link>
                    </div>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-sm text-muted">{students.length} students</p>
    </>
  );
}
