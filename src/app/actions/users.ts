"use server";

import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { canManageUsers, getSession, hashPassword, isPlatformAdmin } from "@/lib/auth";
import { writeAudit } from "@/lib/audit";
import { markInquirySetup } from "@/lib/inquiries";
import { emailSchoolApproved } from "@/lib/school-request-email";
import { assignUniqueSlug, schoolLoginUrl } from "@/lib/school-slug";
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

export async function toggleUserAction(formData: FormData) {
  const id = String(formData.get("id") || "");
  if (id) await toggleUser(id);
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

  const platform = await isPlatformAdmin(session);
  const user = await prisma.user.findFirst({
    where: platform
      ? { id, role: PENDING_ROLE }
      : { id, schoolId: session.schoolId, role: PENDING_ROLE },
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

  const school = await prisma.school.findUnique({
    where: { id: user.schoolId },
    select: { name: true },
  });
  await emailSchoolApproved({
    schoolName: school?.name || "your school",
    name: user.name,
    email: user.email,
  }).catch(() => undefined);

  revalidatePath("/admin/users");
}

export async function createSchoolForDemo(formData: FormData) {
  const session = await getSession();
  if (!session || !canManageUsers(session.role)) return;
  if (!(await isPlatformAdmin(session))) return;

  const schoolName = String(formData.get("schoolName") || "").trim();
  const name = String(formData.get("name") || "").trim();
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const password = String(formData.get("password") || "");
  const requestedSlug = String(formData.get("slug") || "").trim();
  if (!schoolName || !name || !email || password.length < 8) return;

  const takenUser = await prisma.user.findUnique({
    where: { email },
    select: { id: true, role: true, schoolId: true },
  });
  const schools = await prisma.school.findMany({ select: { id: true, name: true } });
  const takenSchool = schools.find(
    (row) => row.name.toLowerCase().replace(/\s+/g, " ") === schoolName.toLowerCase().replace(/\s+/g, " "),
  );

  if (takenUser?.role === PENDING_ROLE) {
    await prisma.user.update({
      where: { id: takenUser.id },
      data: { role: "ADMINISTRATOR", active: true, passwordHash: await hashPassword(password) },
    });
    const school = await prisma.school.findUnique({
      where: { id: takenUser.schoolId },
      select: { name: true },
    });
    const slug = await assignUniqueSlug(
      takenUser.schoolId,
      school?.name || schoolName,
      requestedSlug,
    );
    await markInquirySetup(email, school?.name || schoolName);
    await emailSchoolApproved({
      schoolName: school?.name || schoolName,
      name,
      email,
      loginUrl: schoolLoginUrl(slug),
    }).catch(() => undefined);
    revalidatePath("/admin/users");
    return;
  }

  if (takenUser) return;

  const school =
    takenSchool ||
    (await prisma.school.create({
      data: { name: schoolName, timezone: "America/Chicago" },
      select: { id: true, name: true },
    }));
  await prisma.schoolSettings
    .create({ data: { id: randomUUID(), schoolId: school.id } })
    .catch(() => undefined);
  await prisma.user.create({
    data: {
      schoolId: school.id,
      name,
      email,
      role: "ADMINISTRATOR",
      passwordHash: await hashPassword(password),
      active: true,
    },
  });
  const slug = await assignUniqueSlug(school.id, school.name, requestedSlug);
  await markInquirySetup(email, school.name);
  await emailSchoolApproved({
    schoolName: school.name,
    name,
    email,
    loginUrl: schoolLoginUrl(slug),
  }).catch(() => undefined);
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

  const platform = await isPlatformAdmin(session);
  const user = await prisma.user.findFirst({
    where: platform
      ? { id, role: PENDING_ROLE }
      : { id, schoolId: session.schoolId, role: PENDING_ROLE },
  });
  if (!user) {
    return;
  }

  const schoolId = user.schoolId;
  await prisma.user.delete({ where: { id } });
  const leftover = await prisma.user.count({ where: { schoolId } });
  if (leftover === 0 && schoolId !== session.schoolId) {
    await prisma.school.delete({ where: { id: schoolId } }).catch(() => undefined);
  }

  await writeAudit({
    user: session,
    action: "REJECT_USER",
    newPlan: { name: user.name, email: user.email },
  });

  revalidatePath("/admin/users");
}
