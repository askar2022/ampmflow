"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { writeAudit } from "@/lib/audit";
import { todayKey } from "@/lib/dates";
import { loadStudent, resolveTrip, addressHasNoRoute } from "@/lib/transportation";
import type { Destination, DurationType, TransportType, Trip } from "@/lib/types";

export type UpdateInput = {
  studentId: string;
  trips: Trip[];
  type: TransportType;
  destination: Destination;
  duration: DurationType;
  startDate?: string;
  endDate?: string;
  busRouteId?: string;
  waitingForAssignment?: boolean;
  customAddress?: string;
  reason?: string;
  confirmPermanent?: boolean;
};

export type UpdateResult =
  | { ok: true }
  | {
      ok: false;
      error: string;
      warnings?: string[];
    };

async function requireCoordinator() {
  const user = await getSession();
  if (!user) return { error: "Please sign in." as const, user: null };
  if (user.role !== "COORDINATOR") {
    return {
      error: "Only the transportation coordinator can change assignments." as const,
      user: null,
    };
  }
  return { error: null, user };
}

export async function updateTransportation(
  input: UpdateInput,
): Promise<UpdateResult> {
  const { user, error } = await requireCoordinator();
  if (!user || error) return { ok: false, error: error || "Unauthorized" };

  const loaded = await loadStudent(input.studentId);
  if (!loaded) return { ok: false, error: "Student not found." };

  if (input.duration === "PERMANENT" && !input.confirmPermanent) {
    return {
      ok: false,
      error: "Confirm this permanent change before saving.",
    };
  }

  const warnings: string[] = [];
  const busNumber = input.busRouteId
    ? (
        await prisma.busRoute.findUnique({ where: { id: input.busRouteId } })
      )?.number
    : null;

  if (
    addressHasNoRoute({
      type: input.type,
      destination: input.destination,
      busNumber,
      waitingForAssignment: input.waitingForAssignment,
    })
  ) {
    warnings.push(
      "This address does not have an assigned bus route yet. The student will appear on the missing-assignment list until the bus company assigns a number.",
    );
  }

  const day = todayKey();
  let daycareId = loaded.record.daycareId;
  let customAddressId: string | undefined;

  if (input.destination === "DAYCARE" && !daycareId) {
    return {
      ok: false,
      error: "This student does not have a daycare on file. Add a daycare first or choose another destination.",
    };
  }

  if (input.destination === "CUSTOM" && input.customAddress?.trim()) {
    const created = await prisma.address.create({
      data: {
        schoolId: user.schoolId,
        line1: input.customAddress.trim(),
        city: "—",
        state: "—",
        zip: "—",
        label: "custom",
      },
    });
    customAddressId = created.id;
  }

  const startDate =
    input.duration === "TODAY"
      ? day
      : input.duration === "DATE_RANGE"
        ? input.startDate || day
        : day;
  const endDate =
    input.duration === "TODAY"
      ? day
      : input.duration === "DATE_RANGE"
        ? input.endDate || startDate
        : day;

  for (const trip of input.trips) {
    const oldPlan = resolveTrip(loaded.record, trip, day);

    if (input.duration === "PERMANENT") {
      await prisma.transportationAssignment.upsert({
        where: {
          studentId_trip: { studentId: input.studentId, trip },
        },
        create: {
          studentId: input.studentId,
          trip,
          type: input.type,
          destination: input.destination,
          busRouteId: input.type === "BUS" ? input.busRouteId || null : null,
          daycareId: input.destination === "DAYCARE" ? daycareId : null,
          customAddressId: customAddressId ?? null,
          waitingForAssignment: Boolean(
            input.type === "BUS" && input.waitingForAssignment,
          ),
          notes: input.reason || "",
          effectiveStart: new Date(`${startDate}T12:00:00`),
          updatedById: user.id,
        },
        update: {
          type: input.type,
          destination: input.destination,
          busRouteId: input.type === "BUS" ? input.busRouteId || null : null,
          daycareId: input.destination === "DAYCARE" ? daycareId : null,
          customAddressId: customAddressId ?? null,
          waitingForAssignment: Boolean(
            input.type === "BUS" && input.waitingForAssignment,
          ),
          notes: input.reason || "",
          updatedById: user.id,
        },
      });
    } else {
      await prisma.temporaryChange.create({
        data: {
          studentId: input.studentId,
          trip,
          type: input.type,
          destination: input.destination,
          busRouteId: input.type === "BUS" ? input.busRouteId || null : null,
          daycareId: input.destination === "DAYCARE" ? daycareId : null,
          customAddressId: customAddressId ?? null,
          waitingForAssignment: Boolean(
            input.type === "BUS" && input.waitingForAssignment,
          ),
          durationType: input.duration,
          startDate,
          endDate,
          reason: input.reason || "",
          status: "APPROVED",
          createdById: user.id,
          approvedById: user.id,
          approvedAt: new Date(),
        },
      });
    }

    const refreshed = await loadStudent(input.studentId, day);
    await writeAudit({
      user,
      studentId: input.studentId,
      action:
        input.duration === "PERMANENT"
          ? "UPDATE_PERMANENT"
          : "CREATE_TEMPORARY",
      trip,
      durationType: input.duration,
      oldPlan,
      newPlan: refreshed ? resolveTrip(refreshed.record, trip, day) : null,
      approvedById: user.id,
    });
  }

  revalidatePath("/dashboard");
  revalidatePath("/changes");
  revalidatePath("/students");
  revalidatePath(`/students/${input.studentId}`);
  revalidatePath("/teacher");
  revalidatePath("/buses");
  revalidatePath("/pickup");
  return { ok: true, ...(warnings.length ? { warnings } : {}) } as UpdateResult;
}

export async function undoLastChange(studentId: string): Promise<UpdateResult> {
  const { user, error } = await requireCoordinator();
  if (!user || error) return { ok: false, error: error || "Unauthorized" };

  const last = await prisma.auditLog.findFirst({
    where: { studentId, action: { in: ["UPDATE_PERMANENT", "CREATE_TEMPORARY"] } },
    orderBy: { createdAt: "desc" },
  });
  if (!last || !last.trip) {
    return { ok: false, error: "There is no transportation change to undo." };
  }

  const oldPlan = JSON.parse(last.oldPlan || "{}") as {
    source?: string;
    type?: string;
    destination?: string;
    busNumber?: string | null;
    notes?: string;
    waitingForAssignment?: boolean;
  };

  if (last.action === "CREATE_TEMPORARY") {
    const temp = await prisma.temporaryChange.findFirst({
      where: {
        studentId,
        trip: last.trip,
        undone: false,
        status: "APPROVED",
      },
      orderBy: { createdAt: "desc" },
    });
    if (temp) {
      await prisma.temporaryChange.update({
        where: { id: temp.id },
        data: { undone: true },
      });
    }
  } else if (oldPlan.type) {
    const bus = oldPlan.busNumber
      ? await prisma.busRoute.findFirst({
          where: {
            schoolId: user.schoolId,
            number: oldPlan.busNumber,
            trip: last.trip,
          },
        })
      : null;
    await prisma.transportationAssignment.upsert({
      where: { studentId_trip: { studentId, trip: last.trip } },
      create: {
        studentId,
        trip: last.trip,
        type: oldPlan.type,
        destination: oldPlan.destination || "HOME",
        busRouteId: bus?.id,
        waitingForAssignment: Boolean(oldPlan.waitingForAssignment),
        notes: oldPlan.notes || "",
        updatedById: user.id,
      },
      update: {
        type: oldPlan.type,
        destination: oldPlan.destination || "HOME",
        busRouteId: bus?.id ?? null,
        waitingForAssignment: Boolean(oldPlan.waitingForAssignment),
        notes: oldPlan.notes || "",
        updatedById: user.id,
      },
    });
  }

  const refreshed = await loadStudent(studentId);
  await writeAudit({
    user,
    studentId,
    action: "UNDO",
    trip: last.trip,
    durationType: last.durationType,
    oldPlan: refreshed
      ? resolveTrip(refreshed.record, last.trip as Trip)
      : null,
    newPlan: oldPlan,
    approvedById: user.id,
  });

  revalidatePath("/dashboard");
  revalidatePath("/changes");
  revalidatePath(`/students/${studentId}`);
  return { ok: true };
}
