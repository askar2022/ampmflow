"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { canManageUsers, getSession, hashPassword } from "@/lib/auth";
import { writeAudit } from "@/lib/audit";
import { PENDING_ROLE, ROLES, type Role } from "@/lib/types";

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
  const assignedBus = String(formData.get("assignedBus") || "").trim() || null;

  if (!name || !email || !role || !password) {
    return;
  }

  try {
    await prisma.user.create({
      data: {
        schoolId: session.schoolId,
        name,
        email,
        role,
        teacherId: role === "TEACHER" ? teacherId : null,
        assignedBus: role === "BUS_ASSISTANT" ? assignedBus : null,
        passwordHash: await hashPassword(password),
        active: true,
      },
    });
  } catch {
    return;
  }

  await writeAudit({
    user: session,
    action: "CREATE_USER",
    newPlan: { name, email, role },
  });

  revalidatePath("/admin/users");
}

export async function resetUserPassword(formData: FormData): Promise<void> {
  const session = await getSession();
  if (!session || !canManageUsers(session.role)) {
    return;
  }

  const id = String(formData.get("id") || "");
  const password = String(formData.get("password") || "");
  if (!id || password.length < 4) {
    return;
  }

  const user = await prisma.user.findFirst({
    where: { id, schoolId: session.schoolId },
  });
  if (!user || user.role === PENDING_ROLE) {
    return;
  }

  await prisma.user.update({
    where: { id },
    data: { passwordHash: await hashPassword(password), active: true },
  });

  await writeAudit({
    user: session,
    action: "RESET_USER_PASSWORD",
    newPlan: { name: user.name, email: user.email },
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
  if (user.role === PENDING_ROLE) {
    return { ok: false, error: "Approve or reject this request first." };
  }
  await prisma.user.update({
    where: { id },
    data: { active: !user.active },
  });
  revalidatePath("/admin/users");
  return { ok: true };
}

export async function approveUser(formData: FormData) {
  const session = await getSession();
  if (!session || !canManageUsers(session.role)) {
    return;
  }

  const id = String(formData.get("id") || "");
  const role = String(formData.get("role") || "") as Role;
  const teacherId = String(formData.get("teacherId") || "") || null;
  const assignedBus = String(formData.get("assignedBus") || "").trim() || null;

  if (!id || !ROLES.includes(role)) {
    return;
  }

  const user = await prisma.user.findFirst({
    where: { id, schoolId: session.schoolId, role: PENDING_ROLE },
  });
  if (!user) {
    return;
  }

  await prisma.user.update({
    where: { id },
    data: {
      role,
      active: true,
      teacherId: role === "TEACHER" ? teacherId : null,
      assignedBus: role === "BUS_ASSISTANT" ? assignedBus : null,
    },
  });

  await writeAudit({
    user: session,
    action: "APPROVE_USER",
    newPlan: { name: user.name, email: user.email, role },
  });

  revalidatePath("/admin/users");
}

export async function rejectUser(formData: FormData) {
  const session = await getSession();
  if (!session || !canManageUsers(session.role)) {
    return;
  }

  const id = String(formData.get("id") || "");
  if (!id) {
    return;
  }

  const user = await prisma.user.findFirst({
    where: { id, schoolId: session.schoolId, role: PENDING_ROLE },
  });
  if (!user) {
    return;
  }

  await prisma.user.delete({ where: { id } });

  await writeAudit({
    user: session,
    action: "REJECT_USER",
    newPlan: { name: user.name, email: user.email },
  });

  revalidatePath("/admin/users");
}
