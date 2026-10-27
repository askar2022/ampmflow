"use client";

import Link from "next/link";
import { planSummary, planTone } from "@/lib/format";
import { StatusBadge } from "@/components/StatusBadge";
import type { EffectiveStudent } from "@/lib/types";

export function StudentsTable({
  students,
  canChange,
}: {
  students: EffectiveStudent[];
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
                    <Link
                      href={`/dashboard?student=${student.id}`}
                      className="rounded-full bg-navy px-3 py-1.5 text-xs font-semibold text-white"
                    >
                      Change
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
  );
}
