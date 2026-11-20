"use server";

import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { notifyCoordinators, writeAudit } from "@/lib/audit";
import { formatTime, todayKey } from "@/lib/dates";
import { geocodeAndSaveAddress } from "@/lib/geocode";
import { loadStudent, resolveTrip, addressHasNoRoute } from "@/lib/transportation";
import { canRecordChange, isAfterDeadline, isAfterSnapshot } from "@/lib/policy";
import { planSummary } from "@/lib/format";
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

async function requireRecorder(duration: DurationType) {
  const user = await getSession();
  if (!user) return { error: "Please sign in." as const, user: null };
  if (!canRecordChange(user.role, duration)) {
    return {
      error:
        user.role === "FRONT_DESK"
          ? "Reception can record today-only or date-range changes. A coordinator must complete a permanent bus-route change."
          : "You cannot change a transportation assignment.",
      user: null,
    };
  }
  return { error: null, user };
}

export async function updateTransportation(
  input: UpdateInput,
): Promise<UpdateResult> {
  const { user, error } = await requireRecorder(input.duration);
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

  const needsRoute =
    input.type === "BUS" &&
    (input.waitingForAssignment ||
      !input.busRouteId ||
      input.destination === "CUSTOM" ||
      (input.destination === "DAYCARE" && !input.busRouteId));
  if (needsRoute) {
    input.waitingForAssignment = true;
    warnings.push(
      "This is waiting for bus-company assignment. The child is not silently moved to a new route.",
    );
  }

  if (input.destination === "CUSTOM" && input.customAddress?.trim()) {
    const raw = input.customAddress.trim();
    const zip = raw.match(/\b(\d{5})(?:-\d{4})?\b/)?.[1] || "";
    const created = await prisma.address.create({
      data: {
        schoolId: user.schoolId,
        line1: raw,
        city: "Minneapolis",
        state: "MN",
        zip,
        label: "custom",
      },
    });
    customAddressId = created.id;
    // Do not block Submit on census/Nominatim geocode.
    after(() => geocodeAndSaveAddress(created.id).catch(() => undefined));
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

    const newPlan = {
      ...oldPlan,
      type: input.type,
      destination: input.destination,
      busNumber: busNumber || "",
      waitingForAssignment: Boolean(
        input.type === "BUS" && input.waitingForAssignment,
      ),
      customAddress:
        input.destination === "CUSTOM"
          ? input.customAddress?.trim() || oldPlan.customAddress
          : oldPlan.customAddress,
      daycareName:
        input.destination === "DAYCARE"
          ? loaded.effective.daycareName || oldPlan.daycareName
          : oldPlan.daycareName,
      source:
        input.duration === "PERMANENT"
          ? ("PERMANENT" as const)
          : input.duration === "TODAY"
            ? ("TODAY" as const)
            : ("DATE_RANGE" as const),
    };
    const unchanged =
      oldPlan.type === newPlan.type &&
      oldPlan.destination === newPlan.destination &&
      (oldPlan.busNumber || "") === (newPlan.busNumber || "") &&
      Boolean(oldPlan.waitingForAssignment) ===
        Boolean(newPlan.waitingForAssignment) &&
      (oldPlan.customAddress || "") === (newPlan.customAddress || "");
    if (unchanged) {
      continue;
    }

    const late = isAfterDeadline();
    const urgent = isAfterSnapshot();
    const teacherId = loaded.record.classroom.teachers[0]?.id || null;
    const studentName = loaded.effective.fullName;
    // Audit + desk notifications run after response so Submit returns quickly.
    after(() =>
      Promise.all([
        writeAudit({
          user,
          studentId: input.studentId,
          action:
            input.duration === "PERMANENT"
              ? "UPDATE_PERMANENT"
              : "CREATE_TEMPORARY",
          trip,
          durationType: input.duration,
          oldPlan,
          newPlan,
          approvedById: user.id,
        }).catch(() => undefined),
        (async () => {
          try {
            const event = await prisma.changeEvent.create({
              data: {
                schoolId: user.schoolId,
                studentId: input.studentId,
                trip,
                previousPlan: JSON.stringify(oldPlan),
                newPlan: JSON.stringify(newPlan),
                durationType: input.duration,
                late,
                urgent,
                waitingForRoute: Boolean(input.waitingForAssignment),
                createdById: user.id,
              },
            });
            const teacherUser = teacherId
              ? await prisma.user.findFirst({
                  where: { teacherId },
                })
              : null;
            if (teacherUser) {
              await prisma.teacherAcknowledgment.create({
                data: { changeEventId: event.id, userId: teacherUser.id },
              });
              await prisma.notification.create({
                data: {
                  schoolId: user.schoolId,
                  userId: teacherUser.id,
                  title: urgent
                    ? "Urgent last-minute transportation change"
                    : "Transportation change",
                  body: `${studentName}: ${planSummary(oldPlan, trip)} → ${planSummary(newPlan, trip)} by ${user.name} at ${formatTime(new Date())}.`,
                },
              });
            }
            await notifyCoordinators(
              user.schoolId,
              urgent
                ? "Last-minute change needs acknowledgment"
                : "Transportation change recorded",
              `${user.name} updated ${studentName}.`,
            );
          } catch {
            // Tables may not exist until live-ops.sql is run.
          }
        })(),
      ]).then(() => undefined, () => undefined),
    );
  }

  revalidatePath("/dashboard");
  revalidatePath("/changes");
  revalidatePath("/waiting");
  revalidatePath("/company");
  return { ok: true, ...(warnings.length ? { warnings } : {}) } as UpdateResult;
}

export async function undoLastChange(studentId: string): Promise<UpdateResult> {
  const user = await getSession();
  if (!user || (user.role !== "COORDINATOR" && user.role !== "ADMINISTRATOR")) {
    return { ok: false, error: "Only an admin or bus coordinator can undo a change." };
  }

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
  revalidatePath("/students");
  revalidatePath(`/students/${studentId}`);
  return { ok: true };
}
