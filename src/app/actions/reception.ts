"use server";

import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { updateTransportation } from "@/app/actions/transportation";
import { canRecordChange } from "@/lib/policy";
import { durationLabel, planSummary } from "@/lib/format";
import { ensureStudentContactColumns, loadStudent } from "@/lib/transportation";
import {
  notifyRouteRequest,
  notifyStudentLeft,
  notifyTransportationChange,
  planLine,
  queuedNoticeMessage,
  scheduleChangeNotify,
} from "@/lib/change-notify";
import {
  defaultBusCompanyEmail,
  saveSchoolBusCompanyEmail,
  saveSchoolDeskNotifyEmails,
  usableOpsEmail,
} from "@/lib/ops-change-emails";
import { canCompanyAccessSchool } from "@/lib/company-access";
import { ensureAddressGeoColumns, geocodeAndSaveAddress } from "@/lib/geocode";
import { parentSmsNumbers } from "@/lib/sms";
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
  parentPhone?: string;
  parentPhone2?: string;
  parentEmail?: string;
  teacherEmail?: string;
  busCompanyEmail?: string;
  coordinatorEmail?: string;
  frontDeskEmail?: string;
  note?: string;
  confirmPermanent?: boolean;
  confirmReplaceChange?: boolean;
};

async function attachDaycare(
  schoolId: string,
  studentId: string,
  name: string,
  line1: string,
  phone: string,
) {
  const daycareName = name.trim() || "Daycare";
  const street = line1.trim();
  let daycare = await prisma.daycare.findFirst({
    where: { schoolId, name: daycareName },
    select: { id: true, addressId: true },
  });
  if (!daycare) {
    const address = await prisma.address.create({
      data: {
        schoolId,
        line1: street || "Daycare address pending",
        city: "Minneapolis",
        state: "MN",
        zip: "",
        label: "daycare",
      },
    });
    daycare = await prisma.daycare.create({
      data: { schoolId, name: daycareName, addressId: address.id },
      select: { id: true, addressId: true },
    });
  } else if (street) {
    await prisma.address
      .update({
        where: { id: daycare.addressId },
        data: { line1: street },
      })
      .catch(() => undefined);
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
  await ensureAddressGeoColumns();
  await prisma.$executeRaw`
    UPDATE "Address"
    SET "latitude" = NULL, "longitude" = NULL
    WHERE "id" = ${daycare.addressId}
  `.catch(() => undefined);
  await geocodeAndSaveAddress(daycare.addressId).catch(() => undefined);
  return daycare.id;
}

async function ensureVan(schoolId: string, name: string) {
  const label = name.replace(/^Van\s+/i, "").trim();
  const vanName = /^van\b/i.test(name.trim()) ? name.trim() : `Van ${label}`;
  const existing = await prisma.$queryRaw<Array<{ id: string; name: string }>>`
    SELECT "id", "name" FROM "TransportVehicle"
    WHERE "schoolId" = ${schoolId}
      AND (
        lower("name") = ${vanName.toLowerCase()}
        OR lower("name") = ${label.toLowerCase()}
        OR lower("name") = ${`van ${label}`.toLowerCase()}
      )
  `.catch(() => []);
  if (existing[0]) return existing[0];
  const id = randomUUID();
  await prisma.$executeRaw`
    INSERT INTO "TransportVehicle"
      ("id", "schoolId", "name", "vehicleType", "driverName", "driverPhone", "createdAt", "updatedAt")
    VALUES
      (${id}, ${schoolId}, ${vanName}, 'VAN', '', '', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
  `;
  return { id, name: vanName };
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

  const alreadyChanged =
    loaded.effective.am.source === "TODAY" ||
    loaded.effective.am.source === "DATE_RANGE" ||
    loaded.effective.pm.source === "TODAY" ||
    loaded.effective.pm.source === "DATE_RANGE";
  if (alreadyChanged && !input.confirmReplaceChange) {
    return {
      ok: false as const,
      needsConfirm: true as const,
      error: `${loaded.effective.fullName} already has a change. Morning: ${planSummary(loaded.effective.am, "AM")}. Afternoon: ${planSummary(loaded.effective.pm, "PM")}. Was that a mistake? Confirm to save a new change.`,
    };
  }

  const destination = input.destination;
  const needsCompanyBus = destination === "DAYCARE" || destination === "CUSTOM";
  const busNumber = needsCompanyBus
    ? ""
    : input.busNumber?.replace(/^Bus\s+/i, "").trim() || "";
  const waiting = needsCompanyBus || !busNumber;
  const note = input.note?.trim() || "";
  const parentEmail = usableOpsEmail(input.parentEmail || "");
  const teacherEmail = usableTeacherEmail(input.teacherEmail || "");
  const busCompanyEmail = usableOpsEmail(input.busCompanyEmail || "");
  const coordinatorEmail = usableOpsEmail(input.coordinatorEmail || "");
  const frontDeskEmail = usableOpsEmail(input.frontDeskEmail || "");
  const parentPhone = input.parentPhone?.trim() || "";
  const parentPhone2 = input.parentPhone2?.trim() || "";
  const previous = planLine(loaded.effective, input.trips);

  if (!parentSmsNumbers(parentPhone, parentPhone2).length) {
    return { ok: false as const, error: "Primary 1 phone is required so we can text the change." };
  }
  if (!parentEmail) {
    return { ok: false as const, error: "Parent email is required." };
  }
  if (!teacherEmail) {
    return { ok: false as const, error: "Teacher email is required." };
  }
  if (!busCompanyEmail) {
    return { ok: false as const, error: "Bus company email is required." };
  }
  if (!coordinatorEmail) {
    return { ok: false as const, error: "Bus coordinator email is required." };
  }
  if (!frontDeskEmail) {
    return { ok: false as const, error: "Front Desk email is required." };
  }
  await saveSchoolBusCompanyEmail(user.schoolId, busCompanyEmail).catch(
    () => undefined,
  );
  await saveSchoolDeskNotifyEmails(user.schoolId, {
    coordinatorEmail,
    frontDeskEmail,
  }).catch(() => undefined);

  await prisma.$executeRaw`
    UPDATE "Student"
    SET "parentEmail" = ${parentEmail},
        "parentPhone" = ${parentPhone || loaded.effective.parentPhone},
        "parentPhone2" = ${parentPhone2}
    WHERE "id" = ${input.studentId}
  `.catch(() => undefined);
  loaded.effective.parentEmail = parentEmail;
  loaded.effective.parentPhone = parentPhone || loaded.effective.parentPhone;
  loaded.effective.parentPhone2 = parentPhone2;
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
  student.parentPhone = parentPhone || student.parentPhone;
  student.parentPhone2 = parentPhone2;
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
  scheduleChangeNotify(
    notifyTransportationChange({
      user,
      student,
      trips: input.trips,
      previous,
      next: planLine(student, input.trips),
      when,
      note,
      waiting,
      destination,
      parentSms:
        destination === "DAYCARE"
          ? "daycare-request"
          : destination === "CUSTOM"
            ? "address-request"
            : waiting
              ? "ride-request"
              : "assigned",
      teacherEmail,
      busCompanyEmail,
    }),
  );

  return {
    ok: true as const,
    waiting,
    message: queuedNoticeMessage(waiting),
    sent: [] as string[],
    skipped: [] as string[],
  };
}

/** Fill grade / parent / teacher after a Dayib route load (bus file has no school fields). */
export async function saveReceptionStudentInfo(input: {
  studentId: string;
  grade?: string;
  parentName?: string;
  teacherName?: string;
  teacherEmail?: string;
  parentPhone?: string;
}) {
  const user = await getSession();
  if (!user) return { ok: false as const, error: "Please sign in." };
  if (!["FRONT_DESK", "COORDINATOR", "ADMINISTRATOR"].includes(user.role)) {
    return { ok: false as const, error: "You cannot edit student info." };
  }

  const loaded = await loadStudent(input.studentId);
  if (!loaded || loaded.record.schoolId !== user.schoolId) {
    return { ok: false as const, error: "Student not found." };
  }

  const grade = (input.grade || "").trim() || loaded.record.grade || "—";
  const parentName =
    (input.parentName || "").trim() || loaded.record.parentName || "—";
  const teacherName =
    (input.teacherName || "").trim() || loaded.effective.teacherName || "Unassigned";
  const teacherEmail =
    usableTeacherEmail(input.teacherEmail || "") ||
    usableTeacherEmail(loaded.effective.teacherEmail || "") ||
    "";
  const parentPhone =
    (input.parentPhone || "").trim() || loaded.record.parentPhone || "—";

  await prisma.student.update({
    where: { id: loaded.record.id },
    data: {
      grade,
      parentName,
      parentPhone,
    },
  });

  const classroomName =
    teacherName === "Unassigned" ? `${grade} classroom` : teacherName;
  let classroom = await prisma.classroom.findFirst({
    where: { schoolId: user.schoolId, name: classroomName },
    select: { id: true },
  });
  if (!classroom) {
    classroom = await prisma.classroom.create({
      data: {
        schoolId: user.schoolId,
        name: classroomName,
        grade,
      },
      select: { id: true },
    });
  }
  const teacher = await prisma.teacher.findFirst({
    where: { classroomId: classroom.id },
    select: { id: true, email: true },
  });
  if (!teacher) {
    await prisma.teacher.create({
      data: {
        schoolId: user.schoolId,
        classroomId: classroom.id,
        name: teacherName,
        email: teacherEmail,
      },
    });
  } else {
    const patch: { name?: string; email?: string } = {};
    if (teacherName !== "Unassigned") patch.name = teacherName;
    if (teacherEmail) patch.email = teacherEmail;
    else if (input.teacherEmail !== undefined && !String(input.teacherEmail || "").trim()) {
      patch.email = "";
    }
    if (Object.keys(patch).length) {
      await prisma.teacher
        .update({ where: { id: teacher.id }, data: patch })
        .catch(() => undefined);
    }
  }
  await prisma.student.update({
    where: { id: loaded.record.id },
    data: { classroomId: classroom.id },
  });

  // Same phone = same family for later sibling grouping.
  const phoneKey = parentPhone.replace(/\D/g, "");
  if (phoneKey.length >= 10) {
    const familyKey = `PHONE-${phoneKey.slice(-10)}`;
    let family = await prisma.family
      .findFirst({
        where: { schoolId: user.schoolId, familyKey },
        select: { id: true },
      })
      .catch(() => null);
    if (!family) {
      try {
        family = await prisma.family.create({
          data: {
            schoolId: user.schoolId,
            familyKey,
            reviewNeeded: false,
            reviewNote: "",
          },
          select: { id: true },
        });
      } catch {
        family = await prisma.family
          .findFirst({
            where: { schoolId: user.schoolId, familyKey },
            select: { id: true },
          })
          .catch(() => null);
      }
    }
    if (family) {
      await prisma.student
        .updateMany({
          where: {
            schoolId: user.schoolId,
            active: true,
            OR: [
              { id: loaded.record.id },
              { parentPhone },
            ],
          },
          data: { familyId: family.id },
        })
        .catch(() => undefined);
    }
  }

  revalidatePath("/dashboard");
  revalidatePath("/changes");
  revalidatePath(`/students/${loaded.record.id}`);
  return { ok: true as const, message: "Student info saved." };
}

export async function removeReceptionStudent(input: {
  studentId: string;
  reason: string;
  note?: string;
  parentPhone?: string;
  parentPhone2?: string;
  parentEmail?: string;
  teacherEmail?: string;
  busCompanyEmail?: string;
}) {
  const user = await getSession();
  if (!user) return { ok: false as const, error: "Please sign in." };
  if (!["FRONT_DESK", "COORDINATOR", "ADMINISTRATOR"].includes(user.role)) {
    return { ok: false as const, error: "You cannot remove a student." };
  }

  const loaded = await loadStudent(input.studentId);
  if (!loaded || loaded.record.schoolId !== user.schoolId) {
    return { ok: false as const, error: "Student not found." };
  }
  if (!loaded.record.active) {
    return { ok: false as const, error: "This student is already off the list." };
  }

  const parentEmail = usableOpsEmail(input.parentEmail || "");
  const teacherEmail = usableTeacherEmail(input.teacherEmail || "");
  const busCompanyEmail = usableOpsEmail(input.busCompanyEmail || "");
  const parentPhone = input.parentPhone?.trim() || "";
  const parentPhone2 = input.parentPhone2?.trim() || "";
  const reason = input.reason.trim();
  const note = input.note?.trim() || "";
  if (!reason) {
    return { ok: false as const, error: "Choose why this student is leaving." };
  }
  if (!parentSmsNumbers(parentPhone, parentPhone2).length) {
    return { ok: false as const, error: "Primary 1 phone is required so we can text the parent." };
  }
  if (!parentEmail) return { ok: false as const, error: "Parent email is required." };
  if (!teacherEmail) return { ok: false as const, error: "Teacher email is required." };
  if (!busCompanyEmail) {
    return { ok: false as const, error: "Bus company email is required." };
  }

  await saveSchoolBusCompanyEmail(user.schoolId, busCompanyEmail).catch(
    () => undefined,
  );
  await prisma.$executeRaw`
    UPDATE "Student"
    SET "parentEmail" = ${parentEmail},
        "parentPhone" = ${parentPhone || loaded.effective.parentPhone},
        "parentPhone2" = ${parentPhone2},
        "active" = false
    WHERE "id" = ${input.studentId}
  `;

  const student = loaded.effective;
  student.parentEmail = parentEmail;
  student.parentPhone = parentPhone || student.parentPhone;
  student.parentPhone2 = parentPhone2;
  const previous = planLine(student, ["AM", "PM"]);

  await prisma.changeRequest
    .create({
      data: {
        schoolId: user.schoolId,
        studentId: input.studentId,
        trip: "AM+PM",
        source: user.role,
        title: `Student left — ${student.fullName}`,
        details: [reason, note, `Entered by ${user.name}.`]
          .filter(Boolean)
          .join(" "),
        status: "COMPLETED",
        payload: JSON.stringify({ left: true, reason }),
        createdById: user.id,
        reviewedById: user.id,
        reviewedAt: new Date(),
      },
    })
    .catch(() => undefined);

  scheduleChangeNotify(
    notifyStudentLeft({
      user,
      student,
      previous,
      reason,
      note,
      teacherEmail,
      busCompanyEmail,
    }),
  );

  revalidatePath("/dashboard");
  revalidatePath("/buses");
  revalidatePath("/print");
  revalidatePath("/changes");
  revalidatePath("/waiting");

  return {
    ok: true as const,
    message: queuedNoticeMessage(
      false,
      `${student.fullName} is off Front Desk and Reports. Put them back from Roster Archive if this was a mistake.`,
    ),
  };
}

async function createRequestedStudent(args: {
  schoolId: string;
  firstName: string;
  lastName: string;
  grade: string;
  teacherName: string;
  parentPhone: string;
  parentEmail: string;
  address: string;
  emergency: string;
}) {
  const teacherName = args.teacherName.trim() || "Unassigned";
  const classroomName =
    teacherName === "Unassigned" ? `${args.grade} classroom` : teacherName;
  let classroom = await prisma.classroom.findFirst({
    where: { schoolId: args.schoolId, name: classroomName },
    select: { id: true },
  });
  if (!classroom) {
    classroom = await prisma.classroom.create({
      data: {
        schoolId: args.schoolId,
        name: classroomName,
        grade: args.grade,
      },
      select: { id: true },
    });
  }
  const teacher = await prisma.teacher.findFirst({
    where: { classroomId: classroom.id },
    select: { id: true },
  });
  if (!teacher) {
    await prisma.teacher.create({
      data: {
        schoolId: args.schoolId,
        classroomId: classroom.id,
        name: teacherName,
        email: "",
      },
    });
  }
  const home = await prisma.address.create({
    data: {
      schoolId: args.schoolId,
      line1: args.address,
      city: "Minneapolis",
      state: "MN",
      zip: "",
      label: "home",
    },
  });
  await geocodeAndSaveAddress(home.id).catch(() => undefined);
  const student = await prisma.student.create({
    data: {
      schoolId: args.schoolId,
      studentId: `REQ-${randomUUID().slice(0, 8)}`,
      firstName: args.firstName,
      lastName: args.lastName,
      grade: args.grade,
      classroomId: classroom.id,
      parentName: "",
      parentPhone: args.parentPhone,
      parentEmail: args.parentEmail,
      emergencyName: args.emergency,
      emergencyPhone: args.emergency,
      homeAddressId: home.id,
      enrollmentSource: "ROUTE_REQUEST",
    },
  });
  return loadStudent(student.id);
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
  if (!parentPhone) return { ok: false as const, error: "Enter the Primary 1 phone." };
  if (!parentEmail) return { ok: false as const, error: "Enter the parent email." };
  if (!busCompanyEmail) {
    return { ok: false as const, error: "Enter the bus company email." };
  }
  if (!address) return { ok: false as const, error: "Enter the student address." };
  if (!grade) return { ok: false as const, error: "Enter the grade." };

  await saveSchoolBusCompanyEmail(user.schoolId, busCompanyEmail).catch(
    () => undefined,
  );

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

  if (!loaded || loaded.record.schoolId !== user.schoolId) {
    loaded = await createRequestedStudent({
      schoolId: user.schoolId,
      firstName,
      lastName,
      grade,
      teacherName,
      parentPhone,
      parentEmail,
      address,
      emergency,
    });
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
      await ensureAddressGeoColumns();
      await prisma.$executeRaw`
        UPDATE "Address"
        SET "latitude" = NULL, "longitude" = NULL
        WHERE "id" = ${loaded.record.homeAddressId}
      `.catch(() => undefined);
      await geocodeAndSaveAddress(loaded.record.homeAddressId).catch(
        () => undefined,
      );
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

  if (!loaded?.record.id) {
    return {
      ok: false as const,
      error: "Could not save the student for this request. Try again.",
    };
  }

  try {
    await prisma.changeRequest.create({
      data: {
        schoolId: user.schoolId,
        studentId: loaded.record.id,
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
    });
  } catch {
    return {
      ok: false as const,
      error: "Could not save the route request for the bus company. Try again.",
    };
  }

  revalidatePath("/dashboard");
  revalidatePath("/waiting");
  revalidatePath("/changes");
  revalidatePath("/company");

  scheduleChangeNotify(
    notifyRouteRequest({
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
    }),
  );

  return {
    ok: true as const,
    waiting: true,
    message: queuedNoticeMessage(
      true,
      "The student stays here until the bus company assigns a bus or van.",
    ),
    sent: [] as string[],
    skipped: [] as string[],
  };
}

export async function assignRequestedBus(input: {
  requestId?: string;
  studentId?: string;
  busNumber?: string;
  vehicle?: "bus" | "van";
  trips?: Trip[];
  amPickupTime?: string;
  pmPickupTime?: string;
}) {
  const user = await getSession();
  if (!user) return { ok: false as const, error: "Please sign in." };
  if (user.role !== "BUS_COMPANY") {
    return {
      ok: false as const,
      error: "The bus company assigns the bus or van.",
    };
  }

  const vehicle = input.vehicle === "van" ? "van" : "bus";
  const rideName = (input.busNumber || "").trim();
  if (!rideName) {
    return {
      ok: false as const,
      error:
        vehicle === "van"
          ? "Type the van the company sent."
          : "Type the bus number the company sent.",
    };
  }

  const request = input.requestId
    ? await prisma.changeRequest.findFirst({
        where: { id: input.requestId },
      })
    : null;
  const studentId = input.studentId || request?.studentId || "";
  if (!studentId) {
    return {
      ok: false as const,
      error: "Open Front Desk and search this student first.",
    };
  }

  const loaded = await loadStudent(studentId);
  if (!loaded) {
    return { ok: false as const, error: "Student not found." };
  }
  const schoolId = loaded.record.schoolId;
  if (!(await canCompanyAccessSchool(user, schoolId))) {
    return { ok: false as const, error: "That school is not on your list." };
  }

  const requestedTrips = (input.trips || []).filter(
    (trip): trip is Trip => trip === "AM" || trip === "PM",
  );
  const trips: Trip[] = requestedTrips.length ? requestedTrips : [];
  if (!trips.length) {
    if (loaded.effective.am.waitingForAssignment || !loaded.effective.am.busNumber) {
      trips.push("AM");
    }
    if (loaded.effective.pm.waitingForAssignment || !loaded.effective.pm.busNumber) {
      trips.push("PM");
    }
  }
  if (!trips.length) trips.push("AM", "PM");
  const amPickup = (input.amPickupTime || "").trim();
  const pmPickup = (input.pmPickupTime || "").trim();
  if (user.role === "BUS_COMPANY") {
    if (trips.includes("AM") && !amPickup) {
      return { ok: false as const, error: "Type the AM pickup time." };
    }
    if (trips.includes("PM") && !pmPickup) {
      return { ok: false as const, error: "Type the PM pickup time." };
    }
  }
  await ensureStudentContactColumns().catch(() => undefined);
  const previous = planLine(loaded.effective, trips);

  let assignedLabel = "";
  if (vehicle === "van") {
    const van = await ensureVan(schoolId, rideName);
    assignedLabel = van.name;
    await prisma.$executeRaw`
      UPDATE "Student"
      SET "vehicleId" = ${van.id}, "updatedAt" = CURRENT_TIMESTAMP
      WHERE "id" = ${studentId}
    `;
    for (const trip of trips) {
      const current = trip === "AM" ? loaded.effective.am : loaded.effective.pm;
      await prisma.transportationAssignment.upsert({
        where: { studentId_trip: { studentId, trip } },
        create: {
          studentId,
          trip,
          type: "BUS",
          destination: current.destination || "HOME",
          waitingForAssignment: false,
          notes: `${van.name} assigned by ${user.name}.`,
          effectiveStart: new Date(),
          updatedById: user.id,
        },
        update: {
          waitingForAssignment: false,
          notes: `${van.name} assigned by ${user.name}.`,
          updatedById: user.id,
        },
      });
    }
  } else {
    const busNumber = rideName.replace(/^Bus\s+/i, "").trim();
    assignedLabel = `Bus ${busNumber}`;
    for (const trip of trips) {
      const busRouteId = await routeId(schoolId, busNumber, trip);
      const current = trip === "AM" ? loaded.effective.am : loaded.effective.pm;
      await prisma.transportationAssignment.upsert({
        where: { studentId_trip: { studentId, trip } },
        create: {
          studentId,
          trip,
          type: "BUS",
          destination: current.destination || "HOME",
          busRouteId,
          waitingForAssignment: false,
          notes: `Bus ${busNumber} assigned by ${user.name}.`,
          effectiveStart: new Date(),
          updatedById: user.id,
        },
        update: {
          type: "BUS",
          busRouteId,
          waitingForAssignment: false,
          notes: `Bus ${busNumber} assigned by ${user.name}.`,
          updatedById: user.id,
        },
      });
    }
  }

  for (const trip of trips) {
    const time = trip === "AM" ? amPickup : pmPickup;
    if (!time) continue;
    await prisma.$executeRaw`
      UPDATE "TransportationAssignment"
      SET "pickupTime" = ${time}
      WHERE "studentId" = ${studentId} AND "trip" = ${trip}
    `.catch(() => undefined);
  }

  await prisma.changeRequest.updateMany({
    where: {
      schoolId,
      status: { in: ["PENDING", "NEEDS_CLARIFICATION"] },
      OR: [{ id: request?.id || "" }, { studentId }],
    },
    data: {
      status: "COMPLETED",
      busNumber: assignedLabel,
      reviewedById: user.id,
      reviewedAt: new Date(),
    },
  });

  const after = await loadStudent(studentId);
  const student = after?.effective ?? loaded.effective;
  const busCompanyEmail = await defaultBusCompanyEmail(schoolId);
  scheduleChangeNotify(
    notifyTransportationChange({
      user,
      student,
      trips,
      previous,
      next:
        vehicle === "van"
          ? `${assignedLabel} · ${planLine(student, trips)}`
          : planLine(student, trips),
      when: vehicle === "van" ? "Assigned van" : "Assigned bus",
      note: [
        `Bus company assigned ${assignedLabel}.`,
        trips.includes("AM") && amPickup ? `AM pickup ${amPickup}.` : "",
        trips.includes("PM") && pmPickup ? `PM pickup ${pmPickup}.` : "",
      ]
        .filter(Boolean)
        .join(" "),
      waiting: false,
      amPickup: trips.includes("AM") ? amPickup : "",
      pmPickup: trips.includes("PM") ? pmPickup : "",
      parentSms: "assigned",
      teacherEmail: student.teacherEmail,
      busCompanyEmail,
      notifySchool: user.role === "BUS_COMPANY",
      schoolId,
    }),
  );

  revalidatePath("/waiting");
  revalidatePath("/dashboard");
  revalidatePath("/changes");
  revalidatePath("/buses");
  revalidatePath("/company");

  return {
    ok: true as const,
    assigned: assignedLabel,
    sent: [] as string[],
    skipped: [] as string[],
    parentEmail: student.parentEmail,
    parentPhone: student.parentPhone,
    parentPhone2: student.parentPhone2,
    teacherEmail: student.teacherEmail,
    busCompanyEmail,
    message: queuedNoticeMessage(
      false,
      `${assignedLabel} is now assigned to ${student.fullName}.`,
    ),
  };
}
