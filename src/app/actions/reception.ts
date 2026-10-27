"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { updateTransportation } from "@/app/actions/transportation";
import { canRecordChange } from "@/lib/policy";
import { durationLabel } from "@/lib/format";
import { loadStudent } from "@/lib/transportation";
import {
  noticeSummary,
  notifyRouteRequest,
  notifyTransportationChange,
  planLine,
} from "@/lib/change-notify";
import { usableOpsEmail } from "@/lib/ops-change-emails";
import { usableTeacherEmail } from "@/lib/teacher-snapshot";
import type { Destination, DurationType, Trip } from "@/lib/types";

export type ReceptionChangeInput = {
  studentId: string;
  destination: Destination;
  trips: Trip[];
  duration: DurationType;
  startDate?: string;
  endDate?: string;
  busNumber?: string;
  customAddress?: string;
  daycareName?: string;
  daycareAddress?: string;
  daycarePhone?: string;
  parentEmail?: string;
  teacherEmail?: string;
  note?: string;
  confirmPermanent?: boolean;
};

async function attachDaycare(
  schoolId: string,
  studentId: string,
  name: string,
  line1: string,
  phone: string,
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
        city: "Minneapolis",
        state: "MN",
        zip: "",
        label: "daycare",
      },
    });
    daycare = await prisma.daycare.create({
      data: { schoolId, name: daycareName, addressId: address.id },
      select: { id: true },
    });
  }
  if (phone.trim()) {
    await prisma.$executeRaw`
      UPDATE "Daycare" SET "phone" = ${phone.trim()} WHERE "id" = ${daycare.id}
    `.catch(() => undefined);
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

export async function saveReceptionChange(input: ReceptionChangeInput) {
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

  const loaded = await loadStudent(input.studentId);
  if (!loaded || loaded.record.schoolId !== user.schoolId) {
    return { ok: false as const, error: "Student not found." };
  }

  const destination = input.destination;
  const busNumber = input.busNumber?.replace(/^Bus\s+/i, "").trim() || "";
  const waiting = !busNumber;
  const note = input.note?.trim() || "";
  const parentEmail = usableOpsEmail(input.parentEmail || "");
  const teacherEmail = usableTeacherEmail(input.teacherEmail || "");
  const previous = planLine(loaded.effective, input.trips);

  if (!parentEmail) {
    return { ok: false as const, error: "Parent email is required." };
  }
  if (!teacherEmail) {
    return { ok: false as const, error: "Teacher email is required." };
  }

  await prisma.$executeRaw`
    UPDATE "Student" SET "parentEmail" = ${parentEmail} WHERE "id" = ${input.studentId}
  `.catch(() => undefined);
  loaded.effective.parentEmail = parentEmail;
  await prisma.teacher
    .updateMany({
      where: { classroomId: loaded.effective.classroomId },
      data: { email: teacherEmail },
    })
    .catch(() => undefined);
  loaded.effective.teacherEmail = teacherEmail;

  if (destination === "CUSTOM" && !input.customAddress?.trim()) {
    return { ok: false as const, error: "Enter the new drop-off address." };
  }

  if (destination === "DAYCARE") {
    const hasDaycare =
      loaded.record.daycareId ||
      input.daycareName?.trim() ||
      loaded.effective.daycareName;
    if (!hasDaycare) {
      return {
        ok: false as const,
        error: "Enter the daycare name so we can send the student there.",
      };
    }
    if (input.daycareName?.trim() || input.daycareAddress?.trim()) {
      await attachDaycare(
        user.schoolId,
        input.studentId,
        input.daycareName || loaded.effective.daycareName || "Daycare",
        input.daycareAddress || loaded.effective.daycareAddress || "",
        input.daycarePhone || "",
      );
    }
  }

  const when =
    input.duration === "DATE_RANGE" && input.startDate && input.endDate
      ? `${input.startDate} – ${input.endDate}`
      : durationLabel(input.duration);

  for (const trip of input.trips) {
    const busRouteId = busNumber
      ? await routeId(user.schoolId, busNumber, trip)
      : undefined;
    const result = await updateTransportation({
      studentId: input.studentId,
      trips: [trip],
      type: "BUS",
      destination,
      duration: input.duration,
      startDate: input.startDate,
      endDate: input.endDate,
      busRouteId,
      waitingForAssignment: waiting,
      customAddress: input.customAddress,
      reason: note || `Transportation change entered by ${user.name}.`,
      confirmPermanent: input.confirmPermanent,
    });
    if (!result.ok) return result;
  }

  const after = await loadStudent(input.studentId);
  const student = after?.effective ?? loaded.effective;
  await prisma.changeRequest
    .create({
      data: {
        schoolId: user.schoolId,
        studentId: input.studentId,
        trip: input.trips.join("+"),
        source: user.role,
        title: `Transportation change — ${student.fullName}`,
        details: [
          planLine(student, input.trips),
          when,
          note,
          waiting ? "Waiting for a bus route." : "",
          `Entered by ${user.name}.`,
        ]
          .filter(Boolean)
          .join(" "),
        status: waiting ? "PENDING" : "COMPLETED",
        busNumber: busNumber || null,
        payload: JSON.stringify({
          destination,
          duration: input.duration,
          trips: input.trips,
          waiting,
        }),
        createdById: user.id,
        reviewedById: waiting ? null : user.id,
        reviewedAt: waiting ? null : new Date(),
      },
    })
    .catch(() => undefined);
  const notice = await notifyTransportationChange({
    user,
    student,
    trips: input.trips,
    previous,
    next: planLine(student, input.trips),
    when,
    note,
    waiting,
    teacherEmail,
  });

  return {
    ok: true as const,
    waiting,
    message: noticeSummary(notice),
    sent: notice.sent,
    skipped: notice.skipped,
  };
}

export type RouteRequestInput = {
  studentId: string;
  vehicle: "BUS" | "VAN";
  destination: Destination;
  trips: Trip[];
  customAddress?: string;
  daycareName?: string;
  daycareAddress?: string;
  daycarePhone?: string;
  note?: string;
};

export async function requestRoute(input: RouteRequestInput) {
  const user = await getSession();
  if (!user) return { ok: false as const, error: "Please sign in." };
  if (!["FRONT_DESK", "COORDINATOR", "ADMINISTRATOR"].includes(user.role)) {
    return { ok: false as const, error: "You cannot request a route." };
  }
  if (!input.trips.length) {
    return { ok: false as const, error: "Choose morning, afternoon, or both." };
  }

  const loaded = await loadStudent(input.studentId);
  if (!loaded || loaded.record.schoolId !== user.schoolId) {
    return { ok: false as const, error: "Student not found." };
  }

  const note = input.note?.trim() || "";
  if (input.destination === "CUSTOM" && !input.customAddress?.trim()) {
    return { ok: false as const, error: "Enter the drop-off address." };
  }
  if (input.destination === "DAYCARE") {
    const hasDaycare =
      loaded.record.daycareId ||
      input.daycareName?.trim() ||
      loaded.effective.daycareName;
    if (!hasDaycare) {
      return { ok: false as const, error: "Enter the daycare name." };
    }
    if (input.daycareName?.trim() || input.daycareAddress?.trim()) {
      await attachDaycare(
        user.schoolId,
        input.studentId,
        input.daycareName || loaded.effective.daycareName || "Daycare",
        input.daycareAddress || loaded.effective.daycareAddress || "",
        input.daycarePhone || "",
      );
    }
  }

  let customAddressId: string | undefined;
  if (input.destination === "CUSTOM" && input.customAddress?.trim()) {
    const created = await prisma.address.create({
      data: {
        schoolId: user.schoolId,
        line1: input.customAddress.trim(),
        city: "Minneapolis",
        state: "MN",
        zip: "",
        label: "custom",
      },
    });
    customAddressId = created.id;
  }
  const refreshed = await loadStudent(input.studentId);
  const daycareId = refreshed?.record.daycareId || loaded.record.daycareId;
  const reason =
    note ||
    `Request for ${input.vehicle === "VAN" ? "van" : "bus"} entered by ${user.name}.`;

  for (const trip of input.trips) {
    await prisma.transportationAssignment.upsert({
      where: { studentId_trip: { studentId: input.studentId, trip } },
      create: {
        studentId: input.studentId,
        trip,
        type: "BUS",
        destination: input.destination,
        busRouteId: null,
        daycareId: input.destination === "DAYCARE" ? daycareId : null,
        customAddressId: customAddressId ?? null,
        waitingForAssignment: true,
        notes: reason,
        effectiveStart: new Date(),
        updatedById: user.id,
      },
      update: {
        type: "BUS",
        destination: input.destination,
        busRouteId: null,
        daycareId: input.destination === "DAYCARE" ? daycareId : null,
        customAddressId: customAddressId ?? null,
        waitingForAssignment: true,
        notes: reason,
        updatedById: user.id,
      },
    });
  }

  const after = await loadStudent(input.studentId);
  const student = after?.effective ?? loaded.effective;
  const address =
    input.destination === "CUSTOM"
      ? input.customAddress?.trim() || student.homeAddress
      : input.destination === "DAYCARE"
        ? [student.daycareName, student.daycareAddress].filter(Boolean).join(" · ")
        : student.homeAddress;

  await prisma.changeRequest
    .create({
      data: {
        schoolId: user.schoolId,
        studentId: input.studentId,
        trip: input.trips.join("+"),
        source: user.role,
        title: `Request for ${input.vehicle === "VAN" ? "van" : "bus"} — ${student.fullName}`,
        details: [
          `Need: ${input.vehicle === "VAN" ? "van" : "bus"}`,
          address,
          note,
          "Stays on Request for Route until Front Desk enters the assigned number.",
          `Entered by ${user.name}.`,
        ]
          .filter(Boolean)
          .join(" "),
        status: "PENDING",
        busNumber: null,
        payload: JSON.stringify({
          kind: "ROUTE_REQUEST",
          vehicle: input.vehicle,
          destination: input.destination,
          trips: input.trips,
        }),
        createdById: user.id,
      },
    })
    .catch(() => undefined);

  revalidatePath("/dashboard");
  revalidatePath("/waiting");
  revalidatePath("/changes");

  const notice = await notifyRouteRequest({
    user,
    student,
    trips: input.trips,
    vehicle: input.vehicle,
    destination: input.destination,
    address,
    note,
  });

  return {
    ok: true as const,
    waiting: true,
    message: [
      "Requested a route from the bus company.",
      notice.sent.length ? `Emailed ${notice.sent.join(", ")}.` : "",
      notice.skipped.length ? `Could not email ${notice.skipped.join(", ")}.` : "",
      "The student stays on Request for Route until you enter the bus or van they assign.",
    ]
      .filter(Boolean)
      .join(" "),
    sent: notice.sent,
    skipped: notice.skipped,
  };
}
