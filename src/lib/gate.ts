import { randomUUID } from "crypto";
import { prisma } from "./prisma";
import { formatTime, todayKey } from "./dates";
import type { SessionUser } from "./types";

export const AM_ARRIVAL = [
  "NOT_CHECKED_IN",
  "PARENT_DROP_OFF",
  "BUS_DROP_OFF",
  "ABSENT_CONFIRMED",
] as const;

export const AM_FOLLOW_UP = [
  "FOLLOW_UP_NOT_NEEDED",
  "ARRIVING_LATE",
  "ABSENT_NO_BUS",
  "ABSENT_SICK",
  "ABSENT_FAMILY",
  "TRANSFERRED",
  "UNABLE_TO_REACH",
  "OTHER",
] as const;

export const PM_DISMISSAL = [
  "NOT_CONFIRMED",
  "PARENT_PICKUP_CONFIRMED",
  "PARENT_PICKUP_TODAY_BUS_TOMORROW",
  "CONFIRMED_BUS",
] as const;

export const GRADE_CONFIRM = [
  "WAITING_TEACHER",
  "TEACHER_CONFIRMED",
  "CORRECTION_NEEDED",
  "CORRECTED",
] as const;

export type AmArrival = (typeof AM_ARRIVAL)[number];
export type AmFollowUp = (typeof AM_FOLLOW_UP)[number];
export type PmDismissal = (typeof PM_DISMISSAL)[number];
export type GradeConfirm = (typeof GRADE_CONFIRM)[number];
export type EnrollmentSource = "RETURNING" | "NEW_APPLICATION";

export const AM_LABEL: Record<AmArrival, string> = {
  NOT_CHECKED_IN: "Not Checked In",
  PARENT_DROP_OFF: "Parent Drop-Off",
  BUS_DROP_OFF: "Bus Drop-Off",
  ABSENT_CONFIRMED: "Absent—Confirmed",
};

export const FOLLOW_LABEL: Record<AmFollowUp, string> = {
  FOLLOW_UP_NOT_NEEDED: "Follow-Up Not Needed",
  ARRIVING_LATE: "Arriving Late",
  ABSENT_NO_BUS: "Absent—No Bus",
  ABSENT_SICK: "Absent—Sick",
  ABSENT_FAMILY: "Absent—Family Reason",
  TRANSFERRED: "Transferred to Another School",
  UNABLE_TO_REACH: "Unable to Reach",
  OTHER: "Other",
};

export const PM_LABEL: Record<PmDismissal, string> = {
  NOT_CONFIRMED: "Not Confirmed",
  PARENT_PICKUP_CONFIRMED: "Parent Pickup—Confirmed",
  PARENT_PICKUP_TODAY_BUS_TOMORROW:
    "Parent Pickup Today Only—Bus Needed Tomorrow",
  CONFIRMED_BUS: "Confirmed Bus",
};

export const GRADE_CONFIRM_LABEL: Record<GradeConfirm, string> = {
  WAITING_TEACHER: "Waiting for Teacher",
  TEACHER_CONFIRMED: "Teacher Confirmed",
  CORRECTION_NEEDED: "Correction Needed",
  CORRECTED: "Corrected",
};

export const ENROLL_LABEL: Record<EnrollmentSource, string> = {
  RETURNING: "Returning",
  NEW_APPLICATION: "New Application",
};

export const AM_TONE: Record<AmArrival, "yellow" | "green" | "blue" | "red"> = {
  NOT_CHECKED_IN: "yellow",
  PARENT_DROP_OFF: "green",
  BUS_DROP_OFF: "blue",
  ABSENT_CONFIRMED: "red",
};

export const PM_TONE: Record<PmDismissal, "yellow" | "blue" | "orange" | "green"> =
  {
    NOT_CONFIRMED: "yellow",
    PARENT_PICKUP_CONFIRMED: "blue",
    PARENT_PICKUP_TODAY_BUS_TOMORROW: "orange",
    CONFIRMED_BUS: "green",
  };

export const STANDARD_GRADES = [
  "Kindergarten",
  "Grade 1",
  "Grade 2",
  "Grade 3",
  "Grade 4",
  "Grade 5",
  "Grade 6",
  "Grade 7",
  "Grade 8",
  "Grade 9",
  "Grade 10",
];

export type GateStudent = {
  id: string;
  studentId: string;
  firstName: string;
  lastName: string;
  fullName: string;
  grade: string;
  teacherName: string;
  parentName: string;
  parentPhone: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  familyId: string;
  familyKey: string;
  reviewNeeded: boolean;
  reviewNote: string;
  enrollmentSource: EnrollmentSource;
  vehicleName: string;
  driverName: string;
  driverPhone: string;
  amArrival: AmArrival;
  amFollowUp: AmFollowUp;
  pmDismissal: PmDismissal;
  transportNotes: string;
  tempVehicleName: string;
  amArrivalAt: string | null;
  updatedByName: string;
  updatedAt: string | null;
  nameDupCount: number;
};

export type GateFamily = {
  familyId: string;
  familyKey: string;
  parentName: string;
  parentPhone: string;
  address: string;
  city: string;
  zip: string;
  reviewNeeded: boolean;
  reviewNote: string;
  students: GateStudent[];
};

function newId() {
  return randomUUID().replace(/-/g, "").slice(0, 24);
}

function asAm(value: string | null | undefined): AmArrival {
  return AM_ARRIVAL.includes(value as AmArrival)
    ? (value as AmArrival)
    : "NOT_CHECKED_IN";
}

function asFollow(value: string | null | undefined): AmFollowUp {
  return AM_FOLLOW_UP.includes(value as AmFollowUp)
    ? (value as AmFollowUp)
    : "FOLLOW_UP_NOT_NEEDED";
}

function asPm(value: string | null | undefined): PmDismissal {
  return PM_DISMISSAL.includes(value as PmDismissal)
    ? (value as PmDismissal)
    : "NOT_CONFIRMED";
}

function asEnroll(value: string | null | undefined): EnrollmentSource {
  return value === "NEW_APPLICATION" ? "NEW_APPLICATION" : "RETURNING";
}

export function digitsPhone(value: string) {
  return value.replace(/\D/g, "");
}

export function normName(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

export function normAddress(value: string) {
  return value
    .toLowerCase()
    .replace(/\./g, "")
    .replace(/\s+/g, " ")
    .replace(/\b(street|st|avenue|ave|road|rd|drive|dr|lane|ln|court|ct|boulevard|blvd|north|south|east|west|n|s|e|w)\b/g, "")
    .replace(/[^a-z0-9 ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function usablePhone(value: string) {
  const digits = digitsPhone(value);
  return digits.length >= 7 ? digits : "";
}

export function arrivedPhysically(am: AmArrival) {
  return am === "PARENT_DROP_OFF" || am === "BUS_DROP_OFF";
}

export function onBusToday(pm: PmDismissal) {
  return pm === "CONFIRMED_BUS";
}

let gateReady: Promise<void> | null = null;

export async function ensureGateTables() {
  if (!gateReady) {
    gateReady = (async () => {
      const statements = [
        `ALTER TABLE "Student" ADD COLUMN IF NOT EXISTS "familyId" TEXT`,
        `ALTER TABLE "Student" ADD COLUMN IF NOT EXISTS "enrollmentSource" TEXT NOT NULL DEFAULT 'RETURNING'`,
        `ALTER TABLE "Student" ADD COLUMN IF NOT EXISTS "vehicleId" TEXT`,
        `CREATE TABLE IF NOT EXISTS "Family" (
          "id" TEXT NOT NULL,
          "schoolId" TEXT NOT NULL,
          "familyKey" TEXT NOT NULL,
          "reviewNeeded" BOOLEAN NOT NULL DEFAULT false,
          "reviewNote" TEXT NOT NULL DEFAULT '',
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT "Family_pkey" PRIMARY KEY ("id")
        )`,
        `CREATE UNIQUE INDEX IF NOT EXISTS "Family_schoolId_familyKey_key" ON "Family"("schoolId", "familyKey")`,
        `CREATE TABLE IF NOT EXISTS "TransportVehicle" (
          "id" TEXT NOT NULL,
          "schoolId" TEXT NOT NULL,
          "name" TEXT NOT NULL,
          "vehicleType" TEXT NOT NULL DEFAULT 'BUS',
          "driverName" TEXT NOT NULL DEFAULT '',
          "driverPhone" TEXT NOT NULL DEFAULT '',
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT "TransportVehicle_pkey" PRIMARY KEY ("id")
        )`,
        `CREATE UNIQUE INDEX IF NOT EXISTS "TransportVehicle_schoolId_name_key" ON "TransportVehicle"("schoolId", "name")`,
        `CREATE TABLE IF NOT EXISTS "GateDayStatus" (
          "id" TEXT NOT NULL,
          "schoolId" TEXT NOT NULL,
          "studentId" TEXT NOT NULL,
          "date" TEXT NOT NULL,
          "amArrival" TEXT NOT NULL DEFAULT 'NOT_CHECKED_IN',
          "amFollowUp" TEXT NOT NULL DEFAULT 'FOLLOW_UP_NOT_NEEDED',
          "pmDismissal" TEXT NOT NULL DEFAULT 'NOT_CONFIRMED',
          "transportNotes" TEXT NOT NULL DEFAULT '',
          "tempVehicleName" TEXT NOT NULL DEFAULT '',
          "amArrivalAt" TIMESTAMP(3),
          "updatedById" TEXT NOT NULL,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT "GateDayStatus_pkey" PRIMARY KEY ("id")
        )`,
        `CREATE UNIQUE INDEX IF NOT EXISTS "GateDayStatus_studentId_date_key" ON "GateDayStatus"("studentId", "date")`,
        `ALTER TABLE "GateDayStatus" ADD COLUMN IF NOT EXISTS "tempVehicleName" TEXT NOT NULL DEFAULT ''`,
        `CREATE TABLE IF NOT EXISTS "GateStatusHistory" (
          "id" TEXT NOT NULL,
          "schoolId" TEXT NOT NULL,
          "studentId" TEXT NOT NULL,
          "date" TEXT NOT NULL,
          "field" TEXT NOT NULL,
          "previous" TEXT NOT NULL,
          "next" TEXT NOT NULL,
          "actorId" TEXT NOT NULL,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT "GateStatusHistory_pkey" PRIMARY KEY ("id")
        )`,
        `CREATE TABLE IF NOT EXISTS "GradeDismissalConfirm" (
          "id" TEXT NOT NULL,
          "schoolId" TEXT NOT NULL,
          "date" TEXT NOT NULL,
          "grade" TEXT NOT NULL,
          "status" TEXT NOT NULL DEFAULT 'WAITING_TEACHER',
          "updatedById" TEXT NOT NULL,
          "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT "GradeDismissalConfirm_pkey" PRIMARY KEY ("id")
        )`,
        `CREATE UNIQUE INDEX IF NOT EXISTS "GradeDismissalConfirm_schoolId_date_grade_key"
          ON "GradeDismissalConfirm"("schoolId", "date", "grade")`,
      ];
      for (const sql of statements) {
        await prisma.$executeRawUnsafe(sql).catch(() => undefined);
      }
    })();
  }
  await gateReady;
}

type RawStudent = {
  id: string;
  studentId: string;
  firstName: string;
  lastName: string;
  grade: string;
  parentName: string;
  parentPhone: string;
  familyId: string | null;
  enrollmentSource: string | null;
  vehicleId: string | null;
  teacherName: string | null;
  line1: string;
  city: string;
  state: string;
  zip: string;
};

async function loadRawStudents(schoolId: string): Promise<RawStudent[]> {
  return prisma.$queryRaw<RawStudent[]>`
    SELECT
      s."id",
      s."studentId",
      s."firstName",
      s."lastName",
      s."grade",
      s."parentName",
      s."parentPhone",
      s."familyId",
      s."enrollmentSource",
      s."vehicleId",
      (
        SELECT t."name"
        FROM "Teacher" t
        WHERE t."classroomId" = s."classroomId"
        ORDER BY t."name"
        LIMIT 1
      ) AS "teacherName",
      a."line1",
      a."city",
      a."state",
      a."zip"
    FROM "Student" s
    JOIN "Address" a ON a."id" = s."homeAddressId"
    WHERE s."schoolId" = ${schoolId}
    ORDER BY s."lastName", s."firstName"
  `;
}

async function nextFamilyKey(schoolId: string) {
  const rows = await prisma.$queryRaw<Array<{ familyKey: string }>>`
    SELECT "familyKey" FROM "Family" WHERE "schoolId" = ${schoolId}
  `;
  let max = 1000;
  for (const row of rows) {
    const n = Number(String(row.familyKey).replace(/\D/g, ""));
    if (Number.isFinite(n) && n > max) max = n;
  }
  return `FAM-${max + 1}`;
}

async function createFamily(
  schoolId: string,
  reviewNeeded = false,
  reviewNote = "",
) {
  const id = newId();
  const familyKey = await nextFamilyKey(schoolId);
  await prisma.$executeRaw`
    INSERT INTO "Family" ("id", "schoolId", "familyKey", "reviewNeeded", "reviewNote", "createdAt")
    VALUES (${id}, ${schoolId}, ${familyKey}, ${reviewNeeded}, ${reviewNote}, CURRENT_TIMESTAMP)
  `;
  return { id, familyKey };
}

function matchSignals(a: RawStudent, b: RawStudent) {
  const phoneA = usablePhone(a.parentPhone);
  const phoneB = usablePhone(b.parentPhone);
  const nameA = normName(a.parentName);
  const nameB = normName(b.parentName);
  const addrA = normAddress(`${a.line1} ${a.city} ${a.zip}`);
  const addrB = normAddress(`${b.line1} ${b.city} ${b.zip}`);
  const phone = Boolean(phoneA && phoneA === phoneB);
  const name = Boolean(nameA && nameA !== "—" && nameA === nameB);
  const address = Boolean(addrA && addrA === addrB && !addrA.includes("pending"));
  return { phone, name, address };
}

export async function assignMissingFamilies(schoolId: string) {
  await ensureGateTables();
  const students = await loadRawStudents(schoolId);
  const unassigned = students.filter((s) => !s.familyId);
  if (!unassigned.length) return { assigned: 0, flagged: 0 };

  const assigned = new Map<string, string>();
  let created = 0;
  let flagged = 0;

  for (const student of unassigned) {
    if (assigned.has(student.id)) continue;

    const certainUnassigned: RawStudent[] = [student];
    const uncertain: { other: RawStudent; note: string }[] = [];
    let existingFamilyId = "";

    for (const other of students) {
      if (other.id === student.id) continue;
      const signals = matchSignals(student, other);
      const certain =
        (signals.phone && signals.name) ||
        (signals.phone && signals.address && !signals.name);
      if (certain) {
        const familyId = assigned.get(other.id) || other.familyId;
        if (familyId && !existingFamilyId) existingFamilyId = familyId;
        if (!other.familyId && !assigned.has(other.id)) {
          certainUnassigned.push(other);
        }
        continue;
      }
      if (signals.phone && !signals.name && !signals.address) {
        uncertain.push({
          other,
          note: "Same phone, different parent name and address — review before combining.",
        });
      } else if (signals.name && signals.address && !signals.phone) {
        uncertain.push({
          other,
          note: "Same parent name and address, different phone — review before combining.",
        });
      }
    }

    const family = existingFamilyId
      ? { id: existingFamilyId }
      : await createFamily(schoolId);
    if (!existingFamilyId) created += 1;
    const members = [
      ...new Map(certainUnassigned.map((row) => [row.id, row])).values(),
    ];
    for (const member of members) {
      assigned.set(member.id, family.id);
      await prisma.$executeRaw`
        UPDATE "Student" SET "familyId" = ${family.id} WHERE "id" = ${member.id}
      `;
    }

    if (uncertain.length) {
      flagged += uncertain.length;
      const note = uncertain
        .map(
          (item) =>
            `${item.other.firstName} ${item.other.lastName}: ${item.note}`,
        )
        .join(" ");
      await prisma.$executeRaw`
        UPDATE "Family"
        SET "reviewNeeded" = true, "reviewNote" = ${note}
        WHERE "id" = ${family.id}
      `;
    }
  }

  return { assigned: created, flagged };
}

type StatusRow = {
  studentId: string;
  amArrival: string;
  amFollowUp: string;
  pmDismissal: string;
  transportNotes: string;
  tempVehicleName: string;
  amArrivalAt: Date | null;
  updatedAt: Date;
  updaterName: string;
};

type VehicleRow = {
  id: string;
  name: string;
  vehicleType: string;
  driverName: string;
  driverPhone: string;
};

type FamilyRow = {
  id: string;
  familyKey: string;
  reviewNeeded: boolean;
  reviewNote: string;
};

export async function loadVehicles(schoolId: string): Promise<VehicleRow[]> {
  await ensureGateTables();
  return prisma.$queryRaw<VehicleRow[]>`
    SELECT "id", "name", "vehicleType", "driverName", "driverPhone"
    FROM "TransportVehicle"
    WHERE "schoolId" = ${schoolId}
    ORDER BY "name"
  `;
}

export async function loadGateRoster(
  schoolId: string,
  date = todayKey(),
): Promise<GateStudent[]> {
  await ensureGateTables();
  await assignMissingFamilies(schoolId);

  const students = await loadRawStudents(schoolId);
  const [statuses, vehicles, families] = await Promise.all([
    prisma.$queryRaw<StatusRow[]>`
      SELECT
        g."studentId",
        g."amArrival",
        g."amFollowUp",
        g."pmDismissal",
        g."transportNotes",
        g."tempVehicleName",
        g."amArrivalAt",
        g."updatedAt",
        u."name" AS "updaterName"
      FROM "GateDayStatus" g
      JOIN "User" u ON u."id" = g."updatedById"
      WHERE g."schoolId" = ${schoolId} AND g."date" = ${date}
    `,
    loadVehicles(schoolId),
    prisma.$queryRaw<FamilyRow[]>`
      SELECT "id", "familyKey", "reviewNeeded", "reviewNote"
      FROM "Family"
      WHERE "schoolId" = ${schoolId}
    `,
  ]);

  const statusById = new Map(statuses.map((row) => [row.studentId, row]));
  const vehicleById = new Map(vehicles.map((row) => [row.id, row]));
  const familyById = new Map(families.map((row) => [row.id, row]));

  const nameCounts = new Map<string, number>();
  for (const student of students) {
    const key = `${normName(student.firstName)}|${normName(student.lastName)}`;
    nameCounts.set(key, (nameCounts.get(key) || 0) + 1);
  }

  return students.map((student) => {
    const status = statusById.get(student.id);
    const family = student.familyId ? familyById.get(student.familyId) : undefined;
    const vehicle = student.vehicleId
      ? vehicleById.get(student.vehicleId)
      : undefined;
    const nameKey = `${normName(student.firstName)}|${normName(student.lastName)}`;
    return {
      id: student.id,
      studentId: student.studentId,
      firstName: student.firstName,
      lastName: student.lastName,
      fullName: `${student.firstName} ${student.lastName}`,
      grade: student.grade,
      teacherName: student.teacherName || "Unassigned",
      parentName: student.parentName,
      parentPhone: student.parentPhone,
      address: student.line1,
      city: student.city,
      state: student.state,
      zip: student.zip,
      familyId: student.familyId || "",
      familyKey: family?.familyKey || "—",
      reviewNeeded: Boolean(family?.reviewNeeded),
      reviewNote: family?.reviewNote || "",
      enrollmentSource: asEnroll(student.enrollmentSource),
      vehicleName: vehicle?.name || "Not Assigned",
      driverName: vehicle?.driverName || "",
      driverPhone: vehicle?.driverPhone || "",
      amArrival: asAm(status?.amArrival),
      amFollowUp: asFollow(status?.amFollowUp),
      pmDismissal: asPm(status?.pmDismissal),
      transportNotes: status?.transportNotes || "",
      tempVehicleName: status?.tempVehicleName || "",
      amArrivalAt: status?.amArrivalAt
        ? status.amArrivalAt.toISOString()
        : null,
      updatedByName: status?.updaterName || "",
      updatedAt: status?.updatedAt ? status.updatedAt.toISOString() : null,
      nameDupCount: nameCounts.get(nameKey) || 1,
    };
  });
}

export function groupFamilies(students: GateStudent[]): GateFamily[] {
  const groups = new Map<string, GateFamily>();
  for (const student of students) {
    const key = student.familyId || student.id;
    const existing = groups.get(key);
    if (existing) {
      existing.students.push(student);
      continue;
    }
    groups.set(key, {
      familyId: student.familyId || student.id,
      familyKey: student.familyKey,
      parentName: student.parentName,
      parentPhone: student.parentPhone,
      address: student.address,
      city: student.city,
      zip: student.zip,
      reviewNeeded: student.reviewNeeded,
      reviewNote: student.reviewNote,
      students: [student],
    });
  }
  return [...groups.values()].sort((a, b) =>
    a.students[0].lastName.localeCompare(b.students[0].lastName),
  );
}

function searchHaystack(parts: Array<string | null | undefined>) {
  return parts
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function nameQueryHits(hay: string, query: string) {
  const q = query.trim().toLowerCase().replace(/\s+/g, " ");
  if (!q) return true;
  if (hay.includes(q)) return true;
  return q.split(" ").every((part) => part.length > 0 && hay.includes(part));
}

export function searchGateStudents(students: GateStudent[], query: string) {
  const q = query.trim().toLowerCase();
  if (!q) return students;
  const qDigits = digitsPhone(q);
  const matchedIds = new Set<string>();
  const matchedFamilies = new Set<string>();

  for (const student of students) {
    const hay = searchHaystack([
      student.firstName,
      student.lastName,
      student.fullName,
      student.parentName,
      student.parentPhone,
      student.familyKey,
      student.address,
      student.city,
      student.zip,
      student.studentId,
    ]);
    const phoneHit = qDigits.length >= 4 && digitsPhone(student.parentPhone).includes(qDigits);
    if (nameQueryHits(hay, q) || phoneHit) {
      matchedIds.add(student.id);
      if (student.familyId) matchedFamilies.add(student.familyId);
    }
  }

  return students.filter(
    (student) =>
      matchedIds.has(student.id) ||
      (student.familyId && matchedFamilies.has(student.familyId)),
  );
}

export function schoolGrades(students: GateStudent[]) {
  const extras = [
    ...new Set(
      students
        .map((s) => s.grade)
        .filter((grade) => grade && !STANDARD_GRADES.includes(grade)),
    ),
  ].sort((a, b) => a.localeCompare(b));
  return [...STANDARD_GRADES, ...extras];
}

export type GateCounts = {
  totalStudents: number;
  totalFamilies: number;
  returning: number;
  newApplication: number;
  checkedIn: number;
  notCheckedIn: number;
  confirmedAbsences: number;
  arrivingLate: number;
  absentNoBus: number;
  absentSick: number;
  transferred: number;
  unableToReach: number;
  parentDropOff: number;
  busDropOff: number;
  parentPickupConfirmed: { students: number; families: number };
  pickupTodayBusTomorrow: { students: number; families: number };
  confirmedBus: { students: number; families: number };
  notConfirmed: { students: number; families: number };
};

function familyCount(students: GateStudent[], test: (s: GateStudent) => boolean) {
  return new Set(students.filter(test).map((s) => s.familyId || s.id)).size;
}

export function gateCounts(students: GateStudent[]): GateCounts {
  const pair = (test: (s: GateStudent) => boolean) => ({
    students: students.filter(test).length,
    families: familyCount(students, test),
  });
  return {
    totalStudents: students.length,
    totalFamilies: new Set(students.map((s) => s.familyId || s.id)).size,
    returning: students.filter((s) => s.enrollmentSource === "RETURNING").length,
    newApplication: students.filter((s) => s.enrollmentSource === "NEW_APPLICATION")
      .length,
    checkedIn: students.filter((s) => arrivedPhysically(s.amArrival)).length,
    notCheckedIn: students.filter((s) => s.amArrival === "NOT_CHECKED_IN").length,
    confirmedAbsences: students.filter((s) => s.amArrival === "ABSENT_CONFIRMED")
      .length,
    arrivingLate: students.filter((s) => s.amFollowUp === "ARRIVING_LATE").length,
    absentNoBus: students.filter((s) => s.amFollowUp === "ABSENT_NO_BUS").length,
    absentSick: students.filter((s) => s.amFollowUp === "ABSENT_SICK").length,
    transferred: students.filter((s) => s.amFollowUp === "TRANSFERRED").length,
    unableToReach: students.filter((s) => s.amFollowUp === "UNABLE_TO_REACH").length,
    parentDropOff: students.filter((s) => s.amArrival === "PARENT_DROP_OFF").length,
    busDropOff: students.filter((s) => s.amArrival === "BUS_DROP_OFF").length,
    parentPickupConfirmed: pair((s) => s.pmDismissal === "PARENT_PICKUP_CONFIRMED"),
    pickupTodayBusTomorrow: pair(
      (s) => s.pmDismissal === "PARENT_PICKUP_TODAY_BUS_TOMORROW",
    ),
    confirmedBus: pair((s) => s.pmDismissal === "CONFIRMED_BUS"),
    notConfirmed: pair((s) => s.pmDismissal === "NOT_CONFIRMED"),
  };
}

export function lastUpdatedStamp(students: GateStudent[]) {
  const times = students
    .map((s) => (s.updatedAt ? new Date(s.updatedAt).getTime() : 0))
    .filter(Boolean);
  if (!times.length) return "No gate updates yet today";
  const latest = new Date(Math.max(...times));
  return `${todayKey()} · ${formatTime(latest)}`;
}

export async function loadGradeConfirm(schoolId: string, date: string, grade: string) {
  await ensureGateTables();
  const rows = await prisma.$queryRaw<
    Array<{ status: string; updatedAt: Date; updaterName: string }>
  >`
    SELECT c."status", c."updatedAt", u."name" AS "updaterName"
    FROM "GradeDismissalConfirm" c
    JOIN "User" u ON u."id" = c."updatedById"
    WHERE c."schoolId" = ${schoolId} AND c."date" = ${date} AND c."grade" = ${grade}
  `;
  const row = rows[0];
  return {
    status: (GRADE_CONFIRM.includes(row?.status as GradeConfirm)
      ? row?.status
      : "WAITING_TEACHER") as GradeConfirm,
    updatedAt: row?.updatedAt?.toISOString() || null,
    updatedByName: row?.updaterName || "",
  };
}

export async function upsertGateStatus(args: {
  user: SessionUser;
  studentId: string;
  date?: string;
  field: "amArrival" | "amFollowUp" | "pmDismissal" | "transportNotes" | "tempVehicleName";
  value: string;
  expected?: string | null;
  applyFamily?: boolean;
  confirmedIdentity?: boolean;
}) {
  await ensureGateTables();
  const date = args.date || todayKey();
  const roster = await loadGateRoster(args.user.schoolId, date);
  const target = roster.find((s) => s.id === args.studentId);
  if (!target) return { ok: false as const, error: "Student not found." };

  if (target.nameDupCount > 1 && !args.confirmedIdentity && !args.applyFamily) {
    return {
      ok: false as const,
      error:
        "Another student has this same name. Confirm the full name plus parent phone or address before saving.",
    };
  }

  const members = args.applyFamily
    ? roster.filter((s) => s.familyId && s.familyId === target.familyId)
    : [target];

  const results: Array<{
    studentId: string;
    name: string;
    conflict?: boolean;
    current?: string;
  }> = [];

  for (const student of members) {
    const current =
      args.field === "amArrival"
        ? student.amArrival
        : args.field === "amFollowUp"
          ? student.amFollowUp
          : args.field === "pmDismissal"
            ? student.pmDismissal
            : args.field === "transportNotes"
              ? student.transportNotes
              : student.tempVehicleName;

    if (
      args.expected != null &&
      args.expected !== current &&
      members.length === 1
    ) {
      results.push({
        studentId: student.id,
        name: student.fullName,
        conflict: true,
        current,
      });
      continue;
    }

    if (
      args.field === "pmDismissal" &&
      (current === "PARENT_PICKUP_CONFIRMED" ||
        current === "PARENT_PICKUP_TODAY_BUS_TOMORROW") &&
      args.value === "CONFIRMED_BUS" &&
      !args.applyFamily
    ) {
      // Caller must pass a separate confirmedBusWarning flag via expected flow.
    }

    await writeStatusRow({
      user: args.user,
      student,
      date,
      field: args.field,
      previous: current,
      next: args.value,
    });
    results.push({ studentId: student.id, name: student.fullName });
  }

  return { ok: true as const, results };
}

async function writeStatusRow(args: {
  user: SessionUser;
  student: GateStudent;
  date: string;
  field: "amArrival" | "amFollowUp" | "pmDismissal" | "transportNotes" | "tempVehicleName";
  previous: string;
  next: string;
}) {
  if (args.previous === args.next) return;

  const existing = await prisma.$queryRaw<Array<{ id: string }>>`
    SELECT "id" FROM "GateDayStatus"
    WHERE "studentId" = ${args.student.id} AND "date" = ${args.date}
  `;

  const amArrival =
    args.field === "amArrival" ? args.next : args.student.amArrival;
  const amFollowUp =
    args.field === "amFollowUp" ? args.next : args.student.amFollowUp;
  const pmDismissal =
    args.field === "pmDismissal" ? args.next : args.student.pmDismissal;
  const transportNotes =
    args.field === "transportNotes" ? args.next : args.student.transportNotes;
  const tempVehicleName =
    args.field === "tempVehicleName" ? args.next : args.student.tempVehicleName;
  const stampArrival =
    args.field === "amArrival" &&
    args.next !== "NOT_CHECKED_IN" &&
    args.previous === "NOT_CHECKED_IN";

  if (existing[0]) {
    if (stampArrival) {
      await prisma.$executeRaw`
        UPDATE "GateDayStatus"
        SET
          "amArrival" = ${amArrival},
          "amFollowUp" = ${amFollowUp},
          "pmDismissal" = ${pmDismissal},
          "transportNotes" = ${transportNotes},
          "tempVehicleName" = ${tempVehicleName},
          "amArrivalAt" = CURRENT_TIMESTAMP,
          "updatedById" = ${args.user.id},
          "updatedAt" = CURRENT_TIMESTAMP
        WHERE "id" = ${existing[0].id}
      `;
    } else {
      await prisma.$executeRaw`
        UPDATE "GateDayStatus"
        SET
          "amArrival" = ${amArrival},
          "amFollowUp" = ${amFollowUp},
          "pmDismissal" = ${pmDismissal},
          "transportNotes" = ${transportNotes},
          "tempVehicleName" = ${tempVehicleName},
          "updatedById" = ${args.user.id},
          "updatedAt" = CURRENT_TIMESTAMP
        WHERE "id" = ${existing[0].id}
      `;
    }
  } else {
    const id = newId();
    await prisma.$executeRaw`
      INSERT INTO "GateDayStatus" (
        "id", "schoolId", "studentId", "date",
        "amArrival", "amFollowUp", "pmDismissal",
        "transportNotes", "tempVehicleName",
        "amArrivalAt", "updatedById", "createdAt", "updatedAt"
      ) VALUES (
        ${id}, ${args.user.schoolId}, ${args.student.id}, ${args.date},
        ${amArrival}, ${amFollowUp}, ${pmDismissal},
        ${transportNotes}, ${tempVehicleName},
        ${stampArrival ? new Date() : null}, ${args.user.id},
        CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
      )
    `;
  }

  await prisma.$executeRaw`
    INSERT INTO "GateStatusHistory" (
      "id", "schoolId", "studentId", "date", "field", "previous", "next", "actorId", "createdAt"
    ) VALUES (
      ${newId()}, ${args.user.schoolId}, ${args.student.id}, ${args.date},
      ${args.field}, ${args.previous}, ${args.next}, ${args.user.id}, CURRENT_TIMESTAMP
    )
  `;
}

export async function applyFamilyStatuses(args: {
  user: SessionUser;
  studentId: string;
  amArrival?: AmArrival;
  pmDismissal?: PmDismissal;
  amFollowUp?: AmFollowUp;
  transportNotes?: string;
  confirmed?: boolean;
}) {
  if (!args.confirmed) {
    return {
      ok: false as const,
      error: "Confirm before applying this change to every sibling.",
    };
  }
  const date = todayKey();
  const roster = await loadGateRoster(args.user.schoolId, date);
  const target = roster.find((s) => s.id === args.studentId);
  if (!target) return { ok: false as const, error: "Student not found." };
  const members = roster.filter(
    (s) => s.familyId && s.familyId === target.familyId,
  );
  for (const student of members) {
    if (args.amArrival) {
      await writeStatusRow({
        user: args.user,
        student,
        date,
        field: "amArrival",
        previous: student.amArrival,
        next: args.amArrival,
      });
      student.amArrival = args.amArrival;
    }
    if (args.amFollowUp) {
      await writeStatusRow({
        user: args.user,
        student,
        date,
        field: "amFollowUp",
        previous: student.amFollowUp,
        next: args.amFollowUp,
      });
      student.amFollowUp = args.amFollowUp;
    }
    if (args.pmDismissal) {
      await writeStatusRow({
        user: args.user,
        student,
        date,
        field: "pmDismissal",
        previous: student.pmDismissal,
        next: args.pmDismissal,
      });
      student.pmDismissal = args.pmDismissal;
    }
    if (args.transportNotes != null) {
      await writeStatusRow({
        user: args.user,
        student,
        date,
        field: "transportNotes",
        previous: student.transportNotes,
        next: args.transportNotes,
      });
    }
  }
  return { ok: true as const, count: members.length };
}

export async function setGradeConfirm(args: {
  user: SessionUser;
  grade: string;
  status: GradeConfirm;
  date?: string;
}) {
  await ensureGateTables();
  const date = args.date || todayKey();
  const existing = await prisma.$queryRaw<Array<{ id: string }>>`
    SELECT "id" FROM "GradeDismissalConfirm"
    WHERE "schoolId" = ${args.user.schoolId} AND "date" = ${date} AND "grade" = ${args.grade}
  `;
  if (existing[0]) {
    await prisma.$executeRaw`
      UPDATE "GradeDismissalConfirm"
      SET "status" = ${args.status}, "updatedById" = ${args.user.id}, "updatedAt" = CURRENT_TIMESTAMP
      WHERE "id" = ${existing[0].id}
    `;
  } else {
    await prisma.$executeRaw`
      INSERT INTO "GradeDismissalConfirm"
        ("id", "schoolId", "date", "grade", "status", "updatedById", "updatedAt")
      VALUES
        (${newId()}, ${args.user.schoolId}, ${date}, ${args.grade}, ${args.status}, ${args.user.id}, CURRENT_TIMESTAMP)
    `;
  }
  return { ok: true as const };
}

export async function saveVehicle(args: {
  user: SessionUser;
  id?: string;
  name: string;
  vehicleType: string;
  driverName: string;
  driverPhone: string;
}) {
  await ensureGateTables();
  const name = args.name.trim();
  if (!name) return { ok: false as const, error: "Vehicle name is required." };
  if (args.id) {
    await prisma.$executeRaw`
      UPDATE "TransportVehicle"
      SET
        "name" = ${name},
        "vehicleType" = ${args.vehicleType},
        "driverName" = ${args.driverName.trim()},
        "driverPhone" = ${args.driverPhone.trim()},
        "updatedAt" = CURRENT_TIMESTAMP
      WHERE "id" = ${args.id} AND "schoolId" = ${args.user.schoolId}
    `;
    return { ok: true as const, id: args.id };
  }
  const id = newId();
  await prisma.$executeRaw`
    INSERT INTO "TransportVehicle"
      ("id", "schoolId", "name", "vehicleType", "driverName", "driverPhone", "createdAt", "updatedAt")
    VALUES
      (${id}, ${args.user.schoolId}, ${name}, ${args.vehicleType}, ${args.driverName.trim()}, ${args.driverPhone.trim()}, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
  `;
  return { ok: true as const, id };
}

export async function assignStudentVehicle(args: {
  user: SessionUser;
  studentId: string;
  vehicleId: string | null;
}) {
  await ensureGateTables();
  await prisma.$executeRaw`
    UPDATE "Student"
    SET "vehicleId" = ${args.vehicleId}, "updatedAt" = CURRENT_TIMESTAMP
    WHERE "id" = ${args.studentId} AND "schoolId" = ${args.user.schoolId}
  `;
  return { ok: true as const };
}

export async function assignTempVehicleToFamilies(args: {
  user: SessionUser;
  familyIds: string[];
  vehicleName: string;
  date?: string;
}) {
  const date = args.date || todayKey();
  const roster = await loadGateRoster(args.user.schoolId, date);
  const wanted = new Set(args.familyIds);
  const students = roster.filter(
    (s) =>
      wanted.has(s.familyId) &&
      s.pmDismissal === "PARENT_PICKUP_TODAY_BUS_TOMORROW",
  );
  for (const student of students) {
    await writeStatusRow({
      user: args.user,
      student,
      date,
      field: "tempVehicleName",
      previous: student.tempVehicleName,
      next: args.vehicleName,
    });
  }
  return { ok: true as const, count: students.length };
}

export async function loadGateHistory(schoolId: string, studentId: string) {
  await ensureGateTables();
  return prisma.$queryRaw<
    Array<{
      date: string;
      field: string;
      previous: string;
      next: string;
      actorName: string;
      createdAt: Date;
    }>
  >`
    SELECT h."date", h."field", h."previous", h."next", u."name" AS "actorName", h."createdAt"
    FROM "GateStatusHistory" h
    JOIN "User" u ON u."id" = h."actorId"
    WHERE h."schoolId" = ${schoolId} AND h."studentId" = ${studentId}
    ORDER BY h."createdAt" DESC
    LIMIT 80
  `;
}

export function parentPickupToday(students: GateStudent[]) {
  return students
    .filter(
      (s) =>
        s.pmDismissal === "PARENT_PICKUP_CONFIRMED" ||
        s.pmDismissal === "PARENT_PICKUP_TODAY_BUS_TOMORROW",
    )
    .sort(
      (a, b) =>
        a.lastName.localeCompare(b.lastName) ||
        a.firstName.localeCompare(b.firstName),
    );
}

export function groupConfirmedBus(students: GateStudent[]) {
  const map = new Map<string, GateStudent[]>();
  for (const student of students.filter((s) => s.pmDismissal === "CONFIRMED_BUS")) {
    const assigned =
      student.tempVehicleName.trim() ||
      (student.vehicleName && student.vehicleName !== "Not Assigned"
        ? student.vehicleName
        : "");
    const key = assigned || "Not Assigned";
    const list = map.get(key) ?? [];
    list.push(student);
    map.set(key, list);
  }
  for (const list of map.values()) {
    list.sort(
      (a, b) =>
        a.lastName.localeCompare(b.lastName) ||
        a.firstName.localeCompare(b.firstName),
    );
  }
  return [...map.entries()].sort(([a], [b]) => {
    if (a === "Not Assigned") return 1;
    if (b === "Not Assigned") return -1;
    return a.localeCompare(b);
  });
}

export function busTomorrowFamilies(students: GateStudent[]) {
  const needed = students.filter(
    (s) => s.pmDismissal === "PARENT_PICKUP_TODAY_BUS_TOMORROW",
  );
  return groupFamilies(needed).sort((a, b) => {
    return (
      a.zip.localeCompare(b.zip) ||
      a.address.localeCompare(b.address) ||
      a.familyKey.localeCompare(b.familyKey)
    );
  });
}

export function activeDismissalStudents(students: GateStudent[]) {
  return students.filter((s) => arrivedPhysically(s.amArrival));
}

export type ImportSummary = {
  fileName: string;
  sourceStudents: number;
  sourceFamilies: number;
  created: number;
  updated: number;
  excludedNotReturning: number;
  excludedNoName: number;
  duplicateNameRows: number;
  errors: number;
  rosterStudents: number;
  rosterFamilies: number;
  at: string;
};

async function ensureImportSummaryColumn() {
  await prisma.$executeRawUnsafe(
    `ALTER TABLE "SchoolSettings" ADD COLUMN IF NOT EXISTS "importSummary" TEXT NOT NULL DEFAULT ''`,
  ).catch(() => undefined);
}

export async function saveImportSummary(
  schoolId: string,
  summary: ImportSummary,
) {
  await ensureImportSummaryColumn();
  const existing = await prisma.schoolSettings.findUnique({
    where: { schoolId },
    select: { id: true },
  });
  if (!existing) {
    await prisma.schoolSettings.create({
      data: { id: randomUUID(), schoolId },
    }).catch(() => undefined);
  }
  const payload = JSON.stringify(summary);
  await prisma.$executeRaw`
    UPDATE "SchoolSettings"
    SET "importSummary" = ${payload}
    WHERE "schoolId" = ${schoolId}
  `.catch(() => undefined);
}

export async function loadImportSummary(schoolId: string) {
  await ensureImportSummaryColumn();
  const rows = await prisma.$queryRaw<Array<{ importSummary: string }>>`
    SELECT "importSummary" FROM "SchoolSettings" WHERE "schoolId" = ${schoolId}
  `.catch(() => []);
  const raw = rows[0]?.importSummary || "";
  if (!raw) return null;
  try {
    return JSON.parse(raw) as ImportSummary;
  } catch {
    return null;
  }
}

export function teachersForGrade(
  grade: string,
  students: GateStudent[],
) {
  return [
    ...new Set(
      students.filter((s) => s.grade === grade).map((s) => s.teacherName),
    ),
  ].filter((name) => name && name !== "Unassigned");
}
