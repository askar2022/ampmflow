import * as XLSX from "xlsx";
import { planSummary } from "./format";
import { todayKey } from "./dates";
import {
  changeList,
  groupByBus,
  groupByTeacher,
  missingList,
  pickupList,
  reportTitle,
  stamp,
  type ReportKind,
} from "./reports";
import type { CheckInBusSummary } from "./operations";
import type { EffectiveStudent } from "./types";

function fileName(kind: ReportKind) {
  const slug = reportTitle(kind)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return `ampmflow-${slug}-${todayKey()}.xlsx`;
}

function studentRow(student: EffectiveStudent, extra: Record<string, string> = {}) {
  return {
    Student: student.fullName,
    "Student ID": student.studentId,
    Grade: student.grade,
    Teacher: student.teacherName,
    "Today PM": planSummary(student.pm, "PM"),
    Location: student.pm.location,
    Address: student.homeAddress,
    ...extra,
  };
}

function sheet(wb: XLSX.WorkBook, name: string, rows: Record<string, unknown>[]) {
  const data = rows.length ? rows : [{ Note: "No rows for this list." }];
  const safe = name.replace(/[:\\/?*[\]]/g, "-").slice(0, 31) || "Sheet";
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data), safe);
}

export function checkInWorkbook(groups: CheckInBusSummary[]) {
  const header = stamp();
  const wb = XLSX.utils.book_new();
  sheet(
    wb,
    "By bus",
    groups.map((group) => ({
      Bus:
        group.busNumber === "No bus yet" ? "Waiting for a bus" : `Bus ${group.busNumber}`,
      "On list": group.onList,
      Rode: group.onBus,
      Missing: group.missing,
      "Not assigned": group.unassigned,
      "Left school": group.leftSchool,
      "Not selected yet": group.notMarked,
      Generated: header.generated,
    })),
  );

  const students = groups.flatMap((group) => {
    const bus =
      group.busNumber === "No bus yet" ? "Waiting for a bus" : `Bus ${group.busNumber}`;
    return [
      ...group.onBusNames.map((name) => ({ Bus: bus, Student: name, Status: "Rode" })),
      ...group.missingNames.map((name) => ({
        Bus: bus,
        Student: name,
        Status: "Missing",
      })),
      ...group.unassignedNames.map((name) => ({
        Bus: bus,
        Student: name,
        Status: "Not assigned",
      })),
      ...group.leftSchoolNames.map((name) => ({
        Bus: bus,
        Student: name,
        Status: "Left school",
      })),
      ...group.notMarkedNames.map((name) => ({
        Bus: bus,
        Student: name,
        Status: "Not selected yet",
      })),
    ];
  });
  sheet(wb, "Students", students);
  return wb;
}

export function studentsWorkbook(
  kind: Exclude<ReportKind, "checkin">,
  students: EffectiveStudent[],
) {
  const header = stamp();
  const wb = XLSX.utils.book_new();
  const note = { Generated: header.generated, Version: header.version };

  if (kind === "teacher") {
    for (const [name, rows] of groupByTeacher(students)) {
      sheet(
        wb,
        name,
        rows.map((student) => studentRow(student, note)),
      );
    }
    if (!groupByTeacher(students).length) {
      sheet(wb, "Classroom", []);
    }
    return wb;
  }

  if (kind === "bus") {
    for (const [number, rows] of groupByBus(students)) {
      sheet(
        wb,
        `Bus ${number}`,
        rows.map((student) => studentRow(student, note)),
      );
    }
    if (!groupByBus(students).length) {
      sheet(wb, "Buses", []);
    }
    return wb;
  }

  const list =
    kind === "pickup"
      ? pickupList(students)
      : kind === "changes"
        ? changeList(students)
        : kind === "missing" || kind === "company"
          ? missingList(students)
          : students;
  sheet(
    wb,
    reportTitle(kind),
    list.map((student) => studentRow(student, note)),
  );
  return wb;
}

export function workbookBytes(wb: XLSX.WorkBook) {
  return new Uint8Array(XLSX.write(wb, { type: "array", bookType: "xlsx" }));
}

export function excelFileName(kind: ReportKind) {
  return fileName(kind);
}
