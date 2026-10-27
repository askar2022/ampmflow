"use server";

import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { updateTransportation } from "@/app/actions/transportation";
import { canRecordChange } from "@/lib/policy";
import { durationLabel } from "@/lib/format";
import { loadStudent } from "@/lib/transportation";
import {
  noticeSummary,
  notifyTransportationChange,
  planLine,
} from "@/lib/change-notify";
import { addOpsEmail } from "@/lib/ops-change-emails";
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
  busCompanyEmail?: string;
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
  const parentEmail = input.parentEmail?.trim().toLowerCase() || "";
  const teacherEmail = usableTeacherEmail(input.teacherEmail || "");
  const busCompanyEmail = input.busCompanyEmail?.trim().toLowerCase() || "";
  const previous = planLine(loaded.effective, input.trips);

  if (parentEmail) {
    await prisma.$executeRaw`
      UPDATE "Student" SET "parentEmail" = ${parentEmail} WHERE "id" = ${input.studentId}
    `.catch(() => undefined);
    loaded.effective.parentEmail = parentEmail;
  }
  if (teacherEmail) {
    await prisma.teacher
      .updateMany({
        where: { classroomId: loaded.effective.classroomId },
        data: { email: teacherEmail },
      })
      .catch(() => undefined);
    loaded.effective.teacherEmail = teacherEmail;
  }
  if (busCompanyEmail) {
    await addOpsEmail(user.schoolId, busCompanyEmail).catch(() => undefined);
  }

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
    busCompanyEmail,
  });

  return {
    ok: true as const,
    waiting,
    message: noticeSummary(notice),
    sent: notice.sent,
    skipped: notice.skipped,
  };
}
