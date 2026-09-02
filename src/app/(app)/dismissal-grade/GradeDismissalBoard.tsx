"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  emailGradeTeacherAction,
  updateGradeConfirmAction,
} from "@/app/actions/gate";
import { formatDateTime } from "@/lib/dates";
import {
  AM_LABEL,
  AM_TONE,
  GRADE_CONFIRM,
  GRADE_CONFIRM_LABEL,
  PM_LABEL,
  PM_TONE,
  activeDismissalStudents,
  type GateStudent,
  type GradeConfirm,
} from "@/lib/gate";

const PM_ORDER = [
  "PARENT_PICKUP_CONFIRMED",
  "PARENT_PICKUP_TODAY_BUS_TOMORROW",
  "CONFIRMED_BUS",
  "NOT_CONFIRMED",
] as const;

export function GradeDismissalBoard({
  grades,
  selectedGrade,
  students,
  confirmStatus,
  lastUpdated,
}: {
  grades: string[];
  selectedGrade: string;
  students: GateStudent[];
  confirmStatus: GradeConfirm;
  lastUpdated: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [message, setMessage] = useState("");
  const [emailTo, setEmailTo] = useState("");

  const gradeStudents = useMemo(
    () => students.filter((s) => s.grade === selectedGrade),
    [students, selectedGrade],
  );
  const active = useMemo(
    () => activeDismissalStudents(gradeStudents),
    [gradeStudents],
  );
  const excluded = gradeStudents.length - active.length;

  function changeGrade(grade: string) {
    router.push(`/dismissal-grade?grade=${encodeURIComponent(grade)}`);
  }

  return (
    <div className="space-y-6">
      <div className="no-print flex flex-wrap items-end gap-3">
        <label className="block">
          <span className="text-sm font-semibold">Grade/Class</span>
          <select
            className="gate-select mt-1 min-w-[220px]"
            value={selectedGrade}
            onChange={(event) => changeGrade(event.target.value)}
          >
            {grades.map((grade) => (
              <option key={grade} value={grade}>
                {grade}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="text-sm font-semibold">Grade confirmation</span>
          <select
            className="gate-select mt-1 min-w-[220px]"
            value={confirmStatus}
            disabled={pending}
            onChange={(event) => {
              start(async () => {
                await updateGradeConfirmAction(
                  selectedGrade,
                  event.target.value as GradeConfirm,
                );
                router.refresh();
              });
            }}
          >
            {GRADE_CONFIRM.map((status) => (
              <option key={status} value={status}>
                {GRADE_CONFIRM_LABEL[status]}
              </option>
            ))}
          </select>
        </label>
      </div>

      <p className="text-sm text-muted">
        {selectedGrade}: {active.length} arrived students on the dismissal list
        {excluded
          ? ` · ${excluded} not checked in or confirmed absent are excluded`
          : ""}
        . Last updated {lastUpdated}.
      </p>

      <div className="no-print flex flex-wrap gap-2">
        <button
          type="button"
          className="action-button-secondary rounded-xl px-4 py-2 text-sm font-bold"
          onClick={() => window.print()}
        >
          Preview Grade
        </button>
        <button
          type="button"
          className="action-button-secondary rounded-xl px-4 py-2 text-sm font-bold"
          onClick={() => window.print()}
        >
          Print Grade
        </button>
        <a
          className="action-button-secondary rounded-xl px-4 py-2 text-sm font-bold"
          href={`/dismissal-grade/export?grade=${encodeURIComponent(selectedGrade)}`}
        >
          Export Grade to Excel
        </a>
        <input
          className="min-h-10 rounded-xl border border-line px-3 text-sm"
          placeholder="Teacher email (optional)"
          value={emailTo}
          onChange={(event) => setEmailTo(event.target.value)}
        />
        <button
          type="button"
          className="action-button rounded-xl px-4 py-2 text-sm font-bold"
          disabled={pending}
          onClick={() => {
            start(async () => {
              const result = await emailGradeTeacherAction(
                selectedGrade,
                emailTo,
              );
              setMessage(
                result.ok
                  ? `Emailed ${selectedGrade} only to ${result.to.join(", ")}.`
                  : result.error || "Email failed.",
              );
            });
          }}
        >
          Email Grade Teacher
        </button>
      </div>
      {message ? <p className="text-sm font-semibold">{message}</p> : null}

      {PM_ORDER.map((status) => {
        const rows = active.filter((s) => s.pmDismissal === status);
        return (
          <section
            key={status}
            className={`rounded-2xl border p-4 print-sheet ${
              status === "NOT_CONFIRMED"
                ? "border-yellow bg-yellow-50"
                : "border-line bg-card"
            }`}
          >
            <h2 className="font-serif text-2xl">
              {PM_LABEL[status]}{" "}
              <span className="text-base font-sans text-muted">
                ({rows.length})
              </span>
            </h2>
            {status === "NOT_CONFIRMED" ? (
              <p className="mt-1 font-semibold text-yellow">
                Needs immediate follow-up. These students arrived but dismissal
                is not confirmed.
              </p>
            ) : null}
            {rows.length ? (
              <table className="mt-3 w-full text-left text-sm">
                <thead className="text-muted">
                  <tr>
                    <th className="py-2">Student</th>
                    <th>Grade</th>
                    <th>Teacher/Class</th>
                    <th>AM Arrival</th>
                    <th>PM Dismissal</th>
                    <th>Last updated</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((student) => (
                    <tr key={student.id}>
                      <td className="py-2 font-semibold">{student.fullName}</td>
                      <td>{student.grade}</td>
                      <td>{student.teacherName}</td>
                      <td>
                        <span className={`status-pill tone-${AM_TONE[student.amArrival]}`}>
                          {AM_LABEL[student.amArrival]}
                        </span>
                      </td>
                      <td>
                        <span className={`status-pill tone-${PM_TONE[student.pmDismissal]}`}>
                          {PM_LABEL[student.pmDismissal]}
                        </span>
                      </td>
                      <td>
                        {student.updatedAt
                          ? formatDateTime(student.updatedAt)
                          : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="mt-2 text-sm text-muted">None in this group.</p>
            )}
          </section>
        );
      })}
    </div>
  );
}
