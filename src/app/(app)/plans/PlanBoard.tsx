"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addSchoolBus, setRegularPlan } from "@/app/actions/plans";
import { usablePhone } from "@/lib/gate";
import { choiceFromSnapshot, encodePlanChoice, planChoiceLabel } from "@/lib/plans";
import { searchStudents } from "@/lib/transportation";
import type { EffectiveStudent, Trip } from "@/lib/types";

function optionsFor(trip: Trip, buses: string[]) {
  return [
    { value: "", label: "Not set" },
    {
      value: "parent-home",
      label: trip === "AM" ? "Parent drop-off from home" : "Parent pickup at home",
    },
    ...buses.map((bus) => ({
      value: encodePlanChoice({ kind: "bus-home", bus }),
      label: trip === "AM" ? `Bus ${bus} from home` : `Bus ${bus} home`,
    })),
    ...buses.map((bus) => ({
      value: encodePlanChoice({ kind: "bus-daycare", bus }),
      label: trip === "AM" ? `Bus ${bus} from daycare` : `Bus ${bus} to daycare`,
    })),
  ];
}

export function PlanBoard({
  students,
  busNumbers,
}: {
  students: EffectiveStudent[];
  busNumbers: string[];
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "missing" | "bus" | "parent">("all");
  const [pending, start] = useTransition();
  const [message, setMessage] = useState("");
  const [buses, setBuses] = useState(busNumbers);
  const [newBus, setNewBus] = useState("");

  const visible = useMemo(() => {
    let rows = searchStudents(students, query);
    if (filter === "missing") {
      rows = rows.filter((s) => !s.am.type || !s.pm.type);
    }
    if (filter === "bus") {
      rows = rows.filter((s) => s.am.type === "BUS" || s.pm.type === "BUS");
    }
    if (filter === "parent") {
      rows = rows.filter((s) => s.am.type === "PARENT" || s.pm.type === "PARENT");
    }
    return rows;
  }, [students, query, filter]);

  const missing = students.filter((s) => !s.am.type || !s.pm.type).length;
  const amOptions = optionsFor("AM", buses);
  const pmOptions = optionsFor("PM", buses);

  function save(
    student: EffectiveStudent,
    trip: Trip,
    value: string,
    applyFamily?: boolean,
  ) {
    start(async () => {
      const result = await setRegularPlan({
        studentId: student.id,
        trip,
        value,
        applyFamily,
      });
      setMessage(
        result.ok
          ? applyFamily
            ? `Saved ${trip} for ${result.count} children in this family.`
            : `Saved ${student.fullName} ${trip}.`
          : result.error,
      );
      router.refresh();
    });
  }

  function addBus(event: React.FormEvent) {
    event.preventDefault();
    start(async () => {
      const result = await addSchoolBus(newBus);
      if (!result.ok) {
        setMessage(result.error);
        return;
      }
      setBuses(result.numbers);
      setNewBus("");
      setMessage(`Bus ${newBus.replace(/^Bus\s+/i, "").trim()} is ready for AM and PM.`);
      router.refresh();
    });
  }

  return (
    <div className="gate-page">
      <div className="gate-toolbar no-print">
        <input
          className="gate-search"
          placeholder="Search name, phone, grade, or bus"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <div className="gate-toolbar-row">
          {(
            [
              ["all", "All"],
              ["missing", "Still missing a plan"],
              ["bus", "Has a bus"],
              ["parent", "Has parent"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              className={`gate-chip ${filter === id ? "is-on" : ""}`}
              onClick={() => setFilter(id)}
            >
              {label}
            </button>
          ))}
          <span className="gate-meta">
            {visible.length} students · {missing} still missing AM or PM
            {pending ? " · Saving…" : ""}
            {message ? ` · ${message}` : ""}
          </span>
        </div>
        <form className="gate-toolbar-row" onSubmit={addBus}>
          <span className="gate-meta">
            Buses: {buses.length ? buses.map((n) => `Bus ${n}`).join(", ") : "none yet"}
          </span>
          <input
            className="gate-search"
            style={{ maxWidth: "10rem" }}
            placeholder="New bus #"
            value={newBus}
            onChange={(event) => setNewBus(event.target.value)}
          />
          <button type="submit" className="gate-link" disabled={pending || !newBus.trim()}>
            Add AM + PM bus
          </button>
        </form>
      </div>

      <table className="gate-table">
        <thead>
          <tr>
            <th className="col-student">Student</th>
            <th className="col-grade">Grade</th>
            <th className="col-am">AM morning</th>
            <th className="col-pm">PM afternoon</th>
            <th className="col-actions">Family</th>
          </tr>
        </thead>
        <tbody>
          {visible.map((student) => {
            const phone = usablePhone(student.parentPhone);
            const siblingCount = phone
              ? students.filter((row) => usablePhone(row.parentPhone) === phone).length
              : 1;
            return (
              <tr key={student.id} className="gate-row">
                <td className="col-student">
                  <span className="gate-name">{student.fullName}</span>
                  <div className="text-xs text-muted">{student.parentName}</div>
                </td>
                <td>{student.grade}</td>
                <td>
                  <select
                    className="gate-note"
                    style={{ minHeight: "2.25rem", width: "100%" }}
                    value={choiceFromSnapshot(student.am)}
                    disabled={pending}
                    onChange={(event) => save(student, "AM", event.target.value)}
                  >
                    {amOptions.map((option) => (
                      <option key={option.value || "unset"} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                    {choiceFromSnapshot(student.am) &&
                    !amOptions.some((option) => option.value === choiceFromSnapshot(student.am)) ? (
                      <option value={choiceFromSnapshot(student.am)}>
                        {planChoiceLabel(choiceFromSnapshot(student.am), "AM")}
                      </option>
                    ) : null}
                  </select>
                </td>
                <td>
                  <select
                    className="gate-note"
                    style={{ minHeight: "2.25rem", width: "100%" }}
                    value={choiceFromSnapshot(student.pm)}
                    disabled={pending}
                    onChange={(event) => save(student, "PM", event.target.value)}
                  >
                    {pmOptions.map((option) => (
                      <option key={option.value || "unset"} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                    {choiceFromSnapshot(student.pm) &&
                    !pmOptions.some((option) => option.value === choiceFromSnapshot(student.pm)) ? (
                      <option value={choiceFromSnapshot(student.pm)}>
                        {planChoiceLabel(choiceFromSnapshot(student.pm), "PM")}
                      </option>
                    ) : null}
                  </select>
                </td>
                <td>
                  {siblingCount > 1 ? (
                    <button
                      type="button"
                      className="gate-link"
                      disabled={pending}
                      onClick={() => {
                        if (
                          !window.confirm(
                            `Copy ${student.fullName}'s AM and PM to ${siblingCount} children with the same parent phone?`,
                          )
                        ) {
                          return;
                        }
                        start(async () => {
                          const am = await setRegularPlan({
                            studentId: student.id,
                            trip: "AM",
                            value: choiceFromSnapshot(student.am),
                            applyFamily: true,
                          });
                          const pm = await setRegularPlan({
                            studentId: student.id,
                            trip: "PM",
                            value: choiceFromSnapshot(student.pm),
                            applyFamily: true,
                          });
                          setMessage(
                            am.ok && pm.ok
                              ? `Saved AM and PM for ${pm.count} children.`
                              : am.ok
                                ? am.error || pm.error || "Could not save the family PM plan."
                                : am.error,
                          );
                          router.refresh();
                        });
                      }}
                    >
                      Apply to {siblingCount}
                    </button>
                  ) : (
                    <span className="text-xs text-muted">1 child</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
