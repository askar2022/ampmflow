"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { todayKey } from "@/lib/dates";
import { writeAudit } from "@/lib/audit";

export async function acknowledgeChange(changeEventId: string) {
  const user = await getSession();
  if (!user || user.role !== "TEACHER") {
    return { ok: false, error: "Only a teacher can acknowledge a change." };
  }
  await prisma.teacherAcknowledgment.upsert({
    where: {
      changeEventId_userId: { changeEventId, userId: user.id },
    },
    create: {
      changeEventId,
      userId: user.id,
      acknowledgedAt: new Date(),
    },
    update: { acknowledgedAt: new Date() },
  });
  await writeAudit({
    user,
    action: "ACKNOWLEDGE_CHANGE",
    newPlan: { changeEventId },
  });
  revalidatePath("/teacher");
  revalidatePath("/acknowledgments");
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function acknowledgeAllMine() {
  const user = await getSession();
  if (!user || user.role !== "TEACHER") return { ok: false };
  await prisma.teacherAcknowledgment.updateMany({
    where: { userId: user.id, acknowledgedAt: null },
    data: { acknowledgedAt: new Date() },
  });
  revalidatePath("/teacher");
  revalidatePath("/acknowledgments");
  return { ok: true };
}

export async function reportTeacherConcern(formData: FormData): Promise<void> {
  const details = String(formData.get("details") || "");
  formData.set("title", `Teacher concern: ${details.slice(0, 80)}`);
  formData.set("trip", "PM");
  const { createChangeRequest } = await import("./requests");
  await createChangeRequest(formData);
}

export async function setBusCheckIn(
  studentId: string,
  status: "ON_BUS" | "MISSING" | "WRONG" | "UNASSIGNED",
  note = "",
) {
  const user = await getSession();
  if (
    !user ||
    (user.role !== "BUS_ASSISTANT" &&
      user.role !== "COORDINATOR" &&
      user.role !== "ADMINISTRATOR")
  ) {
    return { ok: false, error: "Not authorized to check students in." };
  }
  const day = todayKey();
  await prisma.busCheckIn.upsert({
    where: {
      studentId_trip_date: { studentId, trip: "PM", date: day },
    },
    create: {
      schoolId: user.schoolId,
      studentId,
      trip: "PM",
      date: day,
      status,
      note,
      checkedById: user.id,
    },
    update: { status, note, checkedById: user.id },
  });
  revalidatePath("/checkin");
  revalidatePath("/dashboard");
  return { ok: true };
}
