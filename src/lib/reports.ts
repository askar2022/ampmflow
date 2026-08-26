import { generatedStamp, listVersion } from "./dates";
import { planSummary } from "./format";
import type { EffectiveStudent } from "./types";

export type ReportKind =
  | "teacher"
  | "master"
  | "bus"
  | "pickup"
  | "changes"
  | "missing"
  | "company";

export function reportTitle(kind: ReportKind, extra?: string) {
  switch (kind) {
    case "teacher":
      return extra ? `Classroom list — ${extra}` : "Teacher classroom lists";
    case "master":
      return "Master dismissal list";
    case "bus":
      return extra ? `Bus ${extra}` : "Bus lists";
    case "pickup":
      return "Parent-pickup list";
    case "changes":
      return "Temporary changes only";
    case "missing":
      return "Missing assignments";
    case "company":
      return "Bus-company change report";
  }
}

export function stamp() {
  return {
    generated: generatedStamp(),
    version: listVersion(),
  };
}

export function groupByTeacher(students: EffectiveStudent[]) {
  const map = new Map<string, EffectiveStudent[]>();
  for (const student of students) {
    const key = `${student.teacherName} · ${student.classroomName}`;
    const list = map.get(key) ?? [];
    list.push(student);
    map.set(key, list);
  }
  return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
}

export function groupByBus(students: EffectiveStudent[], trip: "AM" | "PM" = "PM") {
  const map = new Map<string, EffectiveStudent[]>();
  for (const student of students) {
    const plan = trip === "AM" ? student.am : student.pm;
    if (plan.type !== "BUS" || !plan.busNumber) continue;
    const list = map.get(plan.busNumber) ?? [];
    list.push(student);
    map.set(plan.busNumber, list);
  }
  return [...map.entries()].sort(([a], [b]) => Number(a) - Number(b));
}

export function pickupList(students: EffectiveStudent[], trip: "AM" | "PM" = "PM") {
  return students.filter((s) => (trip === "AM" ? s.am : s.pm).type === "PARENT");
}

export function changeList(students: EffectiveStudent[]) {
  return students.filter(
    (s) =>
      s.am.source === "TODAY" ||
      s.am.source === "DATE_RANGE" ||
      s.pm.source === "TODAY" ||
      s.pm.source === "DATE_RANGE",
  );
}

export function missingList(students: EffectiveStudent[]) {
  return students.filter((s) => {
    const missing = (plan: EffectiveStudent["am"]) =>
      plan.source === "MISSING" ||
      plan.waitingForAssignment ||
      (plan.type === "BUS" && !plan.busNumber);
    return missing(s.am) || missing(s.pm);
  });
}

export function companyReportText(students: EffectiveStudent[]) {
  const header = stamp();
  const waiting = students.filter(
    (s) => s.am.waitingForAssignment || s.pm.waitingForAssignment,
  );
  const changes = changeList(students).filter(
    (s) =>
      s.am.type === "BUS" ||
      s.pm.type === "BUS" ||
      s.am.waitingForAssignment ||
      s.pm.waitingForAssignment,
  );

  const lines = [
    "ampmflow",
    "Transportation change report",
    header.generated,
    header.version,
    "",
    `Students waiting for a bus assignment: ${waiting.length}`,
    ...waiting.map(
      (s) =>
        `- ${s.fullName} (${s.studentId})  AM: ${planSummary(s.am, "AM")}  |  PM: ${planSummary(s.pm, "PM")}  |  ${s.homeAddress}`,
    ),
    "",
    `Bus-related temporary changes today: ${changes.length}`,
    ...changes.map(
      (s) =>
        `- ${s.fullName} (${s.studentId})  AM: ${planSummary(s.am, "AM")}  |  PM: ${planSummary(s.pm, "PM")}  |  Home: ${s.homeAddress}${s.daycareName ? `  |  Daycare: ${s.daycareName}` : ""}`,
    ),
  ];
  return lines.join("\n");
}
