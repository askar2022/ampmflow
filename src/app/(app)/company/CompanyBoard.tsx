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
  effectiveDate?: string;
  email: { subject: string; body: string };
  trips: Trip[];
  changed: boolean;
};

function ReadEmailButton({
  studentName,
  email,
}: {
  studentName: string;
  email: { subject: string; body: string };
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-full border border-navy/25 bg-white px-4 py-2 text-sm font-semibold text-navy"
      >
        Read email
      </button>
      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-navy/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby={`email-${studentName}`}
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-lg rounded-2xl bg-card p-6 shadow-lg"
            onClick={(event) => event.stopPropagation()}
          >
            <h3
              id={`email-${studentName}`}
              className="font-serif text-3xl text-navy"
            >
              Email from the school
            </h3>
            <p className="mt-2 text-sm font-semibold text-navy">{email.subject}</p>
            <div className="mt-4 max-h-[50vh] overflow-auto rounded-xl border border-line bg-paper px-3 py-3 text-sm font-normal leading-6 text-muted">
              {email.body.split("\n").map((line, index) => (
                <div
                  key={`${index}-${line}`}
                  className={
                    /^(Requested change:|Address:|Daycare address:|AM pickup:|PM pickup:)/.test(
                      line,
                    )
                      ? "font-extrabold text-navy"
                      : "font-normal"
                  }
                >
                  {line || "\u00a0"}
                </div>
              ))}
            </div>
            <p className="mt-3 text-sm text-muted">
              Use this if the phone that got the email is not available.
            </p>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="mt-4 min-h-[44px] rounded-full bg-navy px-5 text-sm font-semibold text-white"
            >
              Close
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}

export type CompanyDesk = {
  schoolId: string;
  schoolName: string;
  buses: string[];
  vans: { id: string; name: string }[];
  rows: CompanyRequest[];
};

export function CompanyBoard({
  companyName,
  schools,
  schoolId,
  desks,
}: {
  companyName: string;
  schools: CompanySchool[];
  schoolId: string;
  desks: CompanyDesk[];
}) {
  const [selectedId, setSelectedId] = useState(schoolId);
  const desk =
    desks.find((item) => item.schoolId === selectedId) || desks[0];
  if (!desk) return null;

  function chooseSchool(id: string) {
    if (id === selectedId) return;
    window.location.assign(`/company?school=${id}`);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-4xl text-navy">{companyName}</h1>
        <p className="mt-1 text-lg font-semibold text-navy">Today’s Changes</p>
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
                    <td className="px-4 py-3 font-normal">{row.name}</td>
                    <td className="font-normal">{row.grade}</td>
                    <td className="font-normal">{row.teacher || "—"}</td>
                    <td className="font-normal">{row.parent}</td>
                    <td className="max-w-[220px] font-extrabold text-navy">
                      {row.request}
                    </td>
                    <td className="px-4 py-2">
                      <div className="flex flex-wrap gap-2">
                        <ReadEmailButton
                          studentName={row.name}
                          email={row.email}
                        />
                        <ChangeRideAssign
                          studentId={row.studentId}
                          studentName={row.name}
                          grade={row.grade}
                          request={row.request}
                          effectiveDate={row.effectiveDate}
                          buses={desk.buses}
                          vans={desk.vans}
                          companyAssigned={row.changed}
                          defaultTrips={row.trips}
                          nearbyEnabled
                        />
                      </div>
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
