"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { applyFamilyGate, updateGateField } from "@/app/actions/gate";
import {
  AM_ARRIVAL,
  AM_FOLLOW_UP,
  AM_LABEL,
  AM_TONE,
  FOLLOW_LABEL,
  PM_DISMISSAL,
  PM_LABEL,
  PM_TONE,
  groupFamilies,
  searchGateStudents,
  type AmFollowUp,
  type GateStudent,
  type ImportSummary,
} from "@/lib/gate";

function StatusSelect<T extends string>({
  value,
  options,
  labels,
  tones,
  disabled,
  onChange,
}: {
  value: T;
  options: readonly T[];
  labels: Record<T, string>;
  tones: Record<string, string>;
  disabled?: boolean;
  onChange: (next: T) => void;
}) {
  return (
    <select
      className={`gate-select tone-${tones[value] || "gray"}`}
      value={value}
      disabled={disabled}
      aria-label={labels[value]}
      onChange={(event) => onChange(event.target.value as T)}
    >
      {options.map((option) => (
        <option key={option} value={option}>
          {labels[option]}
        </option>
      ))}
    </select>
  );
}

function showFollowUp(am: string) {
  return am === "NOT_CHECKED_IN" || am === "ABSENT_CONFIRMED";
}

export function GateBoard({
  students,
  lastUpdated,
  importSummary,
}: {
  students: GateStudent[];
  lastUpdated: string;
  importSummary: ImportSummary | null;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "am" | "pm">("all");
  const [pending, start] = useTransition();
  const [message, setMessage] = useState("");
  const [openNote, setOpenNote] = useState<string | null>(null);
  const [identityFor, setIdentityFor] = useState<string | null>(null);
  const [pendingChange, setPendingChange] = useState<{
    studentId: string;
    field: "amArrival" | "amFollowUp" | "pmDismissal";
    value: string;
    expected: string;
    needsIdentity?: boolean;
    needsBusWarning?: boolean;
  } | null>(null);

  const visible = useMemo(() => {
    let rows = searchGateStudents(students, query);
    if (filter === "am") rows = rows.filter((s) => s.amArrival === "NOT_CHECKED_IN");
    if (filter === "pm") rows = rows.filter((s) => s.pmDismissal === "NOT_CONFIRMED");
    return rows;
  }, [students, query, filter]);

  const families = useMemo(() => groupFamilies(visible), [visible]);
  const allFamilies = useMemo(() => groupFamilies(students), [students]);

  function runUpdate(
    student: GateStudent,
    field: "amArrival" | "amFollowUp" | "pmDismissal",
    value: string,
    extra?: { confirmedIdentity?: boolean; warnPickupToBus?: boolean },
  ) {
    start(async () => {
      const result = await updateGateField({
        studentId: student.id,
        field,
        value,
        expected:
          field === "amArrival"
            ? student.amArrival
            : field === "amFollowUp"
              ? student.amFollowUp
              : student.pmDismissal,
        confirmedIdentity: extra?.confirmedIdentity,
        warnPickupToBus: extra?.warnPickupToBus,
      });
      if ("needsBusWarning" in result && result.needsBusWarning) {
        setPendingChange({
          studentId: student.id,
          field,
          value,
          expected: student.pmDismissal,
          needsBusWarning: true,
        });
        setMessage(result.error || "");
        return;
      }
      if (!result.ok) {
        setMessage(result.error || "Could not save.");
        if (result.error?.includes("same name")) {
          setPendingChange({
            studentId: student.id,
            field,
            value,
            expected:
              field === "amArrival"
                ? student.amArrival
                : field === "amFollowUp"
                  ? student.amFollowUp
                  : student.pmDismissal,
            needsIdentity: true,
          });
          setIdentityFor(student.id);
        }
        return;
      }
      const conflict = result.results?.find((row) => row.conflict);
      if (conflict) {
        setMessage(
          `${conflict.name} was just updated by someone else. Refresh and try again.`,
        );
        router.refresh();
        return;
      }
      setPendingChange(null);
      setIdentityFor(null);
      setMessage("Saved.");
      router.refresh();
    });
  }

  function onFieldChange(
    student: GateStudent,
    field: "amArrival" | "amFollowUp" | "pmDismissal",
    value: string,
  ) {
    setMessage("");
    if (
      field === "pmDismissal" &&
      (student.pmDismissal === "PARENT_PICKUP_CONFIRMED" ||
        student.pmDismissal === "PARENT_PICKUP_TODAY_BUS_TOMORROW") &&
      value === "CONFIRMED_BUS"
    ) {
      setPendingChange({
        studentId: student.id,
        field,
        value,
        expected: student.pmDismissal,
        needsBusWarning: true,
      });
      return;
    }
    if (student.nameDupCount > 1) {
      setPendingChange({
        studentId: student.id,
        field,
        value,
        expected:
          field === "amArrival"
            ? student.amArrival
            : field === "amFollowUp"
              ? student.amFollowUp
              : student.pmDismissal,
        needsIdentity: true,
      });
      setIdentityFor(student.id);
      return;
    }
    runUpdate(student, field, value);
  }

  const missing =
    importSummary &&
    importSummary.sourceStudents >
      importSummary.created +
        importSummary.updated +
        importSummary.excludedNotReturning +
        importSummary.excludedNoName;

  return (
    <div className="space-y-2">
      <div className="gate-sticky no-print rounded-xl border border-line bg-card px-3 py-2">
        <input
          id="gate-search"
          autoFocus
          className="min-h-10 w-full rounded-lg border border-line px-3 text-base"
          placeholder="Search name, phone, family ID, or address"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {[
            ["all", "All"],
            ["am", "Not checked in"],
            ["pm", "PM not confirmed"],
          ].map(([id, label]) => (
            <button
              key={id}
              type="button"
              className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                filter === id ? "bg-navy text-white" : "border border-line bg-white"
              }`}
              onClick={() => setFilter(id as typeof filter)}
            >
              {label}
            </button>
          ))}
          <span className="text-xs text-muted">
            {families.length} families · {visible.length} students
            {pending ? " · Saving…" : ""}
            {message ? ` · ${message}` : ""}
          </span>
        </div>
      </div>

      <section className="rounded-xl border border-line bg-card px-3 py-2 text-sm">
        <h2 className="font-semibold">Import summary</h2>
        {importSummary ? (
          <p className="mt-1 text-muted">
            {importSummary.fileName}: {importSummary.sourceStudents} students /{" "}
            {importSummary.sourceFamilies} families in the file. Imported{" "}
            {importSummary.created} new, updated {importSummary.updated}. Excluded{" "}
            {importSummary.excludedNotReturning} marked Not Returning
            {importSummary.excludedNoName
              ? `, ${importSummary.excludedNoName} missing a name`
              : ""}
            {importSummary.duplicateNameRows
              ? `, ${importSummary.duplicateNameRows} duplicate-name rows kept separate`
              : ""}
            {importSummary.errors ? `, ${importSummary.errors} row errors` : ""}.
            Roster now: {allFamilies.length} families · {students.length} students.
            {missing
              ? " Some rows were not saved — upload the file again to finish."
              : ""}
          </p>
        ) : (
          <p className="mt-1 text-muted">
            This board has {students.length} students and {allFamilies.length}{" "}
            families. The Sankofa master workbook has 115 students and 69
            families. 12 are marked Not Returning (those should not appear here).
            The remaining gap is from the last upload stopping before it finished,
            plus one duplicate name (Abdirahman Mohamed). Upload the Excel file
            again to import the missing students.
          </p>
        )}
        <p className="mt-1 text-xs text-muted">Last updated {lastUpdated}</p>
      </section>

      {families.map((family) => {
        const first = family.students[0];
        return (
          <section
            key={family.familyId}
            className="rounded-xl border border-line bg-card px-3 py-2 print-sheet"
          >
            <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-sm">
              <div>
                <span className="font-semibold">{family.parentName}</span>
                <span className="text-muted"> · {family.familyKey}</span>
                <span className="text-muted"> · {family.parentPhone}</span>
                <span className="text-muted">
                  {" "}
                  · {family.zip || family.address}
                </span>
                <span className="text-muted">
                  {" "}
                  · {family.students.length}{" "}
                  {family.students.length === 1 ? "child" : "children"}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-2 no-print">
                <button
                  type="button"
                  className="text-xs font-semibold text-blue"
                  onClick={() =>
                    setOpenNote((id) =>
                      id === family.familyId ? null : family.familyId,
                    )
                  }
                >
                  {first?.transportNotes ? "Note" : "Add note"}
                </button>
                {family.students.length > 1 ? (
                  <label className="flex items-center gap-1 text-xs font-semibold">
                    <input
                      type="checkbox"
                      onChange={(event) => {
                        if (!event.target.checked) return;
                        const names = family.students
                          .map((s) => s.fullName)
                          .join(", ");
                        if (
                          !window.confirm(
                            `Apply ${AM_LABEL[first.amArrival]} and ${PM_LABEL[first.pmDismissal]} to all children?\n\n${names}`,
                          )
                        ) {
                          event.target.checked = false;
                          return;
                        }
                        start(async () => {
                          const result = await applyFamilyGate({
                            studentId: first.id,
                            amArrival: first.amArrival,
                            pmDismissal: first.pmDismissal,
                            confirmed: true,
                          });
                          setMessage(
                            result.ok
                              ? `Updated ${result.count} children.`
                              : result.error || "Could not update the family.",
                          );
                          event.target.checked = false;
                          router.refresh();
                        });
                      }}
                    />
                    Apply these selections to all children
                  </label>
                ) : null}
              </div>
            </div>
            {family.reviewNeeded ? (
              <p className="mt-1 text-xs font-semibold text-orange">
                Review: {family.reviewNote || "Confirm this family match."}
              </p>
            ) : null}
            {openNote === family.familyId ? (
              <textarea
                className="mt-1 min-h-14 w-full rounded-lg border border-line px-2 py-1 text-sm"
                defaultValue={first?.transportNotes || ""}
                placeholder="Transportation notes"
                onBlur={(event) => {
                  const notes = event.target.value;
                  if (notes === (first?.transportNotes || "")) return;
                  start(async () => {
                    await updateGateField({
                      studentId: first.id,
                      field: "transportNotes",
                      value: notes,
                    });
                    router.refresh();
                  });
                }}
              />
            ) : null}

            <div className="mt-1">
              {family.students.map((student) => (
                <div
                  key={student.id}
                  className="grid grid-cols-1 items-center gap-1 border-t border-line py-1.5 sm:grid-cols-[minmax(0,1fr)_10.5rem_10.5rem]"
                >
                  <div className="min-w-0 text-sm">
                    <span className="font-semibold">{student.fullName}</span>
                    <span className="text-muted"> · {student.grade}</span>
                    {student.nameDupCount > 1 ? (
                      <span className="ml-2 text-xs font-semibold text-red">
                        Duplicate name — confirm {student.parentPhone}
                      </span>
                    ) : null}
                    {identityFor === student.id &&
                    pendingChange?.needsIdentity ? (
                      <label className="mt-1 flex items-start gap-2 text-xs font-semibold">
                        <input
                          type="checkbox"
                          className="mt-0.5"
                          onChange={(event) => {
                            if (!event.target.checked || !pendingChange) return;
                            runUpdate(
                              student,
                              pendingChange.field,
                              pendingChange.value,
                              { confirmedIdentity: true },
                            );
                          }}
                        />
                        I confirmed {student.fullName}, parent{" "}
                        {student.parentName}, {student.parentPhone}.
                      </label>
                    ) : null}
                  </div>
                  <div>
                    <StatusSelect
                      value={student.amArrival}
                      options={AM_ARRIVAL}
                      labels={AM_LABEL}
                      tones={AM_TONE}
                      disabled={pending}
                      onChange={(value) =>
                        onFieldChange(student, "amArrival", value)
                      }
                    />
                    {showFollowUp(student.amArrival) ? (
                      <div className="mt-1">
                        <StatusSelect
                          value={student.amFollowUp}
                          options={AM_FOLLOW_UP}
                          labels={FOLLOW_LABEL}
                          tones={{}}
                          disabled={pending}
                          onChange={(value) =>
                            onFieldChange(
                              student,
                              "amFollowUp",
                              value as AmFollowUp,
                            )
                          }
                        />
                      </div>
                    ) : null}
                  </div>
                  <div>
                    <StatusSelect
                      value={student.pmDismissal}
                      options={PM_DISMISSAL}
                      labels={PM_LABEL}
                      tones={PM_TONE}
                      disabled={pending}
                      onChange={(value) =>
                        onFieldChange(student, "pmDismissal", value)
                      }
                    />
                  </div>
                  {pendingChange?.studentId === student.id &&
                  pendingChange.needsBusWarning ? (
                    <div className="sm:col-span-3 rounded-lg border border-red bg-red-50 px-2 py-1 text-xs">
                      {student.fullName} is parent pickup. Confirm before bus.
                      <button
                        type="button"
                        className="ml-2 font-bold"
                        onClick={() =>
                          runUpdate(student, "pmDismissal", "CONFIRMED_BUS", {
                            warnPickupToBus: true,
                          })
                        }
                      >
                        Yes — Confirmed Bus
                      </button>
                      <button
                        type="button"
                        className="ml-2 font-bold"
                        onClick={() => setPendingChange(null)}
                      >
                        Keep pickup
                      </button>
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          </section>
        );
      })}

      {!families.length ? (
        <p className="rounded-xl border border-line bg-card px-3 py-4 text-sm text-muted">
          {query
            ? "No student or parent matches that search."
            : "No students match this filter."}
        </p>
      ) : null}
    </div>
  );
}
