"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { canManageUsers, getSession, hashPassword } from "@/lib/auth";
import { writeAudit } from "@/lib/audit";
import type { Role } from "@/lib/types";

export async function createUser(formData: FormData): Promise<void> {
  const session = await getSession();
  if (!session || !canManageUsers(session.role)) {
    return;
  }

  const name = String(formData.get("name") || "").trim();
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const role = String(formData.get("role") || "") as Role;
  const password = String(formData.get("password") || "");
  const teacherId = String(formData.get("teacherId") || "") || null;

  if (!name || !email || !role || !password) {
    return;
  }

  await prisma.user.create({
    data: {
      schoolId: session.schoolId,
      name,
      email,
      role,
      teacherId: role === "TEACHER" ? teacherId : null,
      passwordHash: await hashPassword(password),
    },
  });

  await writeAudit({
    user: session,
    action: "CREATE_USER",
    newPlan: { name, email, role },
  });

  revalidatePath("/admin/users");
}

export async function toggleUser(id: string) {
  const session = await getSession();
  if (!session || !canManageUsers(session.role)) {
    return { ok: false, error: "Only administrators can manage users." };
  }
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) return { ok: false, error: "User not found." };
  await prisma.user.update({
    where: { id },
    data: { active: !user.active },
  });
  revalidatePath("/admin/users");
  return { ok: true };
}
