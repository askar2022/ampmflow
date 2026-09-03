"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { applyFamilyGate, updateGateField } from "@/app/actions/gate";
import { ParentChangeCard } from "@/components/ParentChangeCard";
import type { EffectiveStudent } from "@/lib/types";
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

function asChangeStudent(row: GateStudent, plan?: EffectiveStudent): EffectiveStudent {
  if (plan) return plan;
  const missing = (trip: "AM" | "PM"): EffectiveStudent["am"] => ({
    trip,
    type: null,
    destination: null,
    busNumber: null,
    daycareName: null,
    customAddress: null,
    waitingForAssignment: false,
    notes: "",
    source: "MISSING",
    location: "",
  });
  return {
    id: row.id,
    studentId: row.studentId,
    firstName: row.firstName,
    lastName: row.lastName,
    fullName: row.fullName,
    grade: row.grade,
    parentName: row.parentName,
    parentPhone: row.parentPhone,
    homeAddress: [row.address, row.city, row.zip].filter(Boolean).join(", "),
    daycareName: null,
    daycareAddress: null,
    classroomId: "",
    classroomName: "",
    teacherName: row.teacherName,
    notes: row.transportNotes,
    am: missing("AM"),
    pm: missing("PM"),
    lastUpdatedBy: null,
    lastUpdatedAt: null,
  };
}

export function GateBoard({
  students,
  lastUpdated,
  importSummary,
  plans = [],
  buses = [],
  allowPermanent = false,
}: {
  students: GateStudent[];
  lastUpdated: string;
  importSummary: ImportSummary | null;
  plans?: EffectiveStudent[];
  buses?: string[];
  allowPermanent?: boolean;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "am" | "pm">("all");
  const [pending, start] = useTransition();
  const [message, setMessage] = useState("");
  const [summaryOpen, setSummaryOpen] = useState(!importSummary);
  const [openNote, setOpenNote] = useState<string | null>(null);
  const [openFollowUp, setOpenFollowUp] = useState<Record<string, boolean>>({});
  const [changeFor, setChangeFor] = useState<string | null>(null);
  const planById = useMemo(
    () => new Map(plans.map((row) => [row.id, row])),
    [plans],
  );
  const changeStudent = changeFor
    ? asChangeStudent(
        students.find((row) => row.id === changeFor) || students[0],
        planById.get(changeFor),
      )
    : null;
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

  function followUpOpen(student: GateStudent) {
    return (
      student.amArrival === "ABSENT_CONFIRMED" ||
      Boolean(openFollowUp[student.id])
    );
  }

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
    if (field === "amArrival" && value === "ABSENT_CONFIRMED") {
      setOpenFollowUp((prev) => ({ ...prev, [student.id]: true }));
    }
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

  return (
    <div className="gate-page">
      <div className="gate-toolbar no-print">
        <input
          id="gate-search"
          autoFocus
          className="gate-search"
          placeholder="Search name, phone, family ID, or address"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <div className="gate-toolbar-row">
          {[
            ["all", "All"],
            ["am", "Not checked in"],
            ["pm", "PM not confirmed"],
          ].map(([id, label]) => (
            <button
              key={id}
              type="button"
              className={`gate-chip ${filter === id ? "is-on" : ""}`}
              onClick={() => setFilter(id as typeof filter)}
            >
              {label}
            </button>
          ))}
          <span className="gate-meta">
            {families.length} families · {visible.length} students
            {pending ? " · Saving…" : ""}
            {message ? ` · ${message}` : ""}
          </span>
          <button
            type="button"
            className="gate-link"
            onClick={() => setSummaryOpen((open) => !open)}
          >
            {summaryOpen ? "Hide import summary" : "Import summary"}
          </button>
        </div>
      </div>
      {summaryOpen ? (
        <div className="gate-summary">
          {importSummary ? (
            <p>
              {importSummary.fileName}: {importSummary.sourceStudents} students /{" "}
              {importSummary.sourceFamilies} families in the file. Imported{" "}
              {importSummary.created} new, updated {importSummary.updated}.
              Excluded {importSummary.excludedNotReturning} Not Returning
              {importSummary.excludedNoName
                ? `, ${importSummary.excludedNoName} missing a name`
                : ""}
              {importSummary.duplicateNameRows
                ? `, ${importSummary.duplicateNameRows} duplicate-name rows`
                : ""}
              {importSummary.errors
                ? `, ${importSummary.errors} row errors`
                : ""}
              . Roster now: {allFamilies.length} families · {students.length}{" "}
              students.
            </p>
          ) : (
            <p>
              This board has {students.length} active students in{" "}
              {allFamilies.length} families. The Excel file has 115 records and
              about 69 families. About 12 are Not Returning, so The Gate should
              show about 103 students — not 115. {students.length < 100
                ? "Upload the same Excel again and stay on the page until it finishes. Do not run the reset SQL."
                : ""}
            </p>
          )}
          <p>Last updated {lastUpdated}</p>
        </div>
      ) : null}

      <table className="gate-table">
        <thead>
          <tr>
            <th className="col-student">Student</th>
            <th className="col-grade">Grade</th>
            <th className="col-am">AM Arrival</th>
            <th className="col-pm">PM Dismissal</th>
            <th className="col-actions">Actions</th>
          </tr>
        </thead>
        <tbody>
          {families.map((family) => {
            const first = family.students[0];
            return (
              <FamilyBlock
                key={family.familyId}
                family={family}
                first={first}
                pending={pending}
                openNote={openNote}
                identityFor={identityFor}
                pendingChange={pendingChange}
                followUpOpen={followUpOpen}
                onToggleNote={() =>
                  setOpenNote((id) =>
                    id === family.familyId ? null : family.familyId,
                  )
                }
                onApplyAll={() => {
                  const names = family.students.map((s) => s.fullName).join(", ");
                  if (
                    !window.confirm(
                      `Apply ${AM_LABEL[first.amArrival]} and ${PM_LABEL[first.pmDismissal]} to all children?\n\n${names}`,
                    )
                  ) {
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
                    router.refresh();
                  });
                }}
                onToggleFollowUp={(id) =>
                  setOpenFollowUp((prev) => ({ ...prev, [id]: !prev[id] }))
                }
                onFieldChange={onFieldChange}
                onConfirmIdentity={(student) => {
                  if (!pendingChange) return;
                  runUpdate(student, pendingChange.field, pendingChange.value, {
                    confirmedIdentity: true,
                  });
                }}
                onConfirmBus={(student) =>
                  runUpdate(student, "pmDismissal", "CONFIRMED_BUS", {
                    warnPickupToBus: true,
                  })
                }
                onKeepPickup={() => setPendingChange(null)}
                onSaveNote={(notes) => {
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
                onParentChange={(id) => setChangeFor(id)}
              />
            );
          })}
        </tbody>
      </table>

      {!families.length ? (
        <p className="gate-empty">
          {query
            ? "No student or parent matches that search."
            : "No students match this filter."}
        </p>
      ) : null}
      {changeStudent ? (
        <ParentChangeCard
          student={changeStudent}
          buses={buses}
          allowPermanent={allowPermanent}
          onClose={() => setChangeFor(null)}
        />
      ) : null}
    </div>
  );
}

function FamilyBlock({
  family,
  first,
  pending,
  openNote,
  identityFor,
  pendingChange,
  followUpOpen,
  onToggleNote,
  onApplyAll,
  onToggleFollowUp,
  onFieldChange,
  onConfirmIdentity,
  onConfirmBus,
  onKeepPickup,
  onSaveNote,
  onParentChange,
}: {
  family: ReturnType<typeof groupFamilies>[number];
  first: GateStudent;
  pending: boolean;
  openNote: string | null;
  identityFor: string | null;
  pendingChange: {
    studentId: string;
    needsIdentity?: boolean;
    needsBusWarning?: boolean;
  } | null;
  followUpOpen: (student: GateStudent) => boolean;
  onToggleNote: () => void;
  onApplyAll: () => void;
  onToggleFollowUp: (id: string) => void;
  onFieldChange: (
    student: GateStudent,
    field: "amArrival" | "amFollowUp" | "pmDismissal",
    value: string,
  ) => void;
  onConfirmIdentity: (student: GateStudent) => void;
  onConfirmBus: (student: GateStudent) => void;
  onKeepPickup: () => void;
  onSaveNote: (notes: string) => void;
  onParentChange: (studentId: string) => void;
}) {
  return (
    <>
      <tr className="gate-family">
        <td colSpan={5}>
          <div className="gate-family-line">
            <span>
              {family.parentName} · {family.familyKey} · {family.parentPhone} ·{" "}
              {family.zip || family.address} · {family.students.length}{" "}
              {family.students.length === 1 ? "child" : "children"}
            </span>
            {family.students.length > 1 ? (
              <button type="button" className="gate-link" onClick={onApplyAll}>
                Apply to all children
              </button>
            ) : null}
          </div>
        </td>
      </tr>
      {family.reviewNeeded ? (
        <tr className="gate-review">
          <td colSpan={5}>
            Review: {family.reviewNote || "Confirm this family match."}
          </td>
        </tr>
      ) : null}
      {openNote === family.familyId ? (
        <tr className="gate-note-row">
          <td colSpan={5}>
            <textarea
              className="gate-note"
              defaultValue={first?.transportNotes || ""}
              placeholder="Transportation notes"
              onBlur={(event) => onSaveNote(event.target.value)}
            />
          </td>
        </tr>
      ) : null}
      {family.students.map((student) => (
        <tr key={student.id} className={`gate-row tone-${AM_TONE[student.amArrival]}`}>
          <td className="col-student">
            <span className="gate-name">{student.fullName}</span>
            {student.nameDupCount > 1 ? (
              <span className="gate-warn"> Duplicate name</span>
            ) : null}
            {identityFor === student.id && pendingChange?.needsIdentity ? (
              <label className="gate-confirm">
                <input
                  type="checkbox"
                  onChange={(event) => {
                    if (event.target.checked) onConfirmIdentity(student);
                  }}
                />
                Confirm {student.fullName}, {student.parentPhone}
              </label>
            ) : null}
          </td>
          <td className="col-grade">{student.grade}</td>
          <td className="col-am">
            <StatusSelect
              value={student.amArrival}
              options={AM_ARRIVAL}
              labels={AM_LABEL}
              tones={AM_TONE}
              disabled={pending}
              onChange={(value) => onFieldChange(student, "amArrival", value)}
            />
          </td>
          <td className="col-pm">
            <StatusSelect
              value={student.pmDismissal}
              options={PM_DISMISSAL}
              labels={PM_LABEL}
              tones={PM_TONE}
              disabled={pending}
              onChange={(value) => onFieldChange(student, "pmDismissal", value)}
            />
          </td>
          <td className="col-actions">
            <div className="gate-actions">
              <button
                type="button"
                className="gate-icon-btn"
                title="Follow-up"
                onClick={() => onToggleFollowUp(student.id)}
              >
                Follow-Up
              </button>
              <button
                type="button"
                className="gate-icon-btn"
                title="Parent change: home pickup, address, or daycare"
                onClick={() => onParentChange(student.id)}
              >
                Change
              </button>
              <button
                type="button"
                className={`gate-icon-btn ${first?.transportNotes ? "has-note" : ""}`}
                title="Note"
                aria-label="Note"
                onClick={onToggleNote}
              >
                <NoteIcon />
              </button>
            </div>
            {followUpOpen(student) ? (
              <div className="gate-follow">
                <StatusSelect
                  value={student.amFollowUp}
                  options={AM_FOLLOW_UP}
                  labels={FOLLOW_LABEL}
                  tones={{}}
                  disabled={pending}
                  onChange={(value) =>
                    onFieldChange(student, "amFollowUp", value as AmFollowUp)
                  }
                />
              </div>
            ) : null}
            {pendingChange?.studentId === student.id &&
            pendingChange.needsBusWarning ? (
              <div className="gate-bus-warn">
                Parent pickup — confirm bus?
                <button type="button" onClick={() => onConfirmBus(student)}>
                  Yes
                </button>
                <button type="button" onClick={onKeepPickup}>
                  No
                </button>
              </div>
            ) : null}
          </td>
        </tr>
      ))}
    </>
  );
}

function NoteIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        d="M5 3h11l3 3v15H5V3zm10 1.5V8h3.5L15 4.5zM7 11h10v1.5H7V11zm0 3h10v1.5H7V14zm0 3h7v1.5H7V17z"
      />
    </svg>
  );
}
