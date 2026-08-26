"use server";

import { redirect } from "next/navigation";
import { prisma, isDatabaseConfigured } from "@/lib/prisma";
import { createSession, hashPassword } from "@/lib/auth";

export async function createFirstAccount(formData: FormData) {
  if (!isDatabaseConfigured()) {
    redirect("/login?error=db");
  }

  const existing = await prisma.user.count();
  if (existing > 0) {
    redirect("/login");
  }

  const schoolName = String(formData.get("schoolName") || "").trim();
  const name = String(formData.get("name") || "").trim();
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const password = String(formData.get("password") || "");

  if (!schoolName || !name || !email || !password) {
    redirect("/login?error=setup");
  }

  const school = await prisma.school.create({
    data: { name: schoolName, timezone: "America/Chicago" },
  });

  await prisma.schoolSettings.create({
    data: { schoolId: school.id },
  }).catch(() => undefined);

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

  redirect("/admin/users");
}
