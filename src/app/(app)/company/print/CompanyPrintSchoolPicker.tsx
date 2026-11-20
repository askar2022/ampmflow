"use client";

import type { CompanySchool } from "@/lib/company-access";

export function CompanyPrintSchoolPicker({
  schools,
  schoolId,
  schoolName,
}: {
  schools: CompanySchool[];
  schoolId: string;
  schoolName: string;
}) {
  return (
    <label className="mt-4 block max-w-md text-sm font-semibold text-navy">
      School
      <select
        value={schoolId}
        onChange={(event) => {
          const next = event.target.value;
          if (next === schoolId) return;
          window.location.assign(`/company/print?school=${next}`);
        }}
        className="mt-2 block min-h-[44px] w-full rounded-[12px] border border-line bg-white px-3"
      >
        {schools.map((school) => (
          <option key={school.id} value={school.id}>
            {school.name}
          </option>
        ))}
      </select>
      <span className="mt-1 block text-xs font-normal text-muted">
        Showing buses and vans for {schoolName}.
      </span>
    </label>
  );
}
