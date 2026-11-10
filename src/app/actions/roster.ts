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

/** Remove mistaken van links before loading real van Excel files. */
export async function clearGhostVanAssignments() {
  const user = await getSession();
  if (!user || (user.role !== "ADMINISTRATOR" && user.role !== "COORDINATOR")) {
    return { ok: false as const, error: "Only an admin can clear van mistakes." };
  }
  await ensureStudentContactColumns().catch(() => undefined);

  const schoolStudents = await prisma.student.findMany({
    where: { schoolId: user.schoolId },
    select: { id: true },
  });
  const ids = schoolStudents.map((row) => row.id);
  if (!ids.length) {
    return { ok: true as const, cleared: 0, removedVehicles: 0 };
  }

  const vanAssignments = await prisma.transportationAssignment.findMany({
    where: {
      studentId: { in: ids },
      OR: [
        { notes: { contains: "Van", mode: "insensitive" } },
        { notes: { contains: "van" } },
      ],
    },
    select: { id: true, studentId: true, busRouteId: true },
  });

  let cleared = 0;
  for (const row of vanAssignments) {
    if (row.busRouteId) {
      await prisma.transportationAssignment.update({
        where: { id: row.id },
        data: { notes: "" },
      });
    } else {
      await prisma.transportationAssignment.delete({ where: { id: row.id } });
    }
    cleared += 1;
  }

  await prisma.$executeRaw`
    UPDATE "Student"
    SET "vehicleId" = NULL, "updatedAt" = CURRENT_TIMESTAMP
    WHERE "schoolId" = ${user.schoolId} AND "vehicleId" IS NOT NULL
  `;

  const removed = await prisma.$executeRaw`
    DELETE FROM "TransportVehicle"
    WHERE "schoolId" = ${user.schoolId}
      AND (upper("vehicleType") = 'VAN' OR lower("name") LIKE 'van%')
  `;

  refreshRoster();
  return {
    ok: true as const,
    cleared,
    removedVehicles: typeof removed === "number" ? removed : 0,
  };
}

export async function deleteArchivedStudents() {
  const user = await getSession();
  if (!user || (user.role !== "ADMINISTRATOR" && user.role !== "COORDINATOR")) {
    return { ok: false as const, error: "Only an admin can delete the archive." };
  }
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
