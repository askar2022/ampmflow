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
import { addOpsEmail, usableOpsEmail } from "@/lib/ops-change-emails";
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
  studentId?: string;
  firstName: string;
  lastName: string;
  grade: string;
  teacherName: string;
  parentPhone: string;
  parentEmail: string;
  busCompanyEmail: string;
  address: string;
  emergencyContact: string;
};

export async function requestRoute(input: RouteRequestInput) {
  const user = await getSession();
  if (!user) return { ok: false as const, error: "Please sign in." };
  if (!["FRONT_DESK", "COORDINATOR", "ADMINISTRATOR"].includes(user.role)) {
    return { ok: false as const, error: "You cannot request a route." };
  }

  const firstName = input.firstName.trim();
  const lastName = input.lastName.trim();
  const grade = input.grade.trim();
  const teacherName = input.teacherName.trim();
  const parentPhone = input.parentPhone.trim();
  const parentEmail = usableOpsEmail(input.parentEmail || "");
  const busCompanyEmail = usableOpsEmail(input.busCompanyEmail || "");
  const address = input.address.trim();
  const emergency = input.emergencyContact.trim();

  if (!firstName || !lastName) {
    return { ok: false as const, error: "Enter the student’s first and last name." };
  }
  if (!parentPhone) return { ok: false as const, error: "Enter the parent phone." };
  if (!parentEmail) return { ok: false as const, error: "Enter the parent email." };
  if (!busCompanyEmail) {
    return { ok: false as const, error: "Enter the bus company email." };
  }
  if (!address) return { ok: false as const, error: "Enter the student address." };

  await addOpsEmail(user.schoolId, busCompanyEmail).catch(() => undefined);

  let loaded = input.studentId
    ? await loadStudent(input.studentId)
    : null;
  if (!loaded || loaded.record.schoolId !== user.schoolId) {
    const match = await prisma.student.findFirst({
      where: {
        schoolId: user.schoolId,
        firstName: { equals: firstName, mode: "insensitive" },
        lastName: { equals: lastName, mode: "insensitive" },
      },
      select: { id: true },
    });
    loaded = match ? await loadStudent(match.id) : null;
  }

  if (loaded && loaded.record.schoolId === user.schoolId) {
    await prisma.student.update({
      where: { id: loaded.record.id },
      data: {
        firstName,
        lastName,
        grade: grade || loaded.record.grade,
        parentPhone,
      },
    });
    await prisma.$executeRaw`
      UPDATE "Student"
      SET "parentEmail" = ${parentEmail},
          "emergencyName" = ${emergency},
          "emergencyPhone" = ${emergency}
      WHERE "id" = ${loaded.record.id}
    `.catch(() => undefined);
    if (address) {
      await prisma.address
        .update({
          where: { id: loaded.record.homeAddressId },
          data: { line1: address },
        })
        .catch(() => undefined);
    }
    if (teacherName) {
      await prisma.teacher
        .updateMany({
          where: { classroomId: loaded.effective.classroomId },
          data: { name: teacherName },
        })
        .catch(() => undefined);
    }
    const reason = `Request for route entered by ${user.name}.`;
    for (const trip of ["AM", "PM"] as const) {
      await prisma.transportationAssignment.upsert({
        where: { studentId_trip: { studentId: loaded.record.id, trip } },
        create: {
          studentId: loaded.record.id,
          trip,
          type: "BUS",
          destination: "HOME",
          busRouteId: null,
          waitingForAssignment: true,
          notes: reason,
          effectiveStart: new Date(),
          updatedById: user.id,
        },
        update: {
          type: "BUS",
          destination: "HOME",
          busRouteId: null,
          waitingForAssignment: true,
          notes: reason,
          updatedById: user.id,
        },
      });
    }
  }

  await prisma.changeRequest
    .create({
      data: {
        schoolId: user.schoolId,
        studentId: loaded?.record.id ?? null,
        trip: "AM+PM",
        source: user.role,
        title: `Request for route — ${firstName} ${lastName}`,
        details: [
          grade ? `Grade ${grade}` : "",
          teacherName,
          parentPhone,
          parentEmail,
          busCompanyEmail,
          address,
          emergency,
          `Entered by ${user.name}.`,
        ]
          .filter(Boolean)
          .join(" · "),
        status: "PENDING",
        busNumber: null,
        payload: JSON.stringify({ kind: "ROUTE_REQUEST" }),
        createdById: user.id,
      },
    })
    .catch(() => undefined);

  revalidatePath("/dashboard");
  revalidatePath("/waiting");
  revalidatePath("/changes");

  const notice = await notifyRouteRequest({
    user,
    studentName: `${firstName} ${lastName}`,
    studentId: loaded?.effective.studentId,
    grade,
    teacherName,
    parentPhone,
    parentEmail,
    busCompanyEmail,
    address,
    emergency,
  });

  return {
    ok: true as const,
    waiting: true,
    message: [
      "Request sent.",
      notice.sent.length ? `Emailed ${notice.sent.join(", ")}.` : "",
      notice.skipped.length ? `Could not email ${notice.skipped.join(", ")}.` : "",
      "The student stays here until Front Desk enters the assigned bus or van.",
    ]
      .filter(Boolean)
      .join(" "),
    sent: notice.sent,
    skipped: notice.skipped,
  };
}
