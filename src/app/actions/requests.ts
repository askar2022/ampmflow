"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { notifyCoordinators, writeAudit } from "@/lib/audit";

export async function createChangeRequest(formData: FormData): Promise<void> {
  const user = await getSession();
  if (!user) return;

  const title = String(formData.get("title") || "").trim();
  const details = String(formData.get("details") || "").trim();
  const studentId = String(formData.get("studentId") || "") || null;
  const trip = String(formData.get("trip") || "") || null;
  const source =
    user.role === "FRONT_DESK"
      ? "FRONT_DESK"
      : user.role === "BUS_COMPANY"
        ? "BUS_COMPANY"
        : user.role === "TEACHER"
          ? "TEACHER"
          : "COORDINATOR";

  if (!title) return;

  const request = await prisma.changeRequest.create({
    data: {
      schoolId: user.schoolId,
      studentId,
      trip,
      source,
      title,
      details,
      status: user.role === "COORDINATOR" ? "APPROVED" : "PENDING",
      createdById: user.id,
      reviewedById: user.role === "COORDINATOR" ? user.id : null,
      reviewedAt: user.role === "COORDINATOR" ? new Date() : null,
    },
  });

  await writeAudit({
    user,
    studentId,
    action: "CREATE_REQUEST",
    trip,
    newPlan: { title, details, source, status: request.status },
  });

  await notifyCoordinators(
    user.schoolId,
    source === "TEACHER" ? "Teacher concern" : "New transportation request",
    `${user.name}: ${title}`,
  );

  revalidatePath("/requests");
  revalidatePath("/changes");
  revalidatePath("/company");
}

export async function reviewRequest(
  id: string,
  status: "APPROVED" | "REJECTED" | "COMPLETED",
  note?: string,
) {
  const user = await getSession();
  if (!user) return { ok: false, error: "Please sign in." };
  if (user.role !== "COORDINATOR" && user.role !== "ADMINISTRATOR") {
    if (!(user.role === "BUS_COMPANY" && status === "COMPLETED")) {
      return { ok: false, error: "You cannot review this request." };
    }
  }

  const existing = await prisma.changeRequest.findUnique({ where: { id } });
  if (!existing) return { ok: false, error: "Request not found." };

  const nextStatus =
    user.role === "BUS_COMPANY" ? "COMPLETED" : status;

  await prisma.changeRequest.update({
    where: { id },
    data: {
      status: nextStatus,
      companyNote: note ?? existing.companyNote,
      reviewedById: user.id,
      reviewedAt: new Date(),
    },
  });

  await writeAudit({
    user,
    studentId: existing.studentId,
    action: `REQUEST_${nextStatus}`,
    trip: existing.trip,
    oldPlan: { status: existing.status },
    newPlan: { status: nextStatus, note },
    approvedById: user.id,
  });

  revalidatePath("/requests");
  revalidatePath("/company");
  revalidatePath("/changes");
  return { ok: true };
}

export async function assignBusFromCompany(formData: FormData): Promise<void> {
  const user = await getSession();
  if (!user || user.role !== "BUS_COMPANY") {
    return;
  }

  const requestId = String(formData.get("requestId") || "");
  const busNumber = String(formData.get("busNumber") || "").trim();
  const note = String(formData.get("companyNote") || "").trim();
  if (!requestId || !busNumber) {
    return;
  }

  await prisma.changeRequest.update({
    where: { id: requestId },
    data: {
      busNumber,
      companyNote: note,
      status: "PENDING",
      details: `Proposed bus ${busNumber}. Awaiting coordinator approval.`,
    },
  });

  await notifyCoordinators(
    user.schoolId,
    "Bus company proposed an assignment",
    `${user.name} proposed Bus ${busNumber}. Review and approve before it becomes final.`,
  );

  revalidatePath("/company");
  revalidatePath("/requests");
}
