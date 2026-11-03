import { randomUUID } from "crypto";
import bcrypt from "bcryptjs";
import { prisma } from "./prisma";

export const PLATFORM_ADMIN_EMAIL = "askar@automationllc.org";

export function isPlatformAdminEmail(email: string) {
  return email.trim().toLowerCase() === PLATFORM_ADMIN_EMAIL;
}

export async function ensurePlatformAdminUser() {
  const existing = await prisma.user.findUnique({
    where: { email: PLATFORM_ADMIN_EMAIL },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      active: true,
      schoolId: true,
    },
  });
  if (existing) {
    if (existing.active && existing.role === "ADMINISTRATOR") return existing;
    return prisma.user.update({
      where: { id: existing.id },
      data: { active: true, role: "ADMINISTRATOR" },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        active: true,
        schoolId: true,
      },
    });
  }

  const first = await prisma.school.findFirst({
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  if (!first) return null;

  return prisma.user.create({
    data: {
      schoolId: first.id,
      email: PLATFORM_ADMIN_EMAIL,
      name: "AMPM Flow administrator",
      role: "ADMINISTRATOR",
      passwordHash: await bcrypt.hash(randomUUID(), 10),
      active: true,
    },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      active: true,
      schoolId: true,
    },
  });
}
