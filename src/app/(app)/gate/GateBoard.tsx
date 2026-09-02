"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { applyFamilyGate, updateGateField } from "@/app/actions/gate";
import { formatDateTime } from "@/lib/dates";
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
  type AmArrival,
  type AmFollowUp,
  type GateStudent,
  type PmDismissal,
} from "@/lib/gate"; // AmArrival/PmDismissal used by family plan state

function stamp(value: string | null) {
  if (!value) return "Not updated yet";
  return formatDateTime(value);
}

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

export function GateBoard({
  students,
  lastUpdated,
}: {
  students: GateStudent[];
  lastUpdated: string;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "am" | "pm">("all");
  const [pending, start] = useTransition();
  const [message, setMessage] = useState("");
  const [familyPlan, setFamilyPlan] = useState<
    Record<string, { am: AmArrival; pm: PmDismissal }>
  >({});
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
    if (filter === "am") {
      rows = rows.filter((s) => s.amArrival === "NOT_CHECKED_IN");
    } else if (filter === "pm") {
      rows = rows.filter((s) => s.pmDismissal === "NOT_CONFIRMED");
    }
    return rows;
  }, [students, query, filter]);

  const families = useMemo(() => groupFamilies(visible), [visible]);

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
          `${conflict.name} was just updated by someone else. The board refreshed — check the current status and try again.`,
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

  return (
    <div className="space-y-4">
      <div className="no-print rounded-2xl border border-line bg-card p-4 sm:p-5">
        <label className="block text-sm font-semibold text-navy" htmlFor="gate-search">
          Search student, parent, phone, family ID, or address
        </label>
        <input
          id="gate-search"
          autoFocus
          className="mt-2 min-h-14 w-full rounded-xl border border-line px-4 text-lg"
          placeholder="Type a name, phone, family ID, or street"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <div className="mt-3 flex flex-wrap gap-2">
          {[
            ["all", "All families"],
            ["am", "Not checked in"],
            ["pm", "PM not confirmed"],
          ].map(([id, label]) => (
            <button
              key={id}
              type="button"
              className={`rounded-full px-3 py-1.5 text-sm font-semibold ${
                filter === id
                  ? "bg-navy text-white"
                  : "border border-line bg-white"
              }`}
              onClick={() => setFilter(id as typeof filter)}
            >
              {label}
            </button>
          ))}
        </div>
        <p className="mt-3 text-sm text-muted">
          {families.length} families · {visible.length} students · Last updated{" "}
          {lastUpdated}
          {pending ? " · Saving…" : ""}
        </p>
        {message ? (
          <p className="mt-2 text-sm font-semibold text-navy">{message}</p>
        ) : null}
      </div>

      {families.map((family) => (
        <section
          key={family.familyId}
          className="rounded-2xl border border-line bg-card p-4 sm:p-5 print-sheet"
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="font-serif text-2xl">
                {family.parentName}{" "}
                <span className="text-base font-sans text-muted">
                  · {family.familyKey}
                </span>
              </h2>
              <p className="mt-1 text-sm">
                {family.parentPhone} · {family.address}, {family.city} {family.zip}
              </p>
              <p className="text-sm text-muted">
                {family.students.length}{" "}
                {family.students.length === 1 ? "student" : "siblings"}
              </p>
              {family.reviewNeeded ? (
                <p className="mt-2 rounded-lg bg-orange-50 px-3 py-2 text-sm font-semibold text-orange-900">
                  Review possible siblings: {family.reviewNote || "Staff should confirm this family."}
                </p>
              ) : null}
            </div>
            <div className="no-print flex min-w-[260px] flex-col gap-2">
              <StatusSelect
                value={familyPlan[family.familyId]?.am || family.students[0].amArrival}
                options={AM_ARRIVAL}
                labels={AM_LABEL}
                tones={AM_TONE}
                disabled={pending}
                onChange={(am) =>
                  setFamilyPlan((prev) => ({
                    ...prev,
                    [family.familyId]: {
                      am,
                      pm:
                        prev[family.familyId]?.pm ||
                        family.students[0].pmDismissal,
                    },
                  }))
                }
              />
              <StatusSelect
                value={familyPlan[family.familyId]?.pm || family.students[0].pmDismissal}
                options={PM_DISMISSAL}
                labels={PM_LABEL}
                tones={PM_TONE}
                disabled={pending}
                onChange={(pm) =>
                  setFamilyPlan((prev) => ({
                    ...prev,
                    [family.familyId]: {
                      am:
                        prev[family.familyId]?.am ||
                        family.students[0].amArrival,
                      pm,
                    },
                  }))
                }
              />
              <textarea
                className="min-h-16 rounded-xl border border-line px-3 py-2 text-sm"
                placeholder="Optional transportation notes"
                defaultValue={family.students[0]?.transportNotes || ""}
                onBlur={(event) => {
                  const notes = event.target.value;
                  if (notes === (family.students[0]?.transportNotes || "")) return;
                  start(async () => {
                    await updateGateField({
                      studentId: family.students[0].id,
                      field: "transportNotes",
                      value: notes,
                    });
                    router.refresh();
                  });
                }}
              />
              <button
                type="button"
                className="action-button rounded-xl px-4 py-2 text-sm font-bold"
                onClick={() => {
                  const first = family.students[0];
                  const plan = familyPlan[family.familyId] || {
                    am: first.amArrival,
                    pm: first.pmDismissal,
                  };
                  const names = family.students.map((s) => s.fullName).join(", ");
                  if (
                    !window.confirm(
                      `Apply ${AM_LABEL[plan.am]} and ${PM_LABEL[plan.pm]} to every sibling?\n\n${names}`,
                    )
                  ) {
                    return;
                  }
                  start(async () => {
                    const result = await applyFamilyGate({
                      studentId: first.id,
                      amArrival: plan.am,
                      pmDismissal: plan.pm,
                      confirmed: true,
                    });
                    setMessage(
                      result.ok
                        ? `Updated ${result.count} siblings.`
                        : result.error || "Could not update the family.",
                    );
                    router.refresh();
                  });
                }}
              >
                Apply AM + PM to all siblings
              </button>
            </div>
          </div>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="text-muted">
                <tr>
                  <th className="py-2 pr-3">Student</th>
                  <th className="pr-3">AM Arrival Status</th>
                  <th className="pr-3">AM Follow-Up Outcome</th>
                  <th className="pr-3">PM Dismissal Today</th>
                </tr>
              </thead>
              <tbody>
                {family.students.map((student) => (
                  <tr key={student.id} className={`row-${AM_TONE[student.amArrival]}`}>
                    <td className="py-3 pr-3 align-top">
                      <div className="font-semibold">{student.fullName}</div>
                      <div className="text-muted">
                        {student.grade} · {student.teacherName}
                      </div>
                      <div className="text-xs text-muted">
                        {student.enrollmentSource === "NEW_APPLICATION"
                          ? "New Application"
                          : "Returning"}
                      </div>
                      {student.nameDupCount > 1 ? (
                        <div className="mt-1 text-xs font-semibold text-red">
                          Duplicate name — confirm parent {student.parentName} or{" "}
                          {student.parentPhone}
                        </div>
                      ) : null}
                      {identityFor === student.id && pendingChange?.needsIdentity ? (
                        <label className="mt-2 flex items-start gap-2 text-xs font-semibold">
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
                          I confirmed this is {student.fullName}, parent{" "}
                          {student.parentName}, {student.parentPhone}.
                        </label>
                      ) : null}
                    </td>
                    <td className="pr-3 align-top">
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
                      <p className="mt-1 text-xs text-muted">
                        {AM_LABEL[student.amArrival]}
                        {student.amArrivalAt
                          ? ` · ${stamp(student.amArrivalAt)}`
                          : ""}
                      </p>
                    </td>
                    <td className="pr-3 align-top">
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
                    </td>
                    <td className="align-top">
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
                      <p className="mt-1 text-xs text-muted">
                        {PM_LABEL[student.pmDismissal]}
                        {student.updatedAt
                          ? ` · ${student.updatedByName} · ${stamp(student.updatedAt)}`
                          : ""}
                      </p>
                      {student.vehicleName !== "Not Assigned" ? (
                        <p className="mt-1 text-xs">
                          Assigned later: {student.vehicleName}
                          {student.driverName ? ` · ${student.driverName}` : ""}
                          {student.driverPhone ? ` · ${student.driverPhone}` : ""}
                        </p>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {family.students.map((student) =>
            pendingChange?.studentId === student.id &&
            pendingChange.needsBusWarning ? (
              <div
                key={`${student.id}-warn`}
                className="mt-3 rounded-xl border border-red bg-red-50 p-3 text-sm no-print"
              >
                <p className="font-semibold">
                  {student.fullName} is parent pickup today. Do not place this
                  student on a bus unless you are sure.
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="action-button rounded-lg px-3 py-2 text-sm font-bold"
                    onClick={() =>
                      runUpdate(
                        student,
                        "pmDismissal",
                        "CONFIRMED_BUS",
                        { warnPickupToBus: true },
                      )
                    }
                  >
                    Yes — Confirmed Bus today
                  </button>
                  <button
                    type="button"
                    className="action-button-secondary rounded-lg px-3 py-2 text-sm font-bold"
                    onClick={() => setPendingChange(null)}
                  >
                    Keep parent pickup
                  </button>
                </div>
              </div>
            ) : null,
          )}
        </section>
      ))}

      {!families.length ? (
        <p className="rounded-2xl border border-line bg-card p-6 text-muted">
          {query
            ? "No student or parent matches that search."
            : "No students match this filter."}
        </p>
      ) : null}
    </div>
  );
}
