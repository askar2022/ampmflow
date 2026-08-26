"use server";

import { randomUUID } from "crypto";
import { redirect } from "next/navigation";
import { prisma, isDatabaseConfigured } from "@/lib/prisma";
import { createSession, hashPassword } from "@/lib/auth";

const FIRST_ADMIN_ROLE = "ADMINISTRATOR" as const;

async function ensureOptionalColumns() {
  await prisma.$executeRawUnsafe(
    `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "assignedBus" TEXT`,
  ).catch(() => undefined);
  await prisma.$executeRawUnsafe(
    `ALTER TABLE "School" ADD COLUMN IF NOT EXISTS "logoUrl" TEXT`,
  ).catch(() => undefined);
}

export async function createAccount(formData: FormData) {
  if (!isDatabaseConfigured()) {
    redirect("/login/create?error=db");
  }

  const schoolName = String(formData.get("schoolName") || "").trim();
  const name = String(formData.get("name") || "").trim();
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const password = String(formData.get("password") || "");

  if (!name || !email || !password || password.length < 8) {
    redirect("/login/create?error=setup");
  }

  await ensureOptionalColumns();

  let already: { id: string } | null = null;
  let school: { id: string; name: string } | null = null;
  let existingUsers = 0;
  try {
    existingUsers = await prisma.user.count();
    already = await prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });
    school = await prisma.school.findFirst({
      orderBy: { createdAt: "asc" },
      select: { id: true, name: true },
    });
  } catch {
    redirect("/login/create?error=db");
  }

  if (existingUsers > 0) {
    redirect("/login");
  }
  if (already) {
    redirect("/login/create?error=exists");
  }
  if (!school && !schoolName) {
    redirect("/login/create?error=setup");
  }

  const passwordHash = await hashPassword(password);

  try {
    const stillEmpty = await prisma.user.count();
    if (stillEmpty > 0) {
      redirect("/login");
    }

    if (!school) {
      school = await prisma.school.create({
        data: { name: schoolName, timezone: "America/Chicago" },
        select: { id: true, name: true },
      });
      await prisma.schoolSettings
        .create({
          data: { id: randomUUID(), schoolId: school.id },
        })
        .catch(() => undefined);
    }

    const user = await prisma.user.create({
      data: {
        schoolId: school.id,
        name,
        email,
        role: FIRST_ADMIN_ROLE,
        passwordHash,
      },
      select: {
        id: true,
        schoolId: true,
        email: true,
        name: true,
        role: true,
      },
    });

    await createSession({
      id: user.id,
      schoolId: user.schoolId,
      email: user.email,
      name: user.name,
      role: FIRST_ADMIN_ROLE,
      teacherId: null,
      assignedBus: null,
    });
  } catch (error) {
    const digest =
      typeof error === "object" && error && "digest" in error
        ? String((error as { digest?: string }).digest)
        : "";
    if (digest.startsWith("NEXT_REDIRECT")) {
      throw error;
    }

    const code =
      typeof error === "object" && error && "code" in error
        ? String((error as { code?: string }).code)
        : "";
    if (code === "P2002") {
      redirect("/login/create?error=exists");
    }

    if (!school) {
      redirect("/login/create?error=db");
    }

    try {
      const stillEmpty = await prisma.user.count();
      if (stillEmpty > 0) {
        redirect("/login");
      }
      const userId = randomUUID().replace(/-/g, "").slice(0, 24);
      await prisma.$executeRaw`
        INSERT INTO "User" ("id", "schoolId", "email", "name", "passwordHash", "role", "active", "createdAt", "updatedAt")
        VALUES (${userId}, ${school.id}, ${email}, ${name}, ${passwordHash}, ${FIRST_ADMIN_ROLE}, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `;
      await createSession({
        id: userId,
        schoolId: school.id,
        email,
        name,
        role: FIRST_ADMIN_ROLE,
        teacherId: null,
        assignedBus: null,
      });
    } catch (fallbackError) {
      const fallbackDigest =
        typeof fallbackError === "object" &&
        fallbackError &&
        "digest" in fallbackError
          ? String((fallbackError as { digest?: string }).digest)
          : "";
      if (fallbackDigest.startsWith("NEXT_REDIRECT")) {
        throw fallbackError;
      }
      redirect("/login/create?error=db");
    }
  }

  redirect("/admin/users");
}

export async function createFirstAccount(formData: FormData) {
  await createAccount(formData);
}
