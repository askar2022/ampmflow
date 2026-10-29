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
]);

const POSITIONAL_KEYS = ["id", "student", "grade", "teacher", "room", "am", "pm"];

function rowsFromSheet(sheet: XLSX.WorkSheet): Row[] {
  const matrix = XLSX.utils.sheet_to_json<(string | number)[]>(sheet, {
    header: 1,
    defval: "",
    raw: false,
  });
  const lines = matrix
    .map((line) => line.map((value) => String(value ?? "").trim()))
    .filter((line) => line.some(Boolean));
  if (!lines.length) return [];

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
}) {
  for (const [trip, type, busNo, dest] of [
    ["AM", args.amType, args.amBus, args.amDest],
    ["PM", args.pmType, args.pmBus, args.pmDest],
  ] as const) {
    if (!type || type === "VAN") continue;
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
        updatedById: args.userId,
      },
      update: {
        type,
        destination:
          dest === "DAYCARE" ? "DAYCARE" : dest === "CUSTOM" ? "CUSTOM" : "HOME",
        busRouteId: type === "BUS" ? route?.id : null,
        daycareId: dest === "DAYCARE" ? args.daycareId : null,
        waitingForAssignment: type === "BUS" && !route,
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
  const sheetName =
    workbook.SheetNames.find((name) => /master/i.test(name)) ||
    workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const rows = rowsFromSheet(sheet);
  if (!rows.length) return { ok: false, error: "The file has no data rows." };

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
      errors.push(`Row ${index + 2}: Student first and last name are required.`);
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
    const rideValue =
      vehicleName ||
      cell(row, "am_type", "am bus", "am route", "morning", "am") ||
      sharedBus ||
      transportType;
    const amPlan = parsePlan(
      /van/i.test(transportType) || /van/i.test(vehicleName)
        ? vehicleName || transportType
        : rideValue,
    );
    const pmPlan = parsePlan(
      cell(row, "pm_type", "pm bus", "pm route", "afternoon", "pm") || rideValue,
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
      : parseType(transportType) || parseType(cell(row, "am_type")) || amPlan.type;
    const pmType = vanName
      ? "VAN"
      : parseType(transportType) || parseType(cell(row, "pm_type")) || pmPlan.type || amType;
    const amBus =
      cell(row, "am_bus", "am bus") ||
      amPlan.bus ||
      (/bus/i.test(vehicleName) ? vehicleName.replace(/^Bus\s+/i, "") : "");
    const pmBus = cell(row, "pm_bus", "pm bus") || pmPlan.bus || amBus;
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
  const sheetName =
    workbook.SheetNames.find((name) => /master/i.test(name)) ||
    workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  return rowsFromSheet(sheet).map((row) => {
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
