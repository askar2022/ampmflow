"use server";

import { revalidatePath } from "next/cache";
import { getSession, verifyPassword } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ensureStudentContactColumns } from "@/lib/transportation";

function refreshRoster() {
  revalidatePath("/buses");
  revalidatePath("/dashboard");
  revalidatePath("/print");
  revalidatePath("/changes");
}

async function confirmSignedInPassword(password: string) {
  const user = await getSession();
  if (!user || (user.role !== "ADMINISTRATOR" && user.role !== "COORDINATOR")) {
    return {
      ok: false as const,
      error: "Only an admin or coordinator can do this.",
    };
  }
  const entered = String(password || "");
  if (!entered.trim()) {
    return { ok: false as const, error: "Enter your sign-in password to continue." };
  }
  const row = await prisma.user.findUnique({
    where: { id: user.id },
    select: { passwordHash: true, schoolId: true, active: true },
  });
  if (!row?.active || row.schoolId !== user.schoolId) {
    return { ok: false as const, error: "Could not confirm your account." };
  }
  const ok = await verifyPassword(entered, row.passwordHash);
  if (!ok) {
    return { ok: false as const, error: "Incorrect password. Try again." };
  }
  return { ok: true as const, user };
}

export async function archiveSchoolRoster(password: string) {
  const access = await confirmSignedInPassword(password);
  if (!access.ok) return access;
  const user = access.user;
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

export async function deleteArchivedStudents(password: string) {
  const access = await confirmSignedInPassword(password);
  if (!access.ok) return access;
  const user = access.user;
  await ensureStudentContactColumns().catch(() => undefined);

  const archived = await prisma.student.findMany({
    where: { schoolId: user.schoolId, active: false },
    select: { id: true },
  });
  const ids = archived.map((row) => row.id);
  if (!ids.length) {
    return { ok: true as const, deleted: 0 };
  }

  const changeEvents = await prisma.changeEvent.findMany({
    where: { studentId: { in: ids } },
    select: { id: true },
  });
  const changeEventIds = changeEvents.map((row) => row.id);

  await prisma.$transaction(async (tx) => {
    if (changeEventIds.length) {
      await tx.teacherAcknowledgment.deleteMany({
        where: { changeEventId: { in: changeEventIds } },
      });
    }
    await tx.gateStatusHistory.deleteMany({ where: { studentId: { in: ids } } });
    await tx.gateDayStatus.deleteMany({ where: { studentId: { in: ids } } });
    await tx.busCheckIn.deleteMany({ where: { studentId: { in: ids } } });
    await tx.changeEvent.deleteMany({ where: { studentId: { in: ids } } });
    await tx.auditLog.deleteMany({ where: { studentId: { in: ids } } });
    await tx.changeRequest.deleteMany({ where: { studentId: { in: ids } } });
    await tx.temporaryChange.deleteMany({ where: { studentId: { in: ids } } });
    await tx.transportationAssignment.deleteMany({
      where: { studentId: { in: ids } },
    });
    await tx.student.deleteMany({
      where: { schoolId: user.schoolId, id: { in: ids }, active: false },
    });
  });

  refreshRoster();
  return { ok: true as const, deleted: ids.length };
}
