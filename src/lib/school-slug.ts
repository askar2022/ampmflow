import { prisma } from "./prisma";

export const APP_ORIGIN =
  process.env.NEXT_PUBLIC_APP_URL || "https://www.ampmflow.com";

export function schoolSlugFromName(name: string) {
  const slug = name
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return slug || "school";
}

export function schoolLoginPath(slug: string) {
  return `/s/${slug}`;
}

export function schoolLoginUrl(slug: string) {
  return `${APP_ORIGIN.replace(/\/$/, "")}${schoolLoginPath(slug)}`;
}

export async function ensureSchoolSlugColumn() {
  await prisma.$executeRawUnsafe(
    `ALTER TABLE "School" ADD COLUMN IF NOT EXISTS "slug" TEXT`,
  ).catch(() => undefined);
  await prisma.$executeRawUnsafe(
    `CREATE UNIQUE INDEX IF NOT EXISTS "School_slug_key" ON "School" ("slug")`,
  ).catch(() => undefined);
}

export async function findSchoolBySlug(slug: string) {
  const wanted = schoolSlugFromName(slug);
  if (!wanted) return null;
  await ensureSchoolSlugs().catch(() => undefined);
  try {
    const rows = await prisma.$queryRaw<
      Array<{ id: string; name: string; slug: string | null; logoUrl: string | null }>
    >`
      SELECT "id", "name", "slug", "logoUrl" FROM "School" WHERE "slug" = ${wanted}
    `;
    return rows[0] || null;
  } catch {
    return null;
  }
}

export async function schoolSlugForId(schoolId: string) {
  await ensureSchoolSlugColumn();
  try {
    const rows = await prisma.$queryRaw<Array<{ slug: string | null }>>`
      SELECT "slug" FROM "School" WHERE "id" = ${schoolId}
    `;
    return rows[0]?.slug || "";
  } catch {
    return "";
  }
}

export async function assignUniqueSlug(schoolId: string, name: string, requested = "") {
  await ensureSchoolSlugColumn();
  const base = schoolSlugFromName(requested || name);
  let slug = base;
  let n = 2;
  while (true) {
    const rows = await prisma.$queryRaw<Array<{ id: string }>>`
      SELECT "id" FROM "School" WHERE "slug" = ${slug} AND "id" <> ${schoolId}
    `;
    if (!rows[0]) break;
    slug = `${base}-${n}`;
    n += 1;
    if (n > 50) break;
  }
  await prisma.$executeRaw`
    UPDATE "School" SET "slug" = ${slug} WHERE "id" = ${schoolId}
  `;
  return slug;
}

export async function ensureSchoolSlugs() {
  await ensureSchoolSlugColumn();
  const schools = await prisma.school.findMany({
    select: { id: true, name: true },
    orderBy: { createdAt: "asc" },
  });
  for (const school of schools) {
    const current = await schoolSlugForId(school.id);
    if (!current) {
      await assignUniqueSlug(school.id, school.name);
    }
  }
}
