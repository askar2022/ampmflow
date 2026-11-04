"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChangeRideAssign } from "@/app/(app)/changes/ChangeRideAssign";
import type { CompanySchool } from "@/lib/company-access";
import type { Trip } from "@/lib/types";

export type CompanyRequest = {
  studentId: string;
  name: string;
  grade: string;
  teacher: string;
  parent: string;
  trips: Trip[];
  changed: boolean;
};

export function CompanySchoolList({ schools }: { schools: CompanySchool[] }) {
  return (
    <div>
      <h1 className="font-serif text-4xl text-navy">Today’s Changes</h1>
      <p className="mt-2 max-w-2xl text-muted">
        These are the schools you serve. Tap a school to see today’s students.
      </p>
      {schools.length ? (
        <ul className="mt-6 grid gap-3 sm:grid-cols-2">
          {schools.map((school) => (
            <li key={school.id}>
              <Link
                href={`/company?school=${school.id}`}
                className="flex min-h-[56px] items-center rounded-2xl border border-line bg-card px-4 text-base font-semibold text-navy hover:border-teal hover:bg-paper"
              >
                {school.name}
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-6 text-muted">
          No school is assigned to this login yet. Ask AMPM Flow to add the
          schools you serve.
        </p>
      )}
    </div>
  );
}

export function CompanyBoard({
  schools,
  schoolId,
  schoolName,
  buses,
  vans,
  rows,
}: {
  schools: CompanySchool[];
  schoolId: string;
  schoolName: string;
  buses: string[];
  vans: { id: string; name: string }[];
  rows: CompanyRequest[];
}) {
  const router = useRouter();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-4xl text-navy">Today’s Changes</h1>
        <p className="mt-2 max-w-2xl text-muted">
          Tap Need Update and enter the bus or van for that student.
        </p>
        <div className="mt-4 flex flex-wrap items-end gap-3">
          <label className="block min-w-[220px] flex-1 text-sm font-semibold text-navy">
            School
            <select
              value={schoolId}
              onChange={(event) =>
                router.push(`/company?school=${event.target.value}`)
              }
              className="mt-2 block min-h-[44px] w-full max-w-md rounded-[12px] border border-line bg-white px-3"
            >
              {schools.map((school) => (
                <option key={school.id} value={school.id}>
                  {school.name}
                </option>
              ))}
            </select>
          </label>
          {schools.length > 1 ? (
            <Link
              href="/company"
              className="inline-flex min-h-[44px] items-center text-sm font-semibold text-teal hover:text-teal-deep"
            >
              All schools
            </Link>
          ) : null}
        </div>
        <p className="mt-3 text-sm font-semibold text-navy">
          {rows.length
            ? `${rows.length} student${rows.length === 1 ? "" : "s"} changed today at ${schoolName}`
            : `No students changed today at ${schoolName}`}
        </p>
      </div>

      {rows.length ? (
        <div className="overflow-hidden rounded-2xl border border-line bg-card">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-paper text-base font-bold text-navy">
                <tr>
                  <th className="px-4 py-3">Student</th>
                  <th>Grade</th>
                  <th>Teacher</th>
                  <th>Parent</th>
                  <th className="px-4"></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.studentId} className="row-yellow border-t border-line">
                    <td className="px-4 py-3 font-semibold">{row.name}</td>
                    <td>{row.grade}</td>
                    <td>{row.teacher || "—"}</td>
                    <td>{row.parent}</td>
                    <td className="px-4 py-2">
                      <ChangeRideAssign
                        studentId={row.studentId}
                        studentName={row.name}
                        grade={row.grade}
                        buses={buses}
                        vans={vans}
                        companyAssigned={row.changed}
                        defaultTrips={row.trips}
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
          When {schoolName} saves a daycare or address change, the student will
          show here.
        </div>
      )}
    </div>
  );
}
