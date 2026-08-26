"use server";

import { redirect } from "next/navigation";
import { prisma, isDatabaseConfigured } from "@/lib/prisma";
import { createSession, hashPassword } from "@/lib/auth";

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

  let already = null;
  let school = null;
  try {
    already = await prisma.user.findUnique({ where: { email } });
    school = await prisma.school.findFirst({
      orderBy: { createdAt: "asc" },
    });
  } catch {
    redirect("/login/create?error=db");
  }

  if (already) {
    redirect("/login/create?error=exists");
  }
  if (!school && !schoolName) {
    redirect("/login/create?error=setup");
  }

  try {
    if (!school) {
      school = await prisma.school.create({
        data: { name: schoolName, timezone: "America/Chicago" },
      });
      await prisma.schoolSettings
        .create({ data: { schoolId: school.id } })
        .catch(() => undefined);
    }

    const user = await prisma.user.create({
      data: {
        schoolId: school.id,
        name,
        email,
        role: "COORDINATOR",
        passwordHash: await hashPassword(password),
      },
    });

    await createSession({
      id: user.id,
      schoolId: user.schoolId,
      email: user.email,
      name: user.name,
      role: "COORDINATOR",
      teacherId: null,
      assignedBus: null,
    });
  } catch {
    redirect("/login/create?error=db");
  }

  redirect("/admin/users");
}

export async function createFirstAccount(formData: FormData) {
  await createAccount(formData);
}
