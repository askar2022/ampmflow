"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { writeAudit } from "@/lib/audit";
import { usableTeacherEmail } from "@/lib/teacher-snapshot";

export async function updateTeacherEmail(formData: FormData) {
  const session = await getSession();
  if (
    !session ||
    (session.role !== "COORDINATOR" &&
      session.role !== "ADMINISTRATOR" &&
      session.role !== "FRONT_DESK")
  ) {
    return;
  }

  const teacherId = String(formData.get("teacherId") || "");
  const email = usableTeacherEmail(String(formData.get("email") || ""));
  if (!teacherId || !email) return;

  const teacher = await prisma.teacher.findFirst({
    where: { id: teacherId, schoolId: session.schoolId },
  });
  if (!teacher) return;

  await prisma.teacher.update({
    where: { id: teacher.id },
    data: { email },
  });
  await writeAudit({
    user: session,
    action: "UPDATE_TEACHER_EMAIL",
    newPlan: { teacherId: teacher.id, name: teacher.name, email },
  });
  revalidatePath("/teachers");
  revalidatePath("/print");
}

export async function updateTeacherClass(formData: FormData) {
  const session = await getSession();
  if (
    !session ||
    (session.role !== "COORDINATOR" &&
      session.role !== "ADMINISTRATOR" &&
      session.role !== "FRONT_DESK")
  ) {
    return;
  }

  const teacherId = String(formData.get("teacherId") || "");
  const name = String(formData.get("name") || "").trim();
  const classroomName = String(formData.get("classroomName") || "").trim();
  if (!teacherId || !name || !classroomName) return;

  const teacher = await prisma.teacher.findFirst({
    where: { id: teacherId, schoolId: session.schoolId },
    include: { classroom: true },
  });
  if (!teacher) return;

  await prisma.$transaction([
    prisma.teacher.update({
      where: { id: teacher.id },
      data: { name },
    }),
    prisma.classroom.update({
      where: { id: teacher.classroomId },
      data: { name: classroomName },
    }),
  ]);
  await writeAudit({
    user: session,
    action: "UPDATE_TEACHER_CLASS",
    newPlan: {
      teacherId: teacher.id,
      name,
      classroomName,
    },
  });
  revalidatePath("/teachers");
  revalidatePath("/print");
  revalidatePath("/students");
}
