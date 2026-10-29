"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function clearSchoolRoster() {
  const user = await getSession();
  if (!user || (user.role !== "ADMINISTRATOR" && user.role !== "COORDINATOR")) {
    return { ok: false as const, error: "Only an admin can remove the roster." };
  }

  const students = await prisma.student.findMany({
    where: { schoolId: user.schoolId },
    select: { id: true },
  });
  const ids = students.map((row) => row.id);
  if (!ids.length) {
    return { ok: true as const, removed: 0 };
  }

  const events = await prisma.changeEvent.findMany({
    where: { studentId: { in: ids } },
    select: { id: true },
  });
  const eventIds = events.map((row) => row.id);

  if (eventIds.length) {
    await prisma.teacherAcknowledgment.deleteMany({
      where: { changeEventId: { in: eventIds } },
    });
  }
  await prisma.gateStatusHistory
    .deleteMany({ where: { studentId: { in: ids } } })
    .catch(() => undefined);
  await prisma.gateDayStatus
    .deleteMany({ where: { studentId: { in: ids } } })
    .catch(() => undefined);
  await prisma.busCheckIn.deleteMany({ where: { studentId: { in: ids } } });
  await prisma.changeEvent.deleteMany({ where: { studentId: { in: ids } } });
  await prisma.temporaryChange.deleteMany({ where: { studentId: { in: ids } } });
  await prisma.changeRequest.deleteMany({ where: { studentId: { in: ids } } });
  await prisma.transportationAssignment.deleteMany({
    where: { studentId: { in: ids } },
  });
  await prisma.auditLog.deleteMany({ where: { studentId: { in: ids } } });
  await prisma.student.deleteMany({
    where: { schoolId: user.schoolId, id: { in: ids } },
  });

  const emptyClassrooms = await prisma.classroom.findMany({
    where: { schoolId: user.schoolId, students: { none: {} } },
    select: { id: true },
  });
  const classroomIds = emptyClassrooms.map((row) => row.id);
  if (classroomIds.length) {
    await prisma.teacher.deleteMany({
      where: { classroomId: { in: classroomIds } },
    });
    await prisma.classroom.deleteMany({ where: { id: { in: classroomIds } } });
  }
  await prisma.busRoute.deleteMany({
    where: {
      schoolId: user.schoolId,
      assignments: { none: {} },
      tempChanges: { none: {} },
    },
  });
  await prisma.transportVehicle.deleteMany({
    where: { schoolId: user.schoolId, students: { none: {} } },
  });
  await prisma.family.deleteMany({
    where: { schoolId: user.schoolId, students: { none: {} } },
  });

  revalidatePath("/buses");
  revalidatePath("/dashboard");
  revalidatePath("/print");
  revalidatePath("/changes");

  return { ok: true as const, removed: ids.length };
}
