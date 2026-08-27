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
}
