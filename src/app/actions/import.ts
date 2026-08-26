"use server";

import * as XLSX from "xlsx";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { writeAudit } from "@/lib/audit";

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
  "last_name",
  "last name",
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

function parsePlan(value: string) {
  const raw = value.trim();
  const v = raw.toLowerCase();
  const dest = v.includes("daycare") ? "DAYCARE" : "HOME";
  if (!v) return { type: null as "BUS" | "PARENT" | null, bus: "", dest };
  if (v.includes("parent") || v.includes("pickup") || v.includes("drop-off")) {
    return { type: "PARENT" as const, bus: "", dest };
  }
  const busMatch = raw.match(/(\d+)/);
  if (v.includes("bus") || busMatch) {
    return { type: "BUS" as const, bus: busMatch?.[1] || "", dest };
  }
  return { type: parseType(raw), bus: "", dest };
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

  const buffer = Buffer.from(await file.arrayBuffer());
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = rowsFromSheet(sheet);
  if (!rows.length) return { ok: false, error: "The file has no data rows." };

  let created = 0;
  let updated = 0;
  const errors: string[] = [];

  for (const [index, row] of rows.entries()) {
    const studentId = cell(row, "student_id", "id", "student id");
    const fullName = cell(row, "student", "name", "full name");
    const names = splitName(fullName);
    const firstName = cell(row, "first_name", "first name") || names.first;
    const lastName = cell(row, "last_name", "last name") || names.last;
    if (!studentId || !firstName || !lastName) {
      errors.push(`Row ${index + 2}: ID and Student name are required.`);
      continue;
    }

    const grade = cell(row, "grade") || "—";
    const room = cell(row, "classroom", "room");
    const classroomName = room
      ? /^\d+$/.test(room)
        ? `Room ${room}`
        : room
      : `${grade} classroom`;
    const teacherName = cell(row, "teacher") || "Unassigned";
    const parentName = cell(row, "parent_name", "parent") || "—";
    const parentPhone = cell(row, "parent_phone", "phone") || "—";
    const homeLine = cell(row, "home_address", "address") || "Address pending";
    const city = cell(row, "home_city", "city") || "Springfield";
    const state = cell(row, "home_state", "state") || "IL";
    const zip = cell(row, "home_zip", "zip") || "62701";
    const amPlan = parsePlan(cell(row, "am_type", "am"));
    const pmPlan = parsePlan(cell(row, "pm_type", "pm"));
    let daycareName = cell(row, "daycare_name", "daycare");
    if (!daycareName && (amPlan.dest === "DAYCARE" || pmPlan.dest === "DAYCARE")) {
      daycareName = "Daycare";
    }
    const daycareAddress = cell(row, "daycare_address");
    const notes = cell(row, "notes");

    try {
    let classroom = await prisma.classroom.findFirst({
      where: { schoolId: user.schoolId, name: classroomName },
    });
    if (!classroom) {
      classroom = await prisma.classroom.create({
        data: { schoolId: user.schoolId, name: classroomName, grade },
      });
    }
    const existingTeacher = await prisma.teacher.findFirst({
      where: { classroomId: classroom.id },
    });
    if (!existingTeacher) {
      await prisma.teacher.create({
        data: {
          schoolId: user.schoolId,
          classroomId: classroom.id,
          name: teacherName,
          email: `${teacherName.toLowerCase().replace(/[^a-z]+/g, ".")}@riverside.edu`,
        },
      });
    }

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

    let daycareId: string | undefined;
    if (daycareName) {
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
    }

    const existing = await prisma.student.findUnique({
      where: {
        schoolId_studentId: { schoolId: user.schoolId, studentId },
      },
    });

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
            homeAddressId: home.id,
            daycareId,
            notes,
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
            homeAddressId: home.id,
            daycareId,
            notes,
          },
        });

    if (existing) updated += 1;
    else created += 1;

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

  revalidatePath("/students");
  revalidatePath("/dashboard");
  return { ok: true, created, updated, errors };
}
