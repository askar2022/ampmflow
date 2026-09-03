"use server";

import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { updateTransportation } from "@/app/actions/transportation";
import { usablePhone } from "@/lib/gate";
import { canRecordChange } from "@/lib/policy";
import type { Destination, DurationType, TransportType, Trip } from "@/lib/types";

export type ParentChangeKind = "HOME_PICKUP" | "CUSTOM_DROP" | "DAYCARE";

export type ParentChangeInput = {
  studentId: string;
  kind: ParentChangeKind;
  trips: Trip[];
  duration: DurationType;
  startDate?: string;
  endDate?: string;
  customAddress?: string;
  customCity?: string;
  customZip?: string;
  daycareName?: string;
  daycareAddress?: string;
  daycareCity?: string;
  daycareZip?: string;
  busNumber?: string;
  parentAtDaycare?: boolean;
  busToCustom?: boolean;
  note?: string;
  applyFamily?: boolean;
  confirmPermanent?: boolean;
};

async function attachDaycare(
  schoolId: string,
  studentId: string,
  name: string,
  line1: string,
  city: string,
  zip: string,
) {
  const daycareName = name.trim() || "Daycare";
  let daycare = await prisma.daycare.findFirst({
    where: { schoolId, name: daycareName },
    select: { id: true },
  });
  if (!daycare) {
    const address = await prisma.address.create({
      data: {
        schoolId,
        line1: line1.trim() || "Daycare address pending",
        city: city.trim() || "Minneapolis",
        state: "MN",
        zip: zip.trim(),
        label: "daycare",
      },
    });
    daycare = await prisma.daycare.create({
      data: { schoolId, name: daycareName, addressId: address.id },
      select: { id: true },
    });
  }
  await prisma.student.update({
    where: { id: studentId },
    data: { daycareId: daycare.id },
  });
  return daycare.id;
}

async function routeId(schoolId: string, number: string, trip: Trip) {
  const clean = number.replace(/^Bus\s+/i, "").trim();
  if (!clean) return undefined;
  const route = await prisma.busRoute.upsert({
    where: { schoolId_number_trip: { schoolId, number: clean, trip } },
    create: {
      schoolId,
      number: clean,
      trip,
      name: `Route ${clean}`,
    },
    update: {},
    select: { id: true },
  });
  return route.id;
}

export async function saveParentChange(input: ParentChangeInput) {
  const user = await getSession();
  if (!user) return { ok: false as const, error: "Please sign in." };
  if (!canRecordChange(user.role, input.duration)) {
    return {
      ok: false as const,
      error:
        user.role === "FRONT_DESK"
          ? "Reception can save today or a date range. An admin must save a permanent change."
          : "You cannot save this change.",
    };
  }
  if (!input.trips.length) {
    return { ok: false as const, error: "Choose morning, afternoon, or both." };
  }

  const first = await prisma.student.findFirst({
    where: { id: input.studentId, schoolId: user.schoolId },
    select: { id: true, parentPhone: true },
  });
  if (!first) return { ok: false as const, error: "Student not found." };

  const ids = [first.id];
  if (input.applyFamily) {
    const phone = usablePhone(first.parentPhone);
    if (phone) {
      const siblings = await prisma.student.findMany({
        where: { schoolId: user.schoolId },
        select: { id: true, parentPhone: true },
      });
      for (const row of siblings) {
        if (usablePhone(row.parentPhone) === phone && !ids.includes(row.id)) {
          ids.push(row.id);
        }
      }
    }
  }

  let type: TransportType = "PARENT";
  let destination: Destination = "HOME";
  let customAddress = "";
  let waiting = false;

  if (input.kind === "HOME_PICKUP") {
    type = "PARENT";
    destination = "HOME";
  } else if (input.kind === "CUSTOM_DROP") {
    const line = [
      input.customAddress?.trim(),
      input.customCity?.trim(),
      input.customZip?.trim(),
    ]
      .filter(Boolean)
      .join(", ");
    if (!line) {
      return { ok: false as const, error: "Enter the drop-off or pickup address." };
    }
    destination = "CUSTOM";
    customAddress = line;
    type = input.busToCustom ? "BUS" : "PARENT";
    waiting = Boolean(input.busToCustom && !input.busNumber?.trim());
  } else {
    destination = "DAYCARE";
    type = input.parentAtDaycare ? "PARENT" : "BUS";
    waiting = Boolean(type === "BUS" && !input.busNumber?.trim());
    if (!input.daycareName?.trim() && !input.daycareAddress?.trim()) {
      return {
        ok: false as const,
        error: "Enter the daycare name or address.",
      };
    }
    for (const studentId of ids) {
      await attachDaycare(
        user.schoolId,
        studentId,
        input.daycareName || "Daycare",
        input.daycareAddress || "",
        input.daycareCity || "",
        input.daycareZip || "",
      );
    }
  }

  const reason = input.note?.trim() || parentChangeReason(input.kind);
  let saved = 0;
  for (const studentId of ids) {
    for (const trip of input.trips) {
      const busRouteId =
        type === "BUS" && input.busNumber?.trim()
          ? await routeId(user.schoolId, input.busNumber, trip)
          : undefined;
      const result = await updateTransportation({
        studentId,
        trips: [trip],
        type,
        destination,
        duration: input.duration,
        startDate: input.startDate,
        endDate: input.endDate,
        busRouteId,
        waitingForAssignment: waiting,
        customAddress,
        reason,
        confirmPermanent: input.confirmPermanent,
      });
      if (!result.ok) return result;
      saved += 1;
    }
  }

  return { ok: true as const, count: ids.length, saved };
}

function parentChangeReason(kind: ParentChangeKind) {
  if (kind === "HOME_PICKUP") return "Parent requested home pickup.";
  if (kind === "CUSTOM_DROP") return "Parent requested a different drop-off or pickup address.";
  return "Parent requested a daycare change.";
}
