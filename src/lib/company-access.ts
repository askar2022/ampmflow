import { prisma } from "@/lib/prisma";
import {
  loadSchoolDeskNotifyEmails,
  saveSchoolBusCompanyEmail,
  usableOpsEmail,
} from "@/lib/ops-change-emails";
import type { SessionUser } from "@/lib/types";

export type CompanySchool = {
  id: string;
  name: string;
  slug: string | null;
};

function nameKey(name: string) {
  return name.trim().toLowerCase();
}

export async function ensureCompanyColumns() {
  await prisma
    .$executeRawUnsafe(
      `ALTER TABLE "SchoolSettings" ADD COLUMN IF NOT EXISTS "busCompanyEmail" TEXT NOT NULL DEFAULT ''`,
    )
    .catch(() => undefined);
}

export async function loadSchoolsByCompanyEmail(email: string) {
  const value = usableOpsEmail(email);
  if (!value) return [] as CompanySchool[];
  await ensureCompanyColumns();
  try {
    return await prisma.$queryRaw<CompanySchool[]>`
      SELECT s."id", s."name", s."slug"
      FROM "School" s
      JOIN "SchoolSettings" st ON st."schoolId" = s."id"
      WHERE lower(st."busCompanyEmail") = ${value}
      ORDER BY s."name"
    `;
  } catch {
    return [];
  }
}

/** Schools that emailed this company on an unfinished request (covers unlinked settings). */
export async function loadSchoolsByPendingRequestEmail(email: string) {
  const value = usableOpsEmail(email);
  if (!value) return [] as CompanySchool[];
  try {
    return await prisma.$queryRaw<CompanySchool[]>`
      SELECT DISTINCT s."id", s."name", s."slug"
      FROM "School" s
      JOIN "ChangeRequest" cr ON cr."schoolId" = s."id"
      WHERE cr."status" IN ('PENDING', 'NEEDS_CLARIFICATION')
        AND position(${value} in lower(cr."details")) > 0
      ORDER BY s."name"
    `;
  } catch {
    return [];
  }
}

/** Every school row that shares this campus name (duplicate Aim rows, etc.). */
export async function companySchoolGroupIds(school: CompanySchool) {
  const rows = await prisma.school.findMany({
    where: { name: { equals: school.name, mode: "insensitive" } },
    select: { id: true },
  });
  return [...new Set([school.id, ...rows.map((row) => row.id)])];
}

export async function assignCompanySchools(email: string, schoolIds: string[]) {
  const value = usableOpsEmail(email);
  if (!value) return;
  const current = await loadSchoolsByCompanyEmail(value);
  const wanted = new Set(schoolIds);
  for (const schoolId of schoolIds) {
    await saveSchoolBusCompanyEmail(schoolId, value).catch(() => undefined);
  }
  for (const school of current) {
    if (wanted.has(school.id)) continue;
    await prisma
      .$executeRaw`
        UPDATE "SchoolSettings"
        SET "busCompanyEmail" = ${""}
        WHERE "schoolId" = ${school.id}
          AND lower("busCompanyEmail") = ${value}
      `
      .catch(() => undefined);
  }
}

export async function loadCompanySchools(user: SessionUser) {
  const [emailMatches, pendingMatches] = await Promise.all([
    loadSchoolsByCompanyEmail(user.email),
    loadSchoolsByPendingRequestEmail(user.email),
  ]);

  const byId = new Map<string, CompanySchool>();
  for (const school of [...emailMatches, ...pendingMatches]) {
    byId.set(school.id, school);
  }

  if (!byId.size) {
    const home = await prisma.school.findUnique({
      where: { id: user.schoolId },
      select: { id: true, name: true, slug: true },
    });
    if (home) byId.set(home.id, home);
  }

  const names = [...new Set([...byId.values()].map((school) => school.name))];
  if (names.length) {
    const siblings = await prisma.school.findMany({
      where: {
        OR: names.map((name) => ({
          name: { equals: name, mode: "insensitive" as const },
        })),
      },
      select: { id: true, name: true, slug: true },
    });
    for (const school of siblings) byId.set(school.id, school);
  }

  // One dropdown row per campus name; prefer the row already linked by email.
  const emailIds = new Set(emailMatches.map((school) => school.id));
  const byName = new Map<string, CompanySchool>();
  for (const school of byId.values()) {
    const key = nameKey(school.name);
    const existing = byName.get(key);
    if (!existing || emailIds.has(school.id)) byName.set(key, school);
  }

  return [...byName.values()].sort((a, b) => a.name.localeCompare(b.name));
}

export async function canCompanyAccessSchool(
  user: SessionUser,
  schoolId: string,
) {
  if (user.role !== "BUS_COMPANY") return false;
  const schools = await loadCompanySchools(user);
  if (schools.some((school) => school.id === schoolId)) return true;
  const target = await prisma.school.findUnique({
    where: { id: schoolId },
    select: { name: true },
  });
  if (!target) return false;
  const key = nameKey(target.name);
  return schools.some((school) => nameKey(school.name) === key);
}

export async function schoolStaffEmails(schoolId: string) {
  const saved = await loadSchoolDeskNotifyEmails(schoolId);
  const users = await prisma.user.findMany({
    where: {
      schoolId,
      active: true,
      role: { in: ["COORDINATOR", "FRONT_DESK"] },
    },
    select: { email: true },
  });
  return [
    ...new Set(
      [
        saved.coordinatorEmail,
        saved.frontDeskEmail,
        ...users.map((user) => usableOpsEmail(user.email)),
      ].filter(Boolean),
    ),
  ];
}
