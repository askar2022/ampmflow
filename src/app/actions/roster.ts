"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ensureStudentContactColumns } from "@/lib/transportation";

function refreshRoster() {
  revalidatePath("/buses");
  revalidatePath("/dashboard");
  revalidatePath("/print");
  revalidatePath("/changes");
}

export async function archiveSchoolRoster() {
  const user = await getSession();
  if (!user || (user.role !== "ADMINISTRATOR" && user.role !== "COORDINATOR")) {
    return { ok: false as const, error: "Only an admin can archive the roster." };
  }
  await ensureStudentContactColumns().catch(() => undefined);

  const result = await prisma.student.updateMany({
    where: { schoolId: user.schoolId, active: true },
    data: { active: false },
  });

  refreshRoster();
  return { ok: true as const, archived: result.count };
}

export async function restoreStudent(id: string) {
  const user = await getSession();
  if (!user || (user.role !== "ADMINISTRATOR" && user.role !== "COORDINATOR")) {
    return { ok: false as const, error: "Only an admin can put a student back." };
  }
  await ensureStudentContactColumns().catch(() => undefined);

  const student = await prisma.student.findFirst({
    where: { id, schoolId: user.schoolId },
    select: { id: true },
  });
  if (!student) return { ok: false as const, error: "Student not found." };

  await prisma.student.update({
    where: { id: student.id },
    data: { active: true },
  });

  refreshRoster();
  return { ok: true as const };
}

export async function restoreSchoolRoster() {
  const user = await getSession();
  if (!user || (user.role !== "ADMINISTRATOR" && user.role !== "COORDINATOR")) {
    return { ok: false as const, error: "Only an admin can put students back." };
  }
  await ensureStudentContactColumns().catch(() => undefined);

  const result = await prisma.student.updateMany({
    where: { schoolId: user.schoolId, active: false },
    data: { active: true },
  });

  refreshRoster();
  return { ok: true as const, restored: result.count };
}
