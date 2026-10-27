"use server";

import { randomUUID } from "crypto";
import { redirect } from "next/navigation";
import { prisma, isDatabaseConfigured } from "@/lib/prisma";
import { createSession, hashPassword } from "@/lib/auth";
import { PENDING_ROLE } from "@/lib/types";

const FIRST_ADMIN_ROLE = "ADMINISTRATOR" as const;

function isNextRedirect(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "digest" in error &&
    String((error as { digest?: string }).digest).startsWith("NEXT_REDIRECT")
  );
}

async function ensureOptionalColumns() {
  await prisma.$executeRawUnsafe(
    `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "assignedBus" TEXT`,
  ).catch(() => undefined);
  await prisma.$executeRawUnsafe(
    `ALTER TABLE "School" ADD COLUMN IF NOT EXISTS "logoUrl" TEXT`,
  ).catch(() => undefined);
}

export async function createAccount(formData: FormData) {
  const schoolName = String(formData.get("schoolName") || "").trim();
  const name = String(formData.get("name") || "").trim();
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const password = String(formData.get("password") || "");
  const intent = String(formData.get("intent") || "join");
  const failPath = intent === "new-school" ? "/schools" : "/login";

  if (!isDatabaseConfigured()) {
    redirect(`${failPath}?error=db`);
  }

  if (!name || !email || !password || password.length < 8) {
    redirect(`${failPath}?error=setup`);
  }

  await ensureOptionalColumns();

  let already: { id: string; role: string } | null = null;
  let school: { id: string; name: string } | null = null;
  let existingUsers = 0;
  try {
    existingUsers = await prisma.user.count();
    already = await prisma.user.findUnique({
      where: { email },
      select: { id: true, role: true },
    });
    school = await prisma.school.findFirst({
      orderBy: { createdAt: "asc" },
      select: { id: true, name: true },
    });
  } catch {
    redirect(`${failPath}?error=db`);
  }

  if (already) {
    redirect(
      already.role === PENDING_ROLE
        ? `${failPath}?error=pending`
        : `${failPath}?error=exists`,
    );
  }

  const passwordHash = await hashPassword(password);

  if (existingUsers === 0) {
    if (!schoolName) {
      redirect("/login?error=setup");
    }
    await createFirstAdministrator({
      school,
      schoolName,
      name,
      email,
      passwordHash,
    });
    redirect("/admin/users");
  }

  redirect("/contact");
}

async function createFirstAdministrator({
  school,
  schoolName,
  name,
  email,
  passwordHash,
}: {
  school: { id: string; name: string } | null;
  schoolName: string;
  name: string;
  email: string;
  passwordHash: string;
}) {
  if (!school && !schoolName) {
    redirect("/login?error=setup");
  }

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
        active: true,
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
    if (isNextRedirect(error)) {
      throw error;
    }

    const code =
      typeof error === "object" && error && "code" in error
        ? String((error as { code?: string }).code)
        : "";
    if (code === "P2002") {
      redirect("/login?error=exists");
    }

    if (!school) {
      redirect("/login?error=db");
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
      if (isNextRedirect(fallbackError)) {
        throw fallbackError;
      }
      redirect("/login?error=db");
    }
  }
}

export async function createFirstAccount(formData: FormData) {
  await createAccount(formData);
}
