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
  const matches = await loadSchoolsByCompanyEmail(user.email);
  if (matches.length) return matches;

  const home = await prisma.school.findUnique({
    where: { id: user.schoolId },
    select: { id: true, name: true, slug: true },
  });
  return home ? [home] : [];
}

export async function canCompanyAccessSchool(
  user: SessionUser,
  schoolId: string,
) {
  if (user.role !== "BUS_COMPANY") return false;
  const schools = await loadCompanySchools(user);
  return schools.some((school) => school.id === schoolId);
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
