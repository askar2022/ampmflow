"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { writeAudit } from "@/lib/audit";
import { loadStudent, resolveTrip } from "@/lib/transportation";
import { usablePhone } from "@/lib/gate";
import { decodePlanChoice } from "@/lib/plans";
import type { Destination, SessionUser, TransportType, Trip } from "@/lib/types";

async function requirePlanner() {
  const user = await getSession();
  if (!user || (user.role !== "COORDINATOR" && user.role !== "ADMINISTRATOR")) {
    return { user: null, error: "Only an admin or bus coordinator can set regular AM and PM plans." };
  }
  return { user, error: null };
}

export async function listBusNumbers(schoolId: string) {
  const routes = await prisma.busRoute.findMany({
    where: { schoolId },
    select: { number: true, trip: true, id: true },
  });
  const numbers = [...new Set(routes.map((row) => row.number))].sort(
    (a, b) => Number(a) - Number(b) || a.localeCompare(b),
  );
  return { routes, numbers };
}

export async function ensureStarterBuses() {
  const { user, error } = await requirePlanner();
  if (!user || error) return { ok: false as const, error: error || "Unauthorized" };

  const existing = await prisma.busRoute.count({ where: { schoolId: user.schoolId } });
  if (existing > 0) {
    const listed = await listBusNumbers(user.schoolId);
    return { ok: true as const, numbers: listed.numbers, created: 0 };
  }

  for (const number of ["1", "2", "3", "4", "5", "6"]) {
    for (const trip of ["AM", "PM"] as const) {
      await prisma.busRoute.upsert({
        where: {
          schoolId_number_trip: { schoolId: user.schoolId, number, trip },
        },
        create: {
          schoolId: user.schoolId,
          number,
          trip,
          name: `Route ${number}`,
        },
        update: {},
      });
    }
  }
  return { ok: true as const, numbers: ["1", "2", "3", "4", "5", "6"], created: 12 };
}

export async function addSchoolBus(numberRaw: string) {
  const { user, error } = await requirePlanner();
  if (!user || error) return { ok: false as const, error: error || "Unauthorized" };
  const number = numberRaw.replace(/^Bus\s+/i, "").trim();
  if (!number) return { ok: false as const, error: "Enter a bus number." };

  for (const trip of ["AM", "PM"] as const) {
    await prisma.busRoute.upsert({
      where: {
        schoolId_number_trip: { schoolId: user.schoolId, number, trip },
      },
      create: {
        schoolId: user.schoolId,
        number,
        trip,
        name: `Route ${number}`,
      },
      update: {},
    });
  }
  revalidatePath("/plans");
  revalidatePath("/buses");
  const listed = await listBusNumbers(user.schoolId);
  return { ok: true as const, numbers: listed.numbers };
}

async function ensureRoute(schoolId: string, number: string, trip: Trip) {
  return prisma.busRoute.upsert({
    where: { schoolId_number_trip: { schoolId, number, trip } },
    create: {
      schoolId,
      number,
      trip,
      name: `Route ${number}`,
    },
    update: {},
  });
}

async function ensureDaycare(schoolId: string, studentId: string, currentDaycareId: string | null) {
  if (currentDaycareId) return currentDaycareId;
  let daycare = await prisma.daycare.findFirst({
    where: { schoolId, name: "Daycare" },
    select: { id: true },
  });
  if (!daycare) {
    const address = await prisma.address.create({
      data: {
        schoolId,
        line1: "Daycare address pending",
        city: "Minneapolis",
        state: "MN",
        zip: "",
        label: "daycare",
      },
    });
    daycare = await prisma.daycare.create({
      data: { schoolId, name: "Daycare", addressId: address.id },
      select: { id: true },
    });
  }
  await prisma.student.update({
    where: { id: studentId },
    data: { daycareId: daycare.id },
  });
  return daycare.id;
}

async function writeTripPlan(args: {
  user: SessionUser;
  studentId: string;
  trip: Trip;
  value: string;
}) {
  const loaded = await loadStudent(args.studentId);
  if (!loaded || loaded.record.schoolId !== args.user.schoolId) {
    return { ok: false as const, error: "Student not found." };
  }

  const choice = decodePlanChoice(args.value);
  const oldPlan = resolveTrip(loaded.record, args.trip);
  if (choice.kind === "unset") {
    await prisma.transportationAssignment.deleteMany({
      where: { studentId: args.studentId, trip: args.trip },
    });
    await writeAudit({
      user: args.user,
      studentId: args.studentId,
      action: "UPDATE_PERMANENT",
      trip: args.trip,
      durationType: "PERMANENT",
      oldPlan,
      newPlan: { trip: args.trip, type: null },
    });
    return { ok: true as const };
  }

  let type: TransportType = "PARENT";
  let destination: Destination = "HOME";
  let busRouteId: string | null = null;
  let daycareId: string | null = null;

  if (choice.kind === "parent") {
    type = "PARENT";
    destination = "HOME";
  } else {
    type = "BUS";
    destination = choice.kind === "bus-daycare" ? "DAYCARE" : "HOME";
    if (!choice.bus) {
      return { ok: false as const, error: "Choose a bus number." };
    }
    const route = await ensureRoute(args.user.schoolId, choice.bus, args.trip);
    busRouteId = route.id;
    if (destination === "DAYCARE") {
      daycareId = await ensureDaycare(
        args.user.schoolId,
        args.studentId,
        loaded.record.daycareId,
      );
    }
  }

  await prisma.transportationAssignment.upsert({
    where: { studentId_trip: { studentId: args.studentId, trip: args.trip } },
    create: {
      studentId: args.studentId,
      trip: args.trip,
      type,
      destination,
      busRouteId,
      daycareId,
      waitingForAssignment: false,
      notes: "",
      updatedById: args.user.id,
    },
    update: {
      type,
      destination,
      busRouteId,
      daycareId,
      waitingForAssignment: false,
      notes: "",
      updatedById: args.user.id,
    },
  });

  const refreshed = await loadStudent(args.studentId);
  await writeAudit({
    user: args.user,
    studentId: args.studentId,
    action: "UPDATE_PERMANENT",
    trip: args.trip,
    durationType: "PERMANENT",
    oldPlan,
    newPlan: refreshed ? resolveTrip(refreshed.record, args.trip) : null,
  });
  return { ok: true as const };
}

export async function setRegularPlan(input: {
  studentId: string;
  trip: Trip;
  value: string;
  applyFamily?: boolean;
}) {
  const { user, error } = await requirePlanner();
  if (!user || error) return { ok: false as const, error: error || "Unauthorized" };

  const loaded = await loadStudent(input.studentId);
  if (!loaded) return { ok: false as const, error: "Student not found." };

  const ids = [input.studentId];
  if (input.applyFamily) {
    const phone = usablePhone(loaded.effective.parentPhone);
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

  for (const studentId of ids) {
    const result = await writeTripPlan({
      user,
      studentId,
      trip: input.trip,
      value: input.value,
    });
    if (!result.ok) return result;
  }

  revalidatePath("/plans");
  revalidatePath("/students");
  revalidatePath("/buses");
  revalidatePath("/pickup");
  revalidatePath("/waiting");
  revalidatePath("/dashboard");
  return { ok: true as const, count: ids.length };
}
