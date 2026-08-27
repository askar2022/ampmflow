"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { todayKey } from "@/lib/dates";
import { notifyCoordinators, writeAudit } from "@/lib/audit";

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
  status: "ON_BUS" | "MISSING" | "WRONG" | "UNASSIGNED" | "LEFT_SCHOOL",
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
  const data = {
    schoolId: user.schoolId,
    studentId,
    trip: "PM",
    date: day,
    status,
    note,
    checkedById: user.id,
  };
  try {
    try {
      await prisma.busCheckIn.upsert({
        where: {
          studentId_trip_date: { studentId, trip: "PM", date: day },
        },
        create: data,
        update: { status, note, checkedById: user.id },
      });
    } catch {
      const existing = await prisma.busCheckIn.findFirst({
        where: { studentId, trip: "PM", date: day },
      });
      if (existing) {
        await prisma.busCheckIn.update({
          where: { id: existing.id },
          data: { status, note, checkedById: user.id },
        });
      } else {
        await prisma.busCheckIn.create({ data });
      }
    }
    try {
      await writeAudit({
        user,
        studentId,
        action: "BUS_CHECK_IN",
        trip: "PM",
        newPlan: { status, note },
      });
    } catch {
      // Keep the mark even if the activity log cannot write.
    }
    revalidatePath("/checkin");
    revalidatePath("/dashboard");
    revalidatePath("/leadership");
    revalidatePath("/print");
    return { ok: true };
  } catch {
    return {
      ok: false,
      error: "Could not save this mark. Try again.",
    };
  }
}

export async function reportLeftSchool(studentId: string) {
  const user = await getSession();
  if (
    !user ||
    (user.role !== "COORDINATOR" &&
      user.role !== "ADMINISTRATOR" &&
      user.role !== "BUS_ASSISTANT")
  ) {
    return { ok: false, error: "Not authorized." };
  }

  const loaded = await prisma.student.findFirst({
    where: { id: studentId, schoolId: user.schoolId },
  });
  if (!loaded) return { ok: false, error: "Student not found." };

  try {
    const title = `${loaded.firstName} ${loaded.lastName}: no longer at this school — remove from bus roster`;
    const recent = await prisma.changeRequest.findFirst({
      where: {
        schoolId: user.schoolId,
        studentId,
        title,
        status: "PENDING",
        createdAt: { gte: new Date(Date.now() - 15 * 60 * 1000) },
      },
    });
    if (!recent) {
      await prisma.changeRequest.create({
        data: {
          schoolId: user.schoolId,
          studentId,
          trip: "PM",
          source: "COORDINATOR",
          title,
          details:
            "Student transferred or left. Ask the bus company to stop coming to this house and remove them from the roster.",
          payload: JSON.stringify({
            kind: "COMPANY_REPORT",
            companyNeed: "LEFT_SCHOOL",
            trip: "PM",
          }),
          status: "PENDING",
          createdById: user.id,
        },
      });
      await notifyCoordinators(
        user.schoolId,
        "Report to bus company — left school",
        `${user.name}: ${title}`,
      );
    }

    const marked = await setBusCheckIn(
      studentId,
      "LEFT_SCHOOL",
      "No longer at this school",
    );
    revalidatePath("/requests");
    revalidatePath("/company");
    return marked;
  } catch {
    return { ok: false, error: "Could not save. Try again." };
  }
}
