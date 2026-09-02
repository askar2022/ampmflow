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
import {
  AM_LABEL,
  PM_LABEL,
  groupConfirmedBus,
  parentPickupToday,
  type GateStudent,
} from "./gate";

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
  const students = groups.flatMap((group) => {
    const bus =
      group.busNumber === "No bus yet" ? "Waiting for a bus" : `Bus ${group.busNumber}`;
    return [
      ...group.onBusNames.map((name) => ({
        Bus: bus,
        Student: name,
        Status: "Rode",
        Generated: header.generated,
      })),
      ...group.missingNames.map((name) => ({
        Bus: bus,
        Student: name,
        Status: "Missing",
        Generated: header.generated,
      })),
      ...group.unassignedNames.map((name) => ({
        Bus: bus,
        Student: name,
        Status: "Not assigned",
        Generated: header.generated,
      })),
      ...group.leftSchoolNames.map((name) => ({
        Bus: bus,
        Student: name,
        Status: "Left school",
        Generated: header.generated,
      })),
      ...group.notMarkedNames.map((name) => ({
        Bus: bus,
        Student: name,
        Status: "Not selected yet",
        Generated: header.generated,
      })),
    ];
  });
  sheet(wb, "Students", students);
  sheet(
    wb,
    "By bus",
    groups.map((group) => ({
      Bus:
        group.busNumber === "No bus yet" ? "Waiting for a bus" : `Bus ${group.busNumber}`,
      "On list": group.onList,
      Rode: group.onBus,
      "Who rode": group.onBusNames.join(", "),
      Missing: group.missing,
      "Who is missing": group.missingNames.join(", "),
      "Not assigned": group.unassigned,
      "Who is not assigned": group.unassignedNames.join(", "),
      "Left school": group.leftSchool,
      "Who left school": group.leftSchoolNames.join(", "),
      "Not selected yet": group.notMarked,
      "Who is not selected yet": group.notMarkedNames.join(", "),
      Generated: header.generated,
    })),
  );
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

function gateRow(student: GateStudent, extra: Record<string, string> = {}) {
  return {
    Student: student.fullName,
    "Student ID": student.studentId,
    Grade: student.grade,
    Teacher: student.teacherName,
    Family: student.familyKey,
    Parent: student.parentName,
    Phone: student.parentPhone,
    "AM Arrival": AM_LABEL[student.amArrival],
    "PM Dismissal": PM_LABEL[student.pmDismissal],
    Vehicle: student.tempVehicleName || student.vehicleName,
    Address: [student.address, student.city, student.zip].filter(Boolean).join(", "),
    ...extra,
  };
}

export function gateDismissalWorkbook(
  kind: "bus" | "pickup",
  students: GateStudent[],
) {
  const header = stamp();
  const wb = XLSX.utils.book_new();
  const note = { Generated: header.generated, Version: header.version };
  if (kind === "bus") {
    const groups = groupConfirmedBus(students);
    if (!groups.length) sheet(wb, "Buses", []);
    for (const [name, rows] of groups) {
      sheet(wb, name, rows.map((student) => gateRow(student, note)));
    }
    return wb;
  }
  sheet(
    wb,
    "Parent Pickup",
    parentPickupToday(students).map((student) => gateRow(student, note)),
  );
  return wb;
}
