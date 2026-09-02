"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  assignTempVehiclesAction,
  emailBusTomorrowAction,
} from "@/app/actions/gate";
import { busTomorrowFamilies, type GateFamily } from "@/lib/gate";
import type { GateStudent } from "@/lib/gate";

export function BusTomorrowBoard({
  students,
  date,
}: {
  students: GateStudent[];
  date: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [selected, setSelected] = useState<string[]>([]);
  const [zip, setZip] = useState("");
  const [grade, setGrade] = useState("");
  const [vehicle, setVehicle] = useState("");
  const [assignFilter, setAssignFilter] = useState<"all" | "assigned" | "unassigned">(
    "all",
  );
  const [familyName, setFamilyName] = useState("");
  const [tempVehicle, setTempVehicle] = useState("");
  const [emailTo, setEmailTo] = useState("");
  const [message, setMessage] = useState("");

  const families = useMemo(() => busTomorrowFamilies(students), [students]);
  const zips = [...new Set(families.map((f) => f.zip).filter(Boolean))].sort();
  const grades = [
    ...new Set(families.flatMap((f) => f.students.map((s) => s.grade))),
  ].sort();
  const vehicles = [
    ...new Set(families.map((f) => f.students[0]?.tempVehicleName).filter(Boolean)),
  ].sort();

  const visible = families.filter((family) => {
    if (zip && family.zip !== zip) return false;
    if (grade && !family.students.some((s) => s.grade === grade)) return false;
    const assigned = Boolean(family.students[0]?.tempVehicleName);
    if (assignFilter === "assigned" && !assigned) return false;
    if (assignFilter === "unassigned" && assigned) return false;
    if (vehicle && family.students[0]?.tempVehicleName !== vehicle) return false;
    if (
      familyName &&
      !`${family.parentName} ${family.familyKey}`
        .toLowerCase()
        .includes(familyName.toLowerCase())
    ) {
      return false;
    }
    return true;
  });

  const selectedFamilies = visible.filter((f) => selected.includes(f.familyId));

  function toggle(id: string) {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  function selectZip(value: string) {
    const ids = visible.filter((f) => f.zip === value).map((f) => f.familyId);
    setSelected((prev) => [...new Set([...prev, ...ids])]);
  }

  return (
    <div className="space-y-5">
      <div className="no-print grid gap-3 rounded-2xl border border-line bg-card p-4 sm:grid-cols-2 lg:grid-cols-5">
        <label className="text-sm font-semibold">
          ZIP code
          <select
            className="gate-select mt-1"
            value={zip}
            onChange={(e) => setZip(e.target.value)}
          >
            <option value="">All</option>
            {zips.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm font-semibold">
          Grade
          <select
            className="gate-select mt-1"
            value={grade}
            onChange={(e) => setGrade(e.target.value)}
          >
            <option value="">All</option>
            {grades.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm font-semibold">
          Assigned vehicle
          <select
            className="gate-select mt-1"
            value={vehicle}
            onChange={(e) => setVehicle(e.target.value)}
          >
            <option value="">All</option>
            {vehicles.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm font-semibold">
          Assigned / unassigned
          <select
            className="gate-select mt-1"
            value={assignFilter}
            onChange={(e) =>
              setAssignFilter(e.target.value as typeof assignFilter)
            }
          >
            <option value="all">All</option>
            <option value="assigned">Assigned</option>
            <option value="unassigned">Unassigned</option>
          </select>
        </label>
        <label className="text-sm font-semibold">
          Family name
          <input
            className="mt-1 min-h-12 w-full rounded-xl border border-line px-3"
            value={familyName}
            onChange={(e) => setFamilyName(e.target.value)}
          />
        </label>
      </div>

      <div className="no-print flex flex-wrap gap-2">
        <button
          type="button"
          className="action-button-secondary rounded-xl px-4 py-2 text-sm font-bold"
          onClick={() => setSelected(visible.map((f) => f.familyId))}
        >
          Select visible families
        </button>
        <label className="flex items-center gap-2 text-sm font-semibold">
          Select families by ZIP
          <select
            className="gate-select"
            defaultValue=""
            onChange={(e) => {
              if (e.target.value) selectZip(e.target.value);
              e.target.value = "";
            }}
          >
            <option value="">Choose ZIP</option>
            {zips.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          className="action-button-secondary rounded-xl px-4 py-2 text-sm font-bold"
          onClick={() => window.print()}
        >
          Print selected families
        </button>
        <a
          className="action-button-secondary rounded-xl px-4 py-2 text-sm font-bold"
          href={`/bus-tomorrow/export?families=${selected.join(",")}`}
        >
          Export selected families
        </a>
        <input
          className="min-h-10 rounded-xl border border-line px-3 text-sm"
          placeholder="Temporary vehicle / van"
          value={tempVehicle}
          onChange={(e) => setTempVehicle(e.target.value)}
        />
        <button
          type="button"
          className="action-button rounded-xl px-4 py-2 text-sm font-bold"
          disabled={pending || !selected.length}
          onClick={() => {
            start(async () => {
              const result = await assignTempVehiclesAction(
                selected,
                tempVehicle.trim(),
              );
              setMessage(
                result.ok
                  ? `Assigned ${result.count} students.`
                  : result.error || "Could not assign.",
              );
              router.refresh();
            });
          }}
        >
          Assign selected families
        </button>
        <button
          type="button"
          className="action-button-secondary rounded-xl px-4 py-2 text-sm font-bold"
          disabled={pending || !selected.length}
          onClick={() => {
            start(async () => {
              await assignTempVehiclesAction(selected, "");
              setMessage("Cleared temporary vehicle assignment.");
              router.refresh();
            });
          }}
        >
          Clear vehicle assignment
        </button>
        <input
          className="min-h-10 rounded-xl border border-line px-3 text-sm"
          placeholder="Driver email (optional)"
          value={emailTo}
          onChange={(e) => setEmailTo(e.target.value)}
        />
        <button
          type="button"
          className="action-button-secondary rounded-xl px-4 py-2 text-sm font-bold"
          disabled={pending}
          onClick={() => {
            start(async () => {
              const result = await emailBusTomorrowAction(selected, emailTo);
              setMessage(
                result.ok
                  ? `Sent selected families only to ${result.to.join(", ")}.`
                  : result.error || "Email failed.",
              );
            });
          }}
        >
          Email selected
        </button>
      </div>
      {message ? <p className="text-sm font-semibold">{message}</p> : null}

      <p className="text-sm text-muted">
        Showing families whose PM status is Parent Pickup Today Only—Bus Needed
        Tomorrow. These students do not ride a bus today. Temporary vehicles
        must be authorized by school leadership outside this app.
      </p>

      <div className="print-only hidden print:block">
        <h2 className="font-serif text-2xl">Driver report — selected families only</h2>
        <p>
          Route date {date} · {selectedFamilies.length} families ·{" "}
          {selectedFamilies.reduce((n, f) => n + f.students.length, 0)} students
        </p>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-line bg-card print-sheet">
        <table className="w-full min-w-[900px] text-left text-sm">
          <thead className="text-muted">
            <tr>
              <th className="px-3 py-2 no-print"></th>
              <th>Family ID</th>
              <th>Parent</th>
              <th>Phone</th>
              <th>Address</th>
              <th>ZIP</th>
              <th>Students</th>
              <th>Grades</th>
              <th>#</th>
              <th>Notes</th>
              <th>Temp vehicle</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((family) => (
              <FamilyRow
                key={family.familyId}
                family={family}
                checked={selected.includes(family.familyId)}
                printHidden={!selected.includes(family.familyId)}
                onToggle={() => toggle(family.familyId)}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function FamilyRow({
  family,
  checked,
  printHidden,
  onToggle,
}: {
  family: GateFamily;
  checked: boolean;
  printHidden: boolean;
  onToggle: () => void;
}) {
  return (
    <tr className={printHidden ? "print:hidden" : ""}>
      <td className="px-3 py-3 no-print">
        <input type="checkbox" checked={checked} onChange={onToggle} />
      </td>
      <td className="py-3 font-semibold">{family.familyKey}</td>
      <td>{family.parentName}</td>
      <td>{family.parentPhone}</td>
      <td>
        {family.address}, {family.city}
      </td>
      <td>{family.zip}</td>
      <td>{family.students.map((s) => s.fullName).join(", ")}</td>
      <td>{family.students.map((s) => s.grade).join(", ")}</td>
      <td>{family.students.length}</td>
      <td>{family.students[0]?.transportNotes || "—"}</td>
      <td>{family.students[0]?.tempVehicleName || "Not assigned"}</td>
    </tr>
  );
}
