"use server";

import { randomUUID } from "crypto";
import * as XLSX from "xlsx";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { writeAudit } from "@/lib/audit";
import {
  assignMissingFamilies,
  digitsPhone,
  ensureGateTables,
  normAddress,
  normName,
  saveImportSummary,
  usablePhone,
} from "@/lib/gate";

type Row = Record<string, string>;

function cell(row: Row, ...keys: string[]) {
  for (const key of keys) {
    const match = Object.keys(row).find(
      (k) => k.trim().toLowerCase() === key.toLowerCase(),
    );
    if (match && row[match] != null && String(row[match]).trim()) {
      return String(row[match]).trim();
    }
  }
  return "";
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

function splitName(fullName: string) {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
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

  const first = lines[0].map((value) => value.toLowerCase());
  if (first.some((value) => HEADER_ALIASES.has(value))) {
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
  if (!v) return { type: null as "BUS" | "PARENT" | null, bus: "", dest };
  if (
    v.includes("not checked") ||
    v.includes("not confirmed") ||
    v.includes("follow-up") ||
    v.includes("absent")
  ) {
    return { type: null as "BUS" | "PARENT" | null, bus: "", dest };
  }
  if (v.includes("parent") || v.includes("pickup") || v.includes("drop-off")) {
    return { type: "PARENT" as const, bus: "", dest };
  }
  const busMatch = raw.match(/(\d+)/);
  if (v.includes("bus") || busMatch) {
    return { type: "BUS" as const, bus: busMatch?.[1] || "", dest };
  }
  return { type: parseType(raw), bus: "", dest };
}

function newId() {
  return randomUUID().replace(/-/g, "").slice(0, 24);
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

  const buffer = Buffer.from(await file.arrayBuffer());
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const sheetName =
    workbook.SheetNames.find((name) => /master/i.test(name)) ||
    workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const rows = rowsFromSheet(sheet);
  if (!rows.length) return { ok: false, error: "The file has no data rows." };

  await ensureGateTables();

  const existingRows = await prisma.student.findMany({
    where: { schoolId: user.schoolId },
    select: {
      id: true,
      studentId: true,
      firstName: true,
      lastName: true,
      parentPhone: true,
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
  const isFamilyMaster = Boolean(
    cell(rows[0] || {}, "family id", "family_id") ||
      cell(rows[0] || {}, "student first name"),
  );
  const canUpdate = overwrite || isFamilyMaster;

  for (const [index, row] of rows.entries()) {
    const fullName = cell(row, "student", "name", "full name");
    const names = splitName(fullName);
    const firstName =
      cell(row, "student first name", "first_name", "first name") || names.first;
    const lastName =
      cell(row, "student last name", "last_name", "last name") || names.last;
    const familyKey = cell(row, "family id", "family_id", "family");
    const studentId =
      cell(row, "student_id", "id", "student id") ||
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
    const classroomName = room
      ? /^\d+$/.test(room)
        ? `Room ${room}`
        : room
      : `${grade} classroom`;
    const teacherName = cell(row, "teacher") || "Unassigned";
    const parentName =
      cell(row, "parent/guardian", "parent_name", "parent") || "—";
    const parentPhone =
      cell(row, "primary phone", "parent_phone", "phone") || "—";
    const homeLine = cell(row, "home_address", "address") || "Address pending";
    const city = cell(row, "home_city", "city") || "Minneapolis";
    const state = cell(row, "home_state", "state") || "MN";
    const zip = cell(row, "home_zip", "zip code", "zip") || "";
    const amPlan = parsePlan(cell(row, "am_type", "am"));
    const pmPlan = parsePlan(cell(row, "pm_type", "pm"));
    let daycareName = cell(row, "daycare_name", "daycare");
    if (!daycareName && (amPlan.dest === "DAYCARE" || pmPlan.dest === "DAYCARE")) {
      daycareName = "Daycare";
    }
    const daycareAddress = cell(row, "daycare_address");
    const notes = cell(row, "notes");

    try {
    const nameMatches = existingByName.get(`${normName(firstName)}|${normName(lastName)}`) || [];
    const phone = usablePhone(parentPhone);
    const existingEarly =
      existingByCode.get(studentId) ||
      (nameMatches.length === 1
        ? nameMatches[0]
        : nameMatches.find((row) => usablePhone(row.parentPhone) === phone) ||
          null);
    if (existingEarly && !canUpdate) {
      errors.push(
        `Row ${index + 2}: ${firstName} ${lastName} already exists. Check “Update existing students” to overwrite.`,
      );
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
            homeAddressId: homeId,
            daycareId,
            notes,
            familyId: familyId || undefined,
            enrollmentSource: rowSource,
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
    });
    const nameList = existingByName.get(`${normName(firstName)}|${normName(lastName)}`) || [];
    if (!nameList.some((row) => row.id === student.id)) {
      nameList.push({
        id: student.id,
        studentId,
        firstName,
        lastName,
        parentPhone,
      });
      existingByName.set(`${normName(firstName)}|${normName(lastName)}`, nameList);
    }

    const amType = parseType(cell(row, "am_type")) || amPlan.type;
    const pmType = parseType(cell(row, "pm_type")) || pmPlan.type;
    const amBus = cell(row, "am_bus", "am bus") || amPlan.bus;
    const pmBus = cell(row, "pm_bus", "pm bus") || pmPlan.bus;
    const amDest =
      cell(row, "am_destination").toUpperCase() || amPlan.dest || "HOME";
    const pmDest =
      cell(row, "pm_destination").toUpperCase() || pmPlan.dest || "HOME";

    for (const [trip, type, busNo, dest] of [
      ["AM", amType, amBus, amDest],
      ["PM", pmType, pmBus, pmDest],
    ] as const) {
      if (!type) continue;
      const route = busNo
        ? await prisma.busRoute.upsert({
            where: {
              schoolId_number_trip: {
                schoolId: user.schoolId,
                number: busNo.replace(/^Bus\s+/i, ""),
                trip,
              },
            },
            create: {
              schoolId: user.schoolId,
              number: busNo.replace(/^Bus\s+/i, ""),
              trip,
              name: `Route ${busNo}`,
            },
            update: {},
          })
        : null;
      await prisma.transportationAssignment.upsert({
        where: { studentId_trip: { studentId: student.id, trip } },
        create: {
          studentId: student.id,
          trip,
          type,
          destination: dest === "DAYCARE" ? "DAYCARE" : dest === "CUSTOM" ? "CUSTOM" : "HOME",
          busRouteId: type === "BUS" ? route?.id : null,
          daycareId: dest === "DAYCARE" ? daycareId : null,
          waitingForAssignment: type === "BUS" && !route,
          updatedById: user.id,
        },
        update: {
          type,
          destination: dest === "DAYCARE" ? "DAYCARE" : dest === "CUSTOM" ? "CUSTOM" : "HOME",
          busRouteId: type === "BUS" ? route?.id : null,
          daycareId: dest === "DAYCARE" ? daycareId : null,
          waitingForAssignment: type === "BUS" && !route,
          updatedById: user.id,
        },
      });
    }
    } catch (error) {
      errors.push(
        `Row ${index + 2}: ${
          error instanceof Error ? error.message : "could not save this student."
        }`,
      );
    }
  }

  await writeAudit({
    user,
    action: "IMPORT_STUDENTS",
    newPlan: { created, updated, errors: errors.length },
  });

  if (![...sourceFamilies].length) {
    await assignMissingFamilies(user.schoolId).catch(() => undefined);
  }

  const rosterStudents = await prisma.student.count({
    where: { schoolId: user.schoolId },
  });
  const familyRows = await prisma.$queryRaw<Array<{ count: bigint }>>`
    SELECT COUNT(DISTINCT COALESCE("familyId", "id"))::bigint AS count
    FROM "Student"
    WHERE "schoolId" = ${user.schoolId}
  `.catch(() => [{ count: BigInt(0) }]);
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
    rosterFamilies: Number(familyRows[0]?.count || 0),
    at: new Date().toISOString(),
  }).catch(() => undefined);

  revalidatePath("/students");
  revalidatePath("/dashboard");
  revalidatePath("/gate");
  revalidatePath("/first-day");
  return {
    ok: true,
    created,
    updated,
    errors,
    excludedNotReturning,
    sourceStudents: rows.length,
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
    const fullName = cell(row, "student", "name", "full name");
    const names = splitName(fullName);
    const firstName =
      cell(row, "student first name", "first_name", "first name") || names.first;
    const lastName =
      cell(row, "student last name", "last_name", "last name") || names.last;
    return {
      studentId: cell(row, "student_id", "id", "student id", "family id"),
      firstName,
      lastName,
      grade: normalizeGrade(cell(row, "grade") || "—"),
      teacherName: cell(row, "teacher") || "Unassigned",
      parentName: cell(row, "parent/guardian", "parent_name", "parent") || "—",
      parentPhone: cell(row, "primary phone", "parent_phone", "phone") || "—",
      address: cell(row, "home_address", "address") || "",
      city: cell(row, "home_city", "city") || "",
      zip: cell(row, "home_zip", "zip code", "zip") || "",
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
