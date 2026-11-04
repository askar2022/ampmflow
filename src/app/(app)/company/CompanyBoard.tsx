"use client";

import { useState } from "react";
import { ChangeRideAssign } from "@/app/(app)/changes/ChangeRideAssign";
import type { CompanySchool } from "@/lib/company-access";
import type { Trip } from "@/lib/types";

export type CompanyRequest = {
  studentId: string;
  name: string;
  grade: string;
  teacher: string;
  parent: string;
  request: string;
  trips: Trip[];
  changed: boolean;
};

export type CompanyDesk = {
  schoolId: string;
  schoolName: string;
  buses: string[];
  vans: { id: string; name: string }[];
  rows: CompanyRequest[];
};

export function CompanyBoard({
  schools,
  schoolId,
  desks,
}: {
  schools: CompanySchool[];
  schoolId: string;
  desks: CompanyDesk[];
}) {
  const [selectedId, setSelectedId] = useState(schoolId);
  const desk =
    desks.find((item) => item.schoolId === selectedId) || desks[0];
  if (!desk) return null;

  function chooseSchool(id: string) {
    setSelectedId(id);
    window.history.replaceState(null, "", `/company?school=${id}`);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-4xl text-navy">Today’s Changes</h1>
        <p className="mt-2 max-w-2xl text-muted">
          The school already emailed you the student — daycare, new
          address, or a new student. Here you only assign the bus or van.
        </p>
        <label className="mt-4 block max-w-md text-sm font-semibold text-navy">
          School
          <select
            value={desk.schoolId}
            onChange={(event) => chooseSchool(event.target.value)}
            className="mt-2 block min-h-[44px] w-full rounded-[12px] border border-line bg-white px-3"
          >
            {schools.map((school) => (
              <option key={school.id} value={school.id}>
                {school.name}
              </option>
            ))}
          </select>
        </label>
        <p className="mt-3 text-sm font-semibold text-navy">
          {desk.rows.length
            ? `${desk.rows.length} student${desk.rows.length === 1 ? "" : "s"} changed today at ${desk.schoolName}`
            : `No students changed today at ${desk.schoolName}`}
        </p>
      </div>

      {desk.rows.length ? (
        <div className="overflow-hidden rounded-2xl border border-line bg-card">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-paper text-base font-bold text-navy">
                <tr>
                  <th className="px-4 py-3">Student</th>
                  <th>Grade</th>
                  <th>Teacher</th>
                  <th>Parent</th>
                  <th>Request</th>
                  <th className="px-4"></th>
                </tr>
              </thead>
              <tbody>
                {desk.rows.map((row) => (
                  <tr key={row.studentId} className="row-yellow border-t border-line">
                    <td className="px-4 py-3 font-semibold">{row.name}</td>
                    <td>{row.grade}</td>
                    <td>{row.teacher || "—"}</td>
                    <td>{row.parent}</td>
                    <td className="max-w-[220px]">{row.request}</td>
                    <td className="px-4 py-2">
                      <ChangeRideAssign
                        studentId={row.studentId}
                        studentName={row.name}
                        grade={row.grade}
                        request={row.request}
                        buses={desk.buses}
                        vans={desk.vans}
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
          When {desk.schoolName} sends a daycare, new address, or new student
          request, they will show here.
        </div>
      )}
    </div>
  );
}
