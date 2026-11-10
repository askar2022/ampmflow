"use server";

import { randomUUID } from "crypto";
import * as XLSX from "xlsx";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { writeAudit } from "@/lib/audit";
import {
  digitsPhone,
  ensureGateTables,
  normAddress,
  normName,
  saveImportSummary,
  usablePhone,
} from "@/lib/gate";
import { ensureStudentContactColumns, parentNameFromEmail } from "@/lib/transportation";

type Row = Record<string, string>;

function normHeader(value: string) {
  return value
    .toLowerCase()
    .replace(/[_./]+/g, " ")
    .replace(/[()]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function cell(row: Row, ...keys: string[]) {
  const headers = Object.keys(row);
  const wantedList = keys.map(normHeader).filter(Boolean);
  for (const wanted of wantedList) {
    const match = headers.find((header) => normHeader(header) === wanted);
    if (match && row[match] != null && String(row[match]).trim()) {
      return String(row[match]).trim();
    }
  }
  for (const wanted of wantedList) {
    if (wanted.length < 8) continue;
    const match = headers.find((header) => normHeader(header).includes(wanted));
    if (match && row[match] != null && String(row[match]).trim()) {
      return String(row[match]).trim();
    }
  }
  if (keys.some((key) => normHeader(key) === "family id")) {
    const match = headers.find((header) => {
      const name = normHeader(header);
      return name.includes("family id") || name === "fam id" || name === "famid";
    });
    if (match && row[match] != null && String(row[match]).trim()) {
      return String(row[match]).trim();
    }
  }
  return "";
}

function parseCsz(raw: string) {
  const value = raw.trim();
  const match = value.match(/^(.*?)[,\s]+([A-Za-z]{2})\s+(\d{5}(?:-\d{4})?)$/);
  if (!match) return { city: "", state: "", zip: "" };
  return {
    city: match[1].replace(/,$/, "").trim(),
    state: match[2].toUpperCase(),
    zip: match[3],
  };
}

function parentPhonesFromRow(row: Row) {
  const phone1 =
    cell(
      row,
      "prim phone1",
      "primary 1 phone",
      "primary phone 1",
      "phone1",
      "phone 1",
      "parent_phone",
      "parent phone",
      "primary phone",
    ) || "";
  const phone2 = cell(
    row,
    "prim phone2",
    "primary 2 phone",
    "primary phone 2",
    "phone2",
    "phone 2",
    "parent phone 2",
    "parent_phone2",
  );
  return { phone1, phone2 };
}

function parentNameFromRow(row: Row, email: string) {
  const first = cell(row, "parent_first_name", "parent first name", "guardian first name");
  const last = cell(row, "parent_last_name", "parent last name", "guardian last name");
  if (first || last) return [first, last].filter(Boolean).join(" ");

  const headers = Object.keys(row);
  const wanted = [
    "parent/guardian",
    "parent name",
    "parent_name",
    "guardian name",
    "guardian",
    "mother name",
    "father name",
    "primary contact",
    "contact name",
  ];
  for (const key of wanted) {
    const match = headers.find((header) => {
      const name = header.trim().toLowerCase();
      if (
        name.includes("email") ||
        name.includes("phone") ||
        name.includes("address") ||
        name.includes("first") ||
        name.includes("last")
      ) {
        return false;
      }
      return name === key || (key.length >= 5 && name.includes(key));
    });
    const value = match ? String(row[match] || "").trim() : "";
    if (value && !value.includes("@")) return value;
  }
  return parentNameFromEmail(email) || "—";
}

function splitHomeAddress(raw: string) {
  const value = raw.trim();
  const parts = value.split(",").map((part) => part.trim()).filter(Boolean);
  if (parts.length >= 3) {
    const tail = parts[parts.length - 1];
    const stateZip = tail.match(/^([A-Za-z]{2})\s+(\d{5}(?:-\d{4})?)$/);
    if (stateZip) {
      return {
        line1: parts.slice(0, -2).join(", "),
        city: parts[parts.length - 2],
        state: stateZip[1].toUpperCase(),
        zip: stateZip[2],
      };
    }
  }
  return { line1: value || "Address pending", city: "", state: "", zip: "" };
}

function parseType(value: string): "BUS" | "PARENT" | null {
  const v = value.toLowerCase();
  if (!v) return null;
  if (v.includes("parent") || v.includes("pickup") || v.includes("drop")) {
    return "PARENT";
  }
  if (v.includes("bus") || /^\d+$/.test(v)) return "BUS";
  return null;
}

function studentNamesFromRow(row: Row) {
  const fullName = cell(row, "lfname", "lf name", "full name", "student name");
  const names = splitName(fullName);
  return {
    first:
      cell(
        row,
        "name (first)",
        "name first",
        "student first name",
        "first_name",
        "first name",
      ) || names.first,
    last:
      cell(
        row,
        "name (last)",
        "name last",
        "student last name",
        "last_name",
        "last name",
      ) || names.last,
  };
}

function splitName(fullName: string) {
  const trimmed = fullName.trim();
  if (trimmed.includes(",")) {
    const [last, ...rest] = trimmed.split(",").map((part) => part.trim());
    const first = rest.join(" ").trim();
    if (first && last) return { first, last };
  }
  const parts = trimmed.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { first: "", last: "" };
  if (parts.length === 1) return { first: parts[0], last: "—" };
  return { first: parts[0], last: parts.slice(1).join(" ") };
}

const HEADER_ALIASES = new Set([
  "student_id",
  "id",
  "student id",
  "student",
  "name",
  "full name",
  "first_name",
  "first name",
  "student first name",
  "last_name",
  "last name",
  "student last name",
  "grade",
  "teacher",
  "teacher_name",
  "teacher name",
  "advisor",
  "advisor name",
  "name (last)",
  "name (first)",
  "name last",
  "name first",
  "prim city",
  "prim c s z",
  "prim_c_s_z",
  "prim email",
  "routebusnum",
  "route bus num",
  "routevannum",
  "busloc1 routebusnum",
  "transportation_type",
  "vehicle_name",
  "parent_first_name",
  "parent_last_name",
  "parent_email",
  "parent_phone",
  "home_address",
  "classroom",
  "room",
  "am",
  "pm",
  "am_type",
  "pm_type",
  "am_bus",
  "pm_bus",
  "family id",
  "family_id",
  "parent/guardian",
  "primary phone",
  "prim phone1",
  "prim phone2",
  "primary 1 phone",
  "primary 2 phone",
  "lfname",
  "lf name",
  "prim address",
  "parent email",
  "email",
  "address",
  "van",
  "zip code",
  "enrollment status",
  "source",
  "addr line1",
  "addr line 1",
  "address line 1",
  "city/state/zip",
  "city state zip",
  "phone number",
  "pickup time",
  "am pickup",
  "pm pickup",
]);

const POSITIONAL_KEYS = ["id", "student", "grade", "teacher", "room", "am", "pm"];

const NAME_LAST_FIRST =
  /^[A-Za-z][A-Za-z'\-.]*\s*,\s*[A-Za-z][A-Za-z'\-.]*(?:\s+[A-Za-z][A-Za-z'\-.]*)*$/;
const NAME_FIRST_LAST =
  /^[A-Za-z][A-Za-z'\-.]*\s+[A-Za-z][A-Za-z'\-.]+(?:\s+[A-Za-z][A-Za-z'\-.]+)?$/;

function sheetMatrix(sheet: XLSX.WorkSheet) {
  const matrix = XLSX.utils.sheet_to_json<(string | number)[]>(sheet, {
    header: 1,
    defval: "",
    raw: false,
  });
  return matrix.map((line) =>
    line.map((value) => String(value ?? "").trim()),
  );
}

function nonEmptyLines(matrix: string[][]) {
  return matrix.filter((line) => line.some(Boolean));
}

function cleanSheetName(sheetName: string) {
  return sheetName
    .replace(/[\u00a0\u2000-\u200b]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function looksLikePersonName(value: string) {
  const clean = value.split("/")[0]?.trim() || "";
  if (!clean || clean.length > 60) return false;
  if (/\d{3,}/.test(clean)) return false;
  if (
    /(street|avenue|road|drive|lane|court|circle|burnsville|eden|minneapolis|minnesota|\bmn\b)/i.test(
      clean,
    )
  ) {
    return false;
  }
  return NAME_LAST_FIRST.test(clean) || NAME_FIRST_LAST.test(clean);
}

function parseSheetRide(sheetName: string) {
  // VAN_6.xlsx, Bus_1_AM, BUS 1PM.xlsx, "NIA Academy Van 6 (AM)", etc.
  const name = cleanSheetName(sheetName)
    .replace(/\.(xlsx|xls|csv)$/i, "")
    .replace(/[_-]+/g, " ")
    // BUS 1PM / Bus1AM → Bus 1 PM / Bus 1 AM
    .replace(/\b(bus|van)\s*#?\s*([0-9]+)\s*(am|pm)\b/gi, "$1 $2 $3")
    .replace(/\b(bus|van)\s*#?\s*([0-9]+)(am|pm)\b/gi, "$1 $2 $3");
  const trip = /\bPM\b/i.test(name) ? "PM" : /\bAM\b/i.test(name) ? "AM" : null;
  const van = name.match(/\bvan\s*#?\s*([0-9]+)\b/i);
  if (van) {
    return {
      kind: "VAN" as const,
      label: `Van ${van[1]}`,
      number: van[1],
      trip,
    };
  }
  const bus = name.match(/\bbus\s*#?\s*([0-9]+)\b/i);
  if (bus) {
    return {
      kind: "BUS" as const,
      label: `Bus ${bus[1]}`,
      number: bus[1],
      trip,
    };
  }
  return null;
}

function looksLikeDayibRouteSheet(lines: string[][], sheetName: string) {
  if (parseSheetRide(sheetName)) return true;
  const sample = lines
    .slice(0, 12)
    .flat()
    .join(" ")
    .toLowerCase();
  if (
    /dayib|attendance sheet|start time|end time|max load|effective dates/.test(
      sample,
    )
  ) {
    return true;
  }
  const nameHits = lines.filter((line) =>
    line.some((cell) => looksLikePersonName(cell) && !cell.includes("/")),
  ).length;
  return nameHits >= 3 && !HEADER_ALIASES.has((lines[0]?.[0] || "").toLowerCase());
}

function isDayibMetaOrStopRow(cells: string[]) {
  const joined = cells.filter(Boolean).join(" ");
  const lower = joined.toLowerCase();
  // Timed stop headers: "7:18 AM Ahmed, Asad / 2100 Cliff Rd..."
  if (/\d{1,2}:\d{2}\s*(am|pm)/i.test(joined) && /\//.test(joined)) return true;
  if (cells.some((cell) => cell.includes("/") && looksLikePersonName(cell))) {
    return true;
  }
  // Top title / run summary block — not student list rows.
  if (
    /dayib bus transportation|attendance sheet|start time|end time|total time|\bdistance\b|max load|effective dates/.test(
      lower,
    )
  ) {
    return true;
  }
  if (/\brun\b/.test(lower) && !cells.some((cell) => looksLikePersonName(cell))) {
    return true;
  }
  return false;
}

function findDayibName(cells: string[]) {
  for (const cell of cells) {
    if (cell.includes("/")) continue;
    const clean = cell.trim();
    if (NAME_LAST_FIRST.test(clean)) return clean;
  }
  for (const cell of cells) {
    if (cell.includes("/")) continue;
    if (looksLikePersonName(cell)) return cell.trim();
  }
  return "";
}

function findDayibPhone(cells: string[]) {
  for (const cell of cells) {
    const match = cell.match(/\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/);
    if (match) return match[0];
  }
  return "";
}

function findDayibAddress(cells: string[], name: string) {
  for (const cell of cells) {
    if (!cell || cell === name) continue;
    if (looksLikePersonName(cell)) continue;
    if (/\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/.test(cell) && cell.length < 20) {
      continue;
    }
    if (
      /\d/.test(cell) &&
      /(st|street|ave|avenue|rd|road|dr|drive|ln|lane|way|ct|court|blvd|circle|cir|apt|mn\b|\d{5})/i.test(
        cell,
      )
    ) {
      return cell.replace(/\s+/g, " ").trim();
    }
  }
  return "";
}

function applySheetRide(row: Row, ride: NonNullable<ReturnType<typeof parseSheetRide>>) {
  // Bus_1_AM.xlsx and Bus_1_PM.xlsx stay separate. Only unnamed rides
  // (VAN_6.xlsx with no AM/PM) get the same assignment on both trips.
  if (ride.kind === "VAN") {
    row.vehicle_name = ride.label;
    row.transportation_type = "VAN";
    row.sheet_ride = `${ride.label}${ride.trip ? ` ${ride.trip}` : ""}`;
    delete row["bus number"];
    delete row["am bus"];
    delete row["pm bus"];
    if (ride.trip === "PM") {
      row.pm = ride.label;
      delete row.am;
    } else if (ride.trip === "AM") {
      row.am = ride.label;
      delete row.pm;
    } else {
      row.am = ride.label;
      row.pm = ride.label;
    }
    return;
  }
  row.transportation_type = "BUS";
  row.sheet_ride = `${ride.label}${ride.trip ? ` ${ride.trip}` : ""}`;
  delete row.vehicle_name;
  if (ride.trip === "PM") {
    row.pm = ride.label;
    row["pm bus"] = ride.number;
    delete row.am;
    delete row["am bus"];
    delete row["bus number"];
  } else if (ride.trip === "AM") {
    row.am = ride.label;
    row["am bus"] = ride.number;
    delete row.pm;
    delete row["pm bus"];
    delete row["bus number"];
  } else {
    row["bus number"] = ride.number;
    row.am = ride.label;
    row.pm = ride.label;
    row["am bus"] = ride.number;
    row["pm bus"] = ride.number;
  }
}

function looksLikeRouteRosterTable(lines: string[][]) {
  if (!lines.length) return false;
  const first = lines[0].map((value) => value.trim().toLowerCase());
  const hasFirst = first.some((value) => value.includes("first name") || value === "first");
  const hasLast = first.some((value) => value.includes("last name") || value === "last");
  const hasAddr = first.some(
    (value) =>
      value.includes("addr") ||
      value.includes("address") ||
      value.includes("phone"),
  );
  return hasFirst && hasLast && hasAddr;
}

function headerIndex(headers: string[], ...wanted: string[]) {
  const list = headers.map((value) => normHeader(value));
  for (const key of wanted) {
    const needle = normHeader(key);
    const hit = list.findIndex(
      (header) => header === needle || header.includes(needle),
    );
    if (hit >= 0) return hit;
  }
  return -1;
}

/** Clean First/Last/Address/Phone/Pickup tables saved as VAN_6.xlsx, Bus_1_AM.xlsx, etc. */
function rowsFromRouteRosterTable(
  lines: string[][],
  ride: NonNullable<ReturnType<typeof parseSheetRide>>,
): Row[] {
  const headers = lines[0].map((value) => value.trim());
  const firstIdx = headerIndex(headers, "first name", "first", "name (first)");
  const lastIdx = headerIndex(headers, "last name", "last", "name (last)");
  const addrIdx = headerIndex(
    headers,
    "addr line1",
    "addr line 1",
    "address line 1",
    "address",
    "home address",
  );
  const cityIdx = headerIndex(
    headers,
    "city/state/zip",
    "city state zip",
    "city",
    "prim c s z",
  );
  const phoneIdx = headerIndex(
    headers,
    "phone number",
    "phone",
    "parent phone",
    "primary 1 phone",
    "prim phone1",
  );
  const pickupIdx = headerIndex(headers, "pickup time", "am pickup", "pickup");
  if (firstIdx < 0 || lastIdx < 0) return [];

  const rows: Row[] = [];
  for (const line of lines.slice(1)) {
    const firstName = (line[firstIdx] || "").trim();
    const lastName = (line[lastIdx] || "").trim();
    if (!firstName || !lastName) continue;
    if (/^first$/i.test(firstName) || /^name$/i.test(firstName)) continue;
    const line1 = addrIdx >= 0 ? (line[addrIdx] || "").trim().replace(/,$/, "") : "";
    const cityZip = cityIdx >= 0 ? (line[cityIdx] || "").trim() : "";
    const address = [line1, cityZip].filter(Boolean).join(", ");
    const phone = phoneIdx >= 0 ? (line[phoneIdx] || "").trim() : "";
    const pickup = pickupIdx >= 0 ? (line[pickupIdx] || "").trim() : "";
    const row: Row = {
      "first name": firstName,
      "last name": lastName,
      "home address": address,
      address,
      "parent phone": phone,
      "primary 1 phone": phone,
      sheet_name: ride.label,
    };
    if (pickup) {
      if (ride.trip === "PM") row["pm pickup"] = pickup;
      else if (ride.trip === "AM") row["am pickup"] = pickup;
      else {
        row["am pickup"] = pickup;
        row["pm pickup"] = pickup;
      }
    }
    applySheetRide(row, ride);
    rows.push(row);
  }
  return rows;
}

function rowsFromDayibRouteSheet(
  lines: string[][],
  sheetName: string,
): Row[] {
  const ride = parseSheetRide(sheetName);
  if (!ride) return [];
  const rows: Row[] = [];
  for (const line of lines) {
    if (isDayibMetaOrStopRow(line)) continue;
    const fullName = findDayibName(line);
    if (!fullName) continue;
    const names = splitName(fullName);
    if (!names.first || !names.last || names.last === "—") continue;
    const address = findDayibAddress(line, fullName);
    const phone = findDayibPhone(line);
    const row: Row = {
      "first name": names.first,
      "last name": names.last,
      "home address": address,
      address,
      "parent phone": phone,
      "primary 1 phone": phone,
      sheet_name: cleanSheetName(sheetName),
    };
    applySheetRide(row, ride);
    rows.push(row);
  }
  return rows;
}

function mergeRouteImportRows(rows: Row[]) {
  const merged = new Map<string, Row>();
  for (const row of rows) {
    const names = studentNamesFromRow(row);
    if (!names.first || !names.last) continue;
    const phone = parentPhonesFromRow(row).phone1;
    const address =
      cell(row, "prim address", "home_address", "home address", "address") || "";
    // Prefer name+phone so empty addresses do not smash different rides together.
    const key = [
      normName(names.first),
      normName(names.last),
      digitsPhone(phone) || normAddress(address) || "noop",
    ].join("|");
    const existing = merged.get(key);
    if (!existing) {
      merged.set(key, { ...row });
      continue;
    }
    // Merge AM from one file with PM from another — never let an AM file wipe PM.
    for (const field of [
      "am",
      "am bus",
      "pm",
      "pm bus",
      "am pickup",
      "pm pickup",
      "vehicle_name",
      "home address",
      "address",
      "parent phone",
      "primary 1 phone",
    ] as const) {
      const value = row[field];
      if (!value) continue;
      if (!existing[field]) existing[field] = value;
    }
    if (row.transportation_type === "VAN" || existing.transportation_type === "VAN") {
      existing.transportation_type =
        existing.transportation_type || row.transportation_type;
      if (row.vehicle_name && !existing.vehicle_name) {
        existing.vehicle_name = row.vehicle_name;
        existing.am = row.am || existing.am;
        existing.pm = row.pm || existing.pm;
      }
    } else {
      existing.transportation_type = "BUS";
    }
    const rides = [existing.sheet_ride, row.sheet_ride].filter(Boolean);
    existing.sheet_ride = [...new Set(rides)].join(" + ");
  }
  return [...merged.values()];
}

function workbookIsRouteBook(workbook: XLSX.WorkBook, fileName = "") {
  if (parseSheetRide(fileName)) return true;
  // One Bus/Van tab is enough — also covers saving a single sheet as its own file.
  if (workbook.SheetNames.some((name) => Boolean(parseSheetRide(name)))) {
    return true;
  }
  for (const name of workbook.SheetNames.slice(0, 3)) {
    const lines = nonEmptyLines(sheetMatrix(workbook.Sheets[name]));
    if (looksLikeDayibRouteSheet(lines, name) || looksLikeRouteRosterTable(lines)) {
      return true;
    }
  }
  return false;
}

function rowsFromRouteSource(
  sheet: XLSX.WorkSheet,
  sheetName: string,
  ride: NonNullable<ReturnType<typeof parseSheetRide>>,
) {
  const lines = nonEmptyLines(sheetMatrix(sheet));
  if (looksLikeRouteRosterTable(lines)) {
    return rowsFromRouteRosterTable(lines, ride);
  }
  const rows = rowsFromDayibRouteSheet(lines, sheetName);
  for (const row of rows) applySheetRide(row, ride);
  return rows;
}

function rowsFromWorkbook(workbook: XLSX.WorkBook, fileName = ""): Row[] {
  const fileRide = parseSheetRide(fileName);
  if (workbookIsRouteBook(workbook, fileName)) {
    const collected: Row[] = [];
    for (const name of workbook.SheetNames) {
      const sheet = workbook.Sheets[name];
      if (!sheet) continue;
      // File name wins (BUS 2PM.xlsx) so an old Excel tab like "Van 2" cannot steal the ride.
      const ride = fileRide || parseSheetRide(name);
      if (!ride) continue;
      collected.push(...rowsFromRouteSource(sheet, name, ride));
    }
    // File named VAN_6.xlsx with a generic Sheet1 tab.
    if (!collected.length && fileRide) {
      const firstName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[firstName];
      if (sheet) collected.push(...rowsFromRouteSource(sheet, firstName, fileRide));
    }
    return mergeRouteImportRows(collected);
  }
  const sheetName =
    workbook.SheetNames.find((name) => /master/i.test(name)) ||
    workbook.SheetNames[0];
  return rowsFromSheet(workbook.Sheets[sheetName], sheetName);
}

function rowsFromSheet(sheet: XLSX.WorkSheet, sheetName = ""): Row[] {
  const lines = nonEmptyLines(sheetMatrix(sheet));
  if (!lines.length) return [];

  if (looksLikeDayibRouteSheet(lines, sheetName)) {
    return rowsFromDayibRouteSheet(lines, sheetName);
  }

  const first = lines[0].map((value) => value.trim().toLowerCase());
  const hasHeader = first.some(
    (value) =>
      HEADER_ALIASES.has(value) ||
      value.includes("first name") ||
      value.includes("last name") ||
      value.includes("name (") ||
      value.includes("lfname") ||
      value.includes("prim phone") ||
      value.includes("prim address") ||
      value.includes("advisor") ||
      value.includes("routebus") ||
      value.includes("family id") ||
      value.includes("enrollment") ||
      value.includes("parent"),
  );
  if (hasHeader) {
    return XLSX.utils.sheet_to_json<Row>(sheet, { defval: "", raw: false });
  }

  return lines.map((line) => {
    const row: Row = {};
    POSITIONAL_KEYS.forEach((key, index) => {
      row[key] = line[index] || "";
    });
    return row;
  });
}

function normalizeGrade(value: string) {
  const raw = value.trim();
  if (!raw || raw === "—") return "—";
  if (/^k(indergarten)?$/i.test(raw) || raw === "0") return "Kindergarten";
  const digits = raw.match(/(\d+)/);
  if (digits) return `Grade ${Number(digits[1])}`;
  return raw;
}

function slugStudentId(first: string, last: string, familyKey: string, index: number) {
  const slug = `${familyKey || "STU"}-${last}-${first}-${index + 1}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
  return slug || `stu-${index + 1}`;
}

function isNotReturning(value: string) {
  const v = value.toLowerCase();
  return v.includes("not returning") || v.includes("withdrawn") || v.includes("inactive");
}

function parsePlan(value: string) {
  const raw = value.trim();
  const v = raw.toLowerCase();
  const dest = v.includes("daycare") ? "DAYCARE" : "HOME";
  const empty = { type: null as "BUS" | "PARENT" | "VAN" | null, bus: "", van: "", dest };
  if (!v) return empty;
  if (
    v.includes("not checked") ||
    v.includes("not confirmed") ||
    v.includes("follow-up") ||
    v.includes("absent")
  ) {
    return empty;
  }
  if (v.includes("van")) {
    const num = raw.match(/(\d+)/);
    return {
      type: "VAN" as const,
      bus: "",
      van: num ? `Van ${num[1]}` : raw.replace(/\s+/g, " "),
      dest,
    };
  }
  if (v.includes("parent") || v.includes("pickup") || v.includes("drop-off")) {
    return { type: "PARENT" as const, bus: "", van: "", dest };
  }
  const busMatch = raw.match(/(\d+)/);
  if (v.includes("bus") || busMatch) {
    return { type: "BUS" as const, bus: busMatch?.[1] || "", van: "", dest };
  }
  return { type: parseType(raw), bus: "", van: "", dest };
}

function newId() {
  return randomUUID().replace(/-/g, "").slice(0, 24);
}

async function ensureVan(schoolId: string, name: string) {
  const label = name.trim();
  const existing = await prisma.$queryRaw<Array<{ id: string }>>`
    SELECT "id" FROM "TransportVehicle"
    WHERE "schoolId" = ${schoolId} AND lower("name") = ${label.toLowerCase()}
  `;
  if (existing[0]) return existing[0].id;
  const id = newId();
  await prisma.$executeRaw`
    INSERT INTO "TransportVehicle"
      ("id", "schoolId", "name", "vehicleType", "driverName", "driverPhone", "createdAt", "updatedAt")
    VALUES
      (${id}, ${schoolId}, ${label}, 'VAN', '', '', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
  `;
  return id;
}

async function applyStudentPlans(args: {
  schoolId: string;
  userId: string;
  studentId: string;
  amType: "BUS" | "PARENT" | "VAN" | null;
  pmType: "BUS" | "PARENT" | "VAN" | null;
  amBus: string;
  pmBus: string;
  amDest: string;
  pmDest: string;
  vanName: string;
  daycareId?: string;
  clearMissingTrips?: boolean;
  amPickupTime?: string;
  pmPickupTime?: string;
}) {
  if (args.clearMissingTrips) {
    if (!args.amType) {
      await prisma.transportationAssignment
        .deleteMany({ where: { studentId: args.studentId, trip: "AM" } })
        .catch(() => undefined);
    }
    if (!args.pmType) {
      await prisma.transportationAssignment
        .deleteMany({ where: { studentId: args.studentId, trip: "PM" } })
        .catch(() => undefined);
    }
  }
  for (const [trip, type, busNo, dest] of [
    ["AM", args.amType, args.amBus, args.amDest],
    ["PM", args.pmType, args.pmBus, args.pmDest],
  ] as const) {
    if (!type) continue;
    const pickupTime =
      trip === "AM" ? args.amPickupTime || "" : args.pmPickupTime || "";
    if (type === "VAN") {
      const vanLabel = args.vanName || "Van";
      await prisma.transportationAssignment.upsert({
        where: { studentId_trip: { studentId: args.studentId, trip } },
        create: {
          studentId: args.studentId,
          trip,
          type: "BUS",
          destination: "HOME",
          busRouteId: null,
          waitingForAssignment: false,
          notes: vanLabel,
          pickupTime,
          updatedById: args.userId,
        },
        update: {
          type: "BUS",
          destination: "HOME",
          busRouteId: null,
          waitingForAssignment: false,
          notes: vanLabel,
          pickupTime,
          updatedById: args.userId,
        },
      });
      continue;
    }
    const route = busNo
      ? await prisma.busRoute.upsert({
          where: {
            schoolId_number_trip: {
              schoolId: args.schoolId,
              number: busNo.replace(/^Bus\s+/i, ""),
              trip,
            },
          },
          create: {
            schoolId: args.schoolId,
            number: busNo.replace(/^Bus\s+/i, ""),
            trip,
            name: `Route ${busNo}`,
          },
          update: {},
        })
      : null;
    await prisma.transportationAssignment.upsert({
      where: { studentId_trip: { studentId: args.studentId, trip } },
      create: {
        studentId: args.studentId,
        trip,
        type,
        destination:
          dest === "DAYCARE" ? "DAYCARE" : dest === "CUSTOM" ? "CUSTOM" : "HOME",
        busRouteId: type === "BUS" ? route?.id : null,
        daycareId: dest === "DAYCARE" ? args.daycareId : null,
        waitingForAssignment: type === "BUS" && !route,
        notes: type === "VAN" ? args.vanName || "Van" : "",
        pickupTime,
        updatedById: args.userId,
      },
      update: {
        type,
        destination:
          dest === "DAYCARE" ? "DAYCARE" : dest === "CUSTOM" ? "CUSTOM" : "HOME",
        busRouteId: type === "BUS" ? route?.id : null,
        daycareId: dest === "DAYCARE" ? args.daycareId : null,
        waitingForAssignment: type === "BUS" && !route,
        // Clear leftover "Van 2" notes when this trip is a bus.
        notes: type === "VAN" ? args.vanName || "Van" : "",
        pickupTime,
        updatedById: args.userId,
      },
    });
  }
  if (args.vanName) {
    const vehicleId = await ensureVan(args.schoolId, args.vanName);
    await prisma.$executeRaw`
      UPDATE "Student"
      SET "vehicleId" = ${vehicleId}, "updatedAt" = CURRENT_TIMESTAMP
      WHERE "id" = ${args.studentId}
    `;
  } else if (args.amType === "BUS" || args.pmType === "BUS") {
    // Bus file must not leave a ghost van on the student.
    await prisma.$executeRaw`
      UPDATE "Student"
      SET "vehicleId" = NULL, "updatedAt" = CURRENT_TIMESTAMP
      WHERE "id" = ${args.studentId}
    `;
  }
}

async function placeWithTeacher(args: {
  schoolId: string;
  studentId: string;
  grade: string;
  teacherName: string;
}) {
  const name = args.teacherName.trim() || "Unassigned";
  const classroomName = name === "Unassigned" ? `${args.grade} classroom` : name;
  let classroom = await prisma.classroom.findFirst({
    where: { schoolId: args.schoolId, name: classroomName },
    select: { id: true },
  });
  if (!classroom) {
    classroom = await prisma.classroom.create({
      data: {
        schoolId: args.schoolId,
        name: classroomName,
        grade: args.grade,
      },
      select: { id: true },
    });
  }
  const teacher = await prisma.teacher.findFirst({
    where: { classroomId: classroom.id },
    select: { id: true },
  });
  if (!teacher) {
    await prisma.teacher.create({
      data: {
        schoolId: args.schoolId,
        classroomId: classroom.id,
        name,
        email: "",
      },
    });
  } else if (name !== "Unassigned") {
    await prisma.teacher.update({
      where: { id: teacher.id },
      data: { name },
    });
  }
  await prisma.student.update({
    where: { id: args.studentId },
    data: { classroomId: classroom.id },
  });
}

async function findExistingStudent(
  schoolId: string,
  studentId: string,
  firstName: string,
  lastName: string,
  parentPhone: string,
) {
  const byCode = await prisma.student.findUnique({
    where: { schoolId_studentId: { schoolId, studentId } },
  });
  if (byCode) return byCode;

  const matches = await prisma.student.findMany({
    where: { schoolId, firstName, lastName },
  });
  if (matches.length === 1) return matches[0];
  const phone = usablePhone(parentPhone);
  if (phone) {
    return (
      matches.find((row) => usablePhone(row.parentPhone) === phone) || null
    );
  }
  return null;
}

async function ensureNamedFamily(schoolId: string, familyKey: string) {
  await ensureGateTables();
  const existing = await prisma.$queryRaw<Array<{ id: string }>>`
    SELECT "id" FROM "Family"
    WHERE "schoolId" = ${schoolId} AND "familyKey" = ${familyKey}
  `;
  if (existing[0]) return existing[0].id;
  const id = newId();
  await prisma.$executeRaw`
    INSERT INTO "Family" ("id", "schoolId", "familyKey", "reviewNeeded", "reviewNote", "createdAt")
    VALUES (${id}, ${schoolId}, ${familyKey}, false, '', CURRENT_TIMESTAMP)
  `;
  return id;
}

export async function importStudents(formData: FormData) {
  const user = await getSession();
  if (!user || (user.role !== "COORDINATOR" && user.role !== "ADMINISTRATOR")) {
    return { ok: false, error: "Only an admin or bus coordinator can import students." };
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return { ok: false, error: "Choose an Excel or CSV file." };
  }
  const overwrite = String(formData.get("overwrite") || "") === "on";
  const enrollmentSource =
    String(formData.get("enrollmentSource") || "RETURNING") === "NEW_APPLICATION"
      ? "NEW_APPLICATION"
      : "RETURNING";
  const batched = formData.has("batchStart");
  const batchStart = Math.max(0, Number(formData.get("batchStart") || 0) || 0);
  const batchSize = 6;

  const buffer = Buffer.from(await file.arrayBuffer());
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const rows = rowsFromWorkbook(workbook, file.name || "");
  if (!rows.length) {
    return {
      ok: false,
      error:
        "No student rows found. Name the file like VAN_6.xlsx or Bus_1_AM.xlsx, with First Name, Last Name, address, phone, and Pickup Time columns.",
    };
  }

  await ensureGateTables();
  await ensureStudentContactColumns().catch(() => undefined);

  const existingRows = await prisma.student.findMany({
    where: { schoolId: user.schoolId },
    select: {
      id: true,
      studentId: true,
      firstName: true,
      lastName: true,
      parentPhone: true,
      parentPhone2: true,
      parentName: true,
      parentEmail: true,
      homeAddressId: true,
      vehicleId: true,
      active: true,
      homeAddress: { select: { line1: true } },
    },
  });
  const existingByCode = new Map(existingRows.map((row) => [row.studentId, row]));
  const existingByName = new Map<string, typeof existingRows>();
  for (const row of existingRows) {
    const key = `${normName(row.firstName)}|${normName(row.lastName)}`;
    const list = existingByName.get(key) || [];
    list.push(row);
    existingByName.set(key, list);
  }
  const classroomCache = new Map<string, { id: string }>();
  const teacherDone = new Set<string>();
  const familyCache = new Map<string, string>();
  const addressCache = new Map<string, string>();
  const daycareCache = new Map<string, string>();

  let created = 0;
  let updated = 0;
  let filled = 0;
  let skipped = 0;
  let excludedNotReturning = 0;
  let excludedNoName = 0;
  let duplicateNameRows = 0;
  const seenNames = new Map<string, number>();
  const errors: string[] = [];
  const sourceFamilies = new Set(
    rows
      .map((row) => cell(row, "family id", "family_id", "family"))
      .filter(Boolean),
  );
  const canUpdate = overwrite;
  const workRows = batched ? rows.slice(batchStart, batchStart + batchSize) : rows;

  for (const [offset, row] of workRows.entries()) {
    const index = batched ? batchStart + offset : offset;
    const names = studentNamesFromRow(row);
    const firstName = names.first;
    const lastName = names.last;
    const familyKey = cell(row, "family id", "family_id", "family");
    let studentId =
      cell(row, "student id", "student_id", "id") ||
      slugStudentId(firstName, lastName, familyKey, index);
    if (!firstName || !lastName) {
      excludedNoName += 1;
      // Skip blank / title rows quietly — only flag rows that look incomplete.
      const occupied = Object.values(row).filter((value) => String(value || "").trim())
        .length;
      if (occupied >= 3) {
        errors.push(`Row ${index + 2}: Student first and last name are required.`);
      }
      continue;
    }

    const enrollmentRaw = cell(
      row,
      "enrollment status",
      "source",
      "enrollment",
      "enrollment source",
    );
    if (isNotReturning(enrollmentRaw)) {
      excludedNotReturning += 1;
      continue;
    }

    const nameKey = `${normName(firstName)}|${normName(lastName)}`;
    seenNames.set(nameKey, (seenNames.get(nameKey) || 0) + 1);
    if ((seenNames.get(nameKey) || 0) > 1) duplicateNameRows += 1;

    const rowSource = parseEnrollment(enrollmentRaw, enrollmentSource);
    const grade = normalizeGrade(cell(row, "grade") || "—");
    const room = cell(row, "classroom", "room", "teacher/class");
    const teacherName =
      cell(
        row,
        "advisor",
        "advisor name",
        "teacher_name",
        "teacher name",
        "teacher",
        "homeroom teacher",
        "classroom teacher",
      ) || "Unassigned";
    const classroomName = room
      ? /^\d+$/.test(room)
        ? `Room ${room}`
        : room
      : teacherName !== "Unassigned"
        ? teacherName
        : `${grade} classroom`;
    const phones = parentPhonesFromRow(row);
    const parentPhone = phones.phone1 || "—";
    const parentPhone2 = phones.phone2;
    const parentEmail =
      cell(
        row,
        "prim email",
        "parent email",
        "parent_email",
        "email",
        "guardian email",
      ) || "";
    const parentName = parentNameFromRow(row, parentEmail);
    const emergencyName = cell(
      row,
      "emergency_name",
      "emergency name",
      "emergency contact",
      "emergency contact name",
    );
    const emergencyPhone = cell(
      row,
      "emergency_phone",
      "emergency phone",
      "emergency contact phone",
    );
    const parsedAddress = splitHomeAddress(
      cell(row, "prim address", "home_address", "home address", "address") || "",
    );
    const csz = parseCsz(
      cell(row, "prim c s z", "prim_c_s_z", "prim csz", "prim city state zip"),
    );
    const homeLine =
      parsedAddress.line1 ||
      cell(row, "prim address", "home_address", "home address", "address") ||
      "Address pending";
    const city =
      cell(row, "prim city", "home_city", "city") ||
      csz.city ||
      parsedAddress.city ||
      "Minneapolis";
    const state =
      cell(row, "home_state", "state") ||
      csz.state ||
      parsedAddress.state ||
      "MN";
    const zip =
      cell(row, "home_zip", "zip code", "zip") ||
      csz.zip ||
      parsedAddress.zip ||
      "";
    const transportType = cell(
      row,
      "transportation_type",
      "transport type",
      "ride type",
    );
    const vehicleName = cell(row, "vehicle_name", "vehicle name");
    const sharedBus = cell(
      row,
      "routebusnum",
      "route bus num",
      "route bus number",
      "routevannum",
      "route van num",
      "route van number",
      "routenannumb",
      "bus number",
    );
    const amRide = cell(row, "am_type", "am bus", "am route", "morning", "am");
    const pmRide = cell(row, "pm_type", "pm bus", "pm route", "afternoon", "pm");
    // Dayib route tabs set am and/or pm explicitly — do not copy AM onto PM.
    const splitTrips = Boolean(amRide || pmRide);
    const rideValue = vehicleName || amRide || pmRide || sharedBus || transportType;
    const amPlan = parsePlan(
      /van/i.test(transportType) || /van/i.test(vehicleName)
        ? vehicleName || transportType
        : amRide || (!splitTrips ? rideValue : ""),
    );
    const pmPlan = parsePlan(
      /van/i.test(transportType) || /van/i.test(vehicleName)
        ? vehicleName || transportType
        : pmRide || (!splitTrips ? rideValue : ""),
    );
    let daycareName = cell(row, "daycare_name", "daycare");
    if (!daycareName && (amPlan.dest === "DAYCARE" || pmPlan.dest === "DAYCARE")) {
      daycareName = "Daycare";
    }
    const daycareAddress = cell(row, "daycare_address");
    const notes = cell(row, "notes");
    const vanName =
      /van/i.test(transportType) || /van/i.test(vehicleName) || amPlan.type === "VAN"
        ? vehicleName || amPlan.van || pmPlan.van || "Van 1"
        : "";
    const amType = vanName
      ? "VAN"
      : parseType(cell(row, "am_type")) || amPlan.type || (!splitTrips ? parseType(transportType) : null);
    const pmType = vanName
      ? "VAN"
      : parseType(cell(row, "pm_type")) ||
        pmPlan.type ||
        (!splitTrips ? parseType(transportType) || amType : null);
    const amBus =
      cell(row, "am_bus", "am bus") ||
      amPlan.bus ||
      (/bus/i.test(vehicleName) ? vehicleName.replace(/^Bus\s+/i, "") : "");
    const pmBus =
      cell(row, "pm_bus", "pm bus") ||
      pmPlan.bus ||
      (!splitTrips ? amBus : "");
    const amPickupTime = cell(row, "am pickup", "pickup time", "am_pickup");
    const pmPickupTime = cell(row, "pm pickup", "pm_pickup");
    const amDest =
      cell(row, "am_destination").toUpperCase() || amPlan.dest || "HOME";
    const pmDest =
      cell(row, "pm_destination").toUpperCase() || pmPlan.dest || "HOME";

    try {
    const nameMatches = existingByName.get(`${normName(firstName)}|${normName(lastName)}`) || [];
    const phone = usablePhone(parentPhone);
    const byCode = existingByCode.get(studentId);
    const codeIsSamePerson = Boolean(
      byCode &&
        normName(byCode.firstName) === normName(firstName) &&
        normName(byCode.lastName) === normName(lastName),
    );
    const existingEarly =
      (codeIsSamePerson ? byCode : null) ||
      (nameMatches.length === 1
        ? nameMatches[0]
        : nameMatches.find((row) => usablePhone(row.parentPhone) === phone) ||
          null);
    if (!existingEarly && existingByCode.has(studentId)) {
      studentId = `${studentId}`.slice(0, 36) + `-${index + 1}`;
    }
    if (existingEarly && !canUpdate) {
      const patch: {
        parentName?: string;
        parentPhone?: string;
        parentPhone2?: string;
        parentEmail?: string;
        emergencyName?: string;
        emergencyPhone?: string;
        homeAddressId?: string;
      } = {};
      if (usablePhone(parentPhone) && !usablePhone(existingEarly.parentPhone)) {
        patch.parentPhone = parentPhone;
      }
      if (usablePhone(parentPhone2)) {
        patch.parentPhone2 = parentPhone2;
      }
      if (parentEmail.includes("@") && !existingEarly.parentEmail) {
        patch.parentEmail = parentEmail;
      }
      if (
        parentName !== "—" &&
        (!existingEarly.parentName || existingEarly.parentName === "—")
      ) {
        patch.parentName = parentName;
      }
      if (emergencyName) patch.emergencyName = emergencyName;
      if (usablePhone(emergencyPhone)) patch.emergencyPhone = emergencyPhone;
      const addressPending =
        !existingEarly.homeAddress?.line1 ||
        /pending/i.test(existingEarly.homeAddress.line1);
      if (addressPending && homeLine && !/pending/i.test(homeLine)) {
        const home = await prisma.address.create({
          data: {
            schoolId: user.schoolId,
            line1: homeLine,
            city,
            state,
            zip,
            label: "home",
          },
        });
        patch.homeAddressId = home.id;
      }
      if (Object.keys(patch).length) {
        try {
          await prisma.student.update({
            where: { id: existingEarly.id },
            data: patch,
          });
        } catch {
          if (patch.parentEmail) {
            await prisma.$executeRaw`
              UPDATE "Student" SET "parentEmail" = ${patch.parentEmail}
              WHERE "id" = ${existingEarly.id}
            `;
          }
          if (patch.parentPhone) {
            await prisma.student.update({
              where: { id: existingEarly.id },
              data: { parentPhone: patch.parentPhone, parentName: patch.parentName },
            });
          }
        }
      }
      await placeWithTeacher({
        schoolId: user.schoolId,
        studentId: existingEarly.id,
        grade,
        teacherName,
      });
      await applyStudentPlans({
        schoolId: user.schoolId,
        userId: user.id,
        studentId: existingEarly.id,
        amType,
        pmType,
        amBus,
        pmBus,
        amDest,
        pmDest,
        vanName,
        // Never delete the other trip when loading Bus_1_AM then Bus_1_PM.
        clearMissingTrips: false,
        amPickupTime,
        pmPickupTime,
      });
      await prisma.student
        .update({
          where: { id: existingEarly.id },
          data: { active: true },
        })
        .catch(() => undefined);
      filled += 1;
      continue;
    }

    let classroom = classroomCache.get(classroomName);
    if (!classroom) {
      classroom =
        (await prisma.classroom.findFirst({
          where: { schoolId: user.schoolId, name: classroomName },
          select: { id: true },
        })) ||
        (await prisma.classroom.create({
          data: { schoolId: user.schoolId, name: classroomName, grade },
          select: { id: true },
        }));
      classroomCache.set(classroomName, classroom);
    }
    if (!teacherDone.has(classroom.id)) {
      const existingTeacher = await prisma.teacher.findFirst({
        where: { classroomId: classroom.id },
        select: { id: true },
      });
      if (!existingTeacher) {
        await prisma.teacher.create({
          data: {
            schoolId: user.schoolId,
            classroomId: classroom.id,
            name: teacherName,
            email: "",
          },
        });
      } else if (teacherName && teacherName !== "Unassigned") {
        await prisma.teacher.update({
          where: { id: existingTeacher.id },
          data: { name: teacherName },
        });
      }
      teacherDone.add(classroom.id);
    }

    const addressKey = familyKey || `${homeLine}|${city}|${zip}`;
    let homeId = addressCache.get(addressKey);
    if (!homeId) {
      const home = await prisma.address.create({
        data: {
          schoolId: user.schoolId,
          line1: homeLine,
          city,
          state,
          zip,
          label: "home",
        },
      });
      homeId = home.id;
      addressCache.set(addressKey, homeId);
    }

    let daycareId: string | undefined;
    if (daycareName) {
      daycareId = daycareCache.get(daycareName);
      if (!daycareId) {
        let daycare = await prisma.daycare.findFirst({
          where: { schoolId: user.schoolId, name: daycareName },
        });
        if (!daycare) {
          const addr = await prisma.address.create({
            data: {
              schoolId: user.schoolId,
              line1: daycareAddress || "Address pending",
              city,
              state,
              zip,
              label: "daycare",
            },
          });
          daycare = await prisma.daycare.create({
            data: {
              schoolId: user.schoolId,
              name: daycareName,
              addressId: addr.id,
            },
          });
        }
        daycareId = daycare.id;
        daycareCache.set(daycareName, daycareId);
      }
    }

    const existing = existingEarly;

    let familyId = familyKey ? familyCache.get(familyKey) || null : null;
    if (familyKey && !familyId) {
      familyId = await ensureNamedFamily(user.schoolId, familyKey);
      familyCache.set(familyKey, familyId);
    }

    const student = existing
      ? await prisma.student.update({
          where: { id: existing.id },
          data: {
            firstName,
            lastName,
            grade,
            classroomId: classroom.id,
            parentName,
            parentPhone,
            parentPhone2: parentPhone2 || undefined,
            parentEmail,
            emergencyName: emergencyName || undefined,
            emergencyPhone: emergencyPhone || undefined,
            homeAddressId: homeId,
            daycareId,
            notes,
            familyId: familyId || undefined,
            enrollmentSource: rowSource,
            active: true,
          },
        })
      : await prisma.student.create({
          data: {
            schoolId: user.schoolId,
            studentId,
            firstName,
            lastName,
            grade,
            classroomId: classroom.id,
            parentName,
            parentPhone,
            parentPhone2,
            parentEmail,
            emergencyName,
            emergencyPhone,
            homeAddressId: homeId,
            daycareId,
            notes,
            familyId,
            enrollmentSource: rowSource,
          },
        });

    if (existing) updated += 1;
    else created += 1;
    existingByCode.set(studentId, {
      id: student.id,
      studentId,
      firstName,
      lastName,
      parentPhone,
      parentPhone2,
      parentName,
      parentEmail,
      homeAddressId: homeId,
      vehicleId: existing?.vehicleId ?? null,
      active: true,
      homeAddress: { line1: homeLine },
    });
    const nameList = existingByName.get(`${normName(firstName)}|${normName(lastName)}`) || [];
    if (!nameList.some((row) => row.id === student.id)) {
      nameList.push({
        id: student.id,
        studentId,
        firstName,
        lastName,
        parentPhone,
        parentPhone2,
        parentName,
        parentEmail,
        homeAddressId: homeId,
        vehicleId: existing?.vehicleId ?? null,
        active: true,
        homeAddress: { line1: homeLine },
      });
      existingByName.set(`${normName(firstName)}|${normName(lastName)}`, nameList);
    }

    await applyStudentPlans({
      schoolId: user.schoolId,
      userId: user.id,
      studentId: student.id,
      amType,
      pmType,
      amBus,
      pmBus,
      amDest,
      pmDest,
      vanName,
      daycareId,
      clearMissingTrips: false,
      amPickupTime,
      pmPickupTime,
    });
    } catch (error) {
      errors.push(
        `Row ${index + 2}: ${
          error instanceof Error ? error.message : "could not save this student."
        }`,
      );
    }
  }

  const next = batched ? batchStart + workRows.length : rows.length;
  const done = next >= rows.length;

  const rosterStudents = await prisma.student.count({
    where: { schoolId: user.schoolId, active: true },
  });

  if (done) {
    void Promise.resolve()
      .then(async () => {
        await writeAudit({
          user,
          action: "IMPORT_STUDENTS",
          newPlan: { created, updated, errors: errors.length },
        });
        await saveImportSummary(user.schoolId, {
          fileName: file.name,
          sourceStudents: rows.length,
          sourceFamilies: sourceFamilies.size,
          created,
          updated,
          excludedNotReturning,
          excludedNoName,
          duplicateNameRows,
          errors: errors.length,
          rosterStudents,
          rosterFamilies: 0,
          at: new Date().toISOString(),
        });
        revalidatePath("/students");
        revalidatePath("/dashboard");
        revalidatePath("/buses");
        revalidatePath("/print");
        revalidatePath("/gate");
        revalidatePath("/first-day");
      })
      .catch(() => undefined);
  }

  return {
    ok: true,
    created,
    updated,
    filled,
    skipped,
    errors,
    excludedNotReturning,
    sourceStudents: rows.length,
    rosterStudents,
    next,
    done,
  };
}

export type ImportPreviewRow = {
  studentId: string;
  firstName: string;
  lastName: string;
  grade: string;
  teacherName: string;
  parentName: string;
  parentPhone: string;
  address: string;
  city: string;
  zip: string;
  enrollmentSource: "RETURNING" | "NEW_APPLICATION";
  duplicate: boolean;
  duplicateOf: string;
  siblingHint: string;
  uncertain: boolean;
  uncertainNote: string;
};

export type ImportPreview = {
  rows: ImportPreviewRow[];
  totalStudents: number;
  uniqueFamilies: number;
  returning: number;
  newApplication: number;
  duplicates: number;
  uncertain: number;
  existingConflicts: number;
};

function parseEnrollment(value: string, fallback: "RETURNING" | "NEW_APPLICATION") {
  const v = value.toLowerCase();
  if (isNotReturning(v)) return "RETURNING";
  if (v.includes("new") || v.includes("application")) return "NEW_APPLICATION";
  if (v.includes("return") || v.includes("retention") || v.includes("pending")) {
    return "RETURNING";
  }
  return fallback;
}

async function rowsFromUpload(
  file: File,
  fallback: "RETURNING" | "NEW_APPLICATION",
) {
  const buffer = Buffer.from(await file.arrayBuffer());
  const workbook = XLSX.read(buffer, { type: "buffer" });
  return rowsFromWorkbook(workbook, file.name || "").map((row) => {
    const names = studentNamesFromRow(row);
    const firstName = names.first;
    const lastName = names.last;
    const parentEmail =
      cell(row, "prim email", "parent email", "parent_email", "email") || "";
    const csz = parseCsz(
      cell(row, "prim c s z", "prim_c_s_z", "prim csz", "prim city state zip"),
    );
    return {
      studentId: cell(row, "student id", "student_id", "id", "family id"),
      firstName,
      lastName,
      grade: normalizeGrade(cell(row, "grade") || "—"),
      teacherName:
        cell(row, "advisor", "advisor name", "teacher") || "Unassigned",
      parentName: parentNameFromRow(row, parentEmail),
      parentPhone: parentPhonesFromRow(row).phone1 || "—",
      parentEmail,
      address:
        cell(row, "prim address", "home_address", "home address", "address") ||
        "",
      city: cell(row, "prim city", "home_city", "city") || csz.city || "",
      zip: cell(row, "home_zip", "zip code", "zip") || csz.zip || "",
      enrollmentSource: parseEnrollment(
        cell(
          row,
          "enrollment status",
          "source",
          "enrollment",
          "enrollment source",
          "type",
        ),
        fallback,
      ),
    };
  });
}

export async function previewStudentImport(formData: FormData) {
  const user = await getSession();
  if (!user || (user.role !== "COORDINATOR" && user.role !== "ADMINISTRATOR")) {
    return { ok: false as const, error: "Only an admin or bus coordinator can import students." };
  }

  const returning = formData.get("returning");
  const incoming = formData.get("newApplication");
  const combined: Awaited<ReturnType<typeof rowsFromUpload>> = [];
  if (returning instanceof File && returning.size) {
    combined.push(...(await rowsFromUpload(returning, "RETURNING")));
  }
  if (incoming instanceof File && incoming.size) {
    combined.push(...(await rowsFromUpload(incoming, "NEW_APPLICATION")));
  }
  if (!combined.length) {
    return { ok: false as const, error: "Choose a returning file, a new-application file, or both." };
  }

  await ensureGateTables();
  const existing = await prisma.student.findMany({
    where: { schoolId: user.schoolId },
    include: { homeAddress: true },
  });

  const seenIds = new Map<string, string>();
  const rows: ImportPreviewRow[] = combined
    .filter((row) => row.firstName && row.lastName)
    .map((row) => {
      const key = row.studentId || `${normName(row.firstName)}|${normName(row.lastName)}|${digitsPhone(row.parentPhone)}`;
      const prior = seenIds.get(key);
      seenIds.set(key, `${row.firstName} ${row.lastName}`);
      const existingHit = existing.find(
        (s) =>
          (row.studentId && s.studentId === row.studentId) ||
          (normName(s.firstName) === normName(row.firstName) &&
            normName(s.lastName) === normName(row.lastName) &&
            usablePhone(s.parentPhone) &&
            usablePhone(s.parentPhone) === usablePhone(row.parentPhone)),
      );
      const sibling = combined.find((other) => {
        if (other === row) return false;
        const phone =
          usablePhone(row.parentPhone) &&
          usablePhone(row.parentPhone) === usablePhone(other.parentPhone);
        const name =
          normName(row.parentName) &&
          normName(row.parentName) === normName(other.parentName);
        return Boolean(phone && name);
      });
      const uncertainPeer = combined.find((other) => {
        if (other === row) return false;
        const phone =
          usablePhone(row.parentPhone) &&
          usablePhone(row.parentPhone) === usablePhone(other.parentPhone);
        const name = normName(row.parentName) === normName(other.parentName);
        const address =
          normAddress(row.address) &&
          normAddress(row.address) === normAddress(other.address);
        return (phone && !name) || (name && address && !phone);
      });
      return {
        ...row,
        duplicate: Boolean(prior || existingHit),
        duplicateOf: existingHit
          ? `Existing ${existingHit.firstName} ${existingHit.lastName} (${existingHit.studentId})`
          : prior
            ? `Also in this import as ${prior}`
            : "",
        siblingHint: sibling
          ? `Likely siblings with ${sibling.firstName} ${sibling.lastName}`
          : "",
        uncertain: Boolean(uncertainPeer),
        uncertainNote: uncertainPeer
          ? `Possible family match with ${uncertainPeer.firstName} ${uncertainPeer.lastName} — do not auto-combine.`
          : "",
      };
    });

  const familyKeys = new Set(
    rows.map((row) => {
      const phone = usablePhone(row.parentPhone);
      const parent = normName(row.parentName);
      if (phone && parent) return `${phone}|${parent}`;
      return `solo|${row.studentId || row.firstName + row.lastName}`;
    }),
  );

  const preview: ImportPreview = {
    rows,
    totalStudents: rows.length,
    uniqueFamilies: familyKeys.size,
    returning: rows.filter((r) => r.enrollmentSource === "RETURNING").length,
    newApplication: rows.filter((r) => r.enrollmentSource === "NEW_APPLICATION")
      .length,
    duplicates: rows.filter((r) => r.duplicate).length,
    uncertain: rows.filter((r) => r.uncertain).length,
    existingConflicts: rows.filter((r) => r.duplicateOf.startsWith("Existing"))
      .length,
  };

  return { ok: true as const, preview };
}
