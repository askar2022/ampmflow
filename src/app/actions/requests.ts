"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { notifyCoordinators, writeAudit } from "@/lib/audit";
import { updateTransportation } from "@/app/actions/transportation";
import type { Destination, TransportType, Trip } from "@/lib/types";

function callerLabel(caller: string) {
  if (caller === "PARENT_TO_COMPANY") return "Parent to bus company";
  if (caller === "COMPANY_TO_SCHOOL" || caller === "BUS_COMPANY") {
    return "Bus company to school";
  }
  return "Parent to school";
}

function requestTitle(
  caller: string,
  changeTo: string,
  fromBus?: string,
  toBus?: string,
  destination?: string,
  daycareName?: string,
  companyNeed?: string,
  homeAddress?: string,
) {
  const who = callerLabel(caller);
  if (companyNeed === "MOVE" || changeTo === "MOVE") {
    return homeAddress
      ? `${who}: moving / new address — ${homeAddress} (waiting for a route)`
      : `${who}: moving / new address (waiting for a route)`;
  }
  if (companyNeed === "DAYCARE" || changeTo === "PM_DAYCARE") {
    return daycareName
      ? `${who}: daycare change — ${daycareName} (waiting for a route)`
      : `${who}: daycare change (waiting for a route)`;
  }
  if (companyNeed === "PICKUP_TO_BUS") {
    return `${who}: parent pickup → bus (waiting for a route)`;
  }
  const dest =
    destination === "DAYCARE" ? " to daycare" : destination === "HOME" ? " home" : "";
  if (changeTo === "BUS_TO_BUS") {
    if (fromBus && toBus) return `${who}: bus ${fromBus} → bus ${toBus}${dest} today`;
    if (toBus) return `${who}: bus → bus ${toBus}${dest} today`;
    return `${who}: bus → bus today`;
  }
  const what =
    changeTo === "BUS"
      ? `parent pickup → bus${toBus ? ` ${toBus}` : ""}${dest} today`
      : "bus → parent pickup today";
  return `${who}: ${what}`;
}

function planType(changeTo: string): TransportType {
  return changeTo === "PARENT" ? "PARENT" : "BUS";
}

function requestSource(caller: string, role: string) {
  if (
    caller === "PARENT_TO_COMPANY" ||
    caller === "COMPANY_TO_SCHOOL" ||
    caller === "BUS_COMPANY"
  ) {
    return "BUS_COMPANY";
  }
  if (role === "FRONT_DESK") return "FRONT_DESK";
  if (role === "TEACHER") return "TEACHER";
  return "COORDINATOR";
}

async function applyTodayPlan(args: {
  studentId: string;
  trip: Trip;
  changeTo: TransportType;
  busNumber?: string;
  destination?: Destination;
  reason?: string;
}) {
  let busRouteId: string | undefined;
  if (args.changeTo === "BUS" && args.busNumber) {
    const route = await prisma.busRoute.findFirst({
      where: {
        number: args.busNumber.replace(/^Bus\s+/i, ""),
        trip: args.trip,
      },
    });
    busRouteId = route?.id;
  }

  return updateTransportation({
    studentId: args.studentId,
    trips: [args.trip],
    type: args.changeTo,
    destination: args.destination === "DAYCARE" ? "DAYCARE" : "HOME",
    duration: "TODAY",
    busRouteId,
    waitingForAssignment: args.changeTo === "BUS" && !busRouteId,
    reason: args.reason || requestTitle("PARENT_TO_SCHOOL", args.changeTo),
  });
}

async function upsertStudentDaycare(
  schoolId: string,
  studentId: string,
  name: string,
  addressLine?: string,
) {
  const daycareName = name.trim();
  if (!daycareName) return;
  let daycare = await prisma.daycare.findFirst({
    where: { schoolId, name: daycareName },
  });
  if (!daycare) {
    const address = await prisma.address.create({
      data: {
        schoolId,
        line1: addressLine?.trim() || "Address pending",
        city: "—",
        state: "—",
        zip: "—",
        label: "daycare",
      },
    });
    daycare = await prisma.daycare.create({
      data: {
        schoolId,
        name: daycareName,
        addressId: address.id,
      },
    });
  } else if (addressLine?.trim()) {
    await prisma.address.update({
      where: { id: daycare.addressId },
      data: { line1: addressLine.trim() },
    });
  }
  await prisma.student.update({
    where: { id: studentId },
    data: { daycareId: daycare.id },
  });
}

async function upsertStudentHomeAddress(
  schoolId: string,
  studentId: string,
  line1: string,
) {
  const addressLine = line1.trim();
  if (!addressLine) return;
  const address = await prisma.address.create({
    data: {
      schoolId,
      line1: addressLine,
      city: "—",
      state: "—",
      zip: "—",
      label: "home",
    },
  });
  await prisma.student.update({
    where: { id: studentId },
    data: { homeAddressId: address.id },
  });
}

async function applyCompanyReport(args: {
  studentId: string;
  companyNeed?: string;
  daycareName?: string;
  daycareAddress?: string;
  homeAddress?: string;
  busNumber?: string;
  reason?: string;
}) {
  const user = await getSession();
  if (!user) return;
  const need =
    args.companyNeed === "MOVE"
      ? "MOVE"
      : args.companyNeed === "PICKUP_TO_BUS"
        ? "PICKUP_TO_BUS"
        : "DAYCARE";
  if (need === "DAYCARE" && args.daycareName) {
    await upsertStudentDaycare(
      user.schoolId,
      args.studentId,
      args.daycareName,
      args.daycareAddress,
    );
  }
  if (need === "MOVE" && args.homeAddress) {
    await upsertStudentHomeAddress(
      user.schoolId,
      args.studentId,
      args.homeAddress,
    );
  }

  let busRouteId: string | undefined;
  if (args.busNumber) {
    const route = await prisma.busRoute.findFirst({
      where: {
        number: args.busNumber.replace(/^Bus\s+/i, ""),
        trip: "PM",
      },
    });
    busRouteId = route?.id;
  }

  return updateTransportation({
    studentId: args.studentId,
    trips: need === "MOVE" ? ["AM", "PM"] : ["PM"],
    type: "BUS",
    destination: need === "DAYCARE" ? "DAYCARE" : "HOME",
    duration: "PERMANENT",
    confirmPermanent: true,
    busRouteId,
    waitingForAssignment: !busRouteId,
    reason: args.reason || "Report to bus company — waiting for a route",
  });
}

export async function collapseDuplicateRequests(schoolId: string) {
  const pending = await prisma.changeRequest.findMany({
    where: { schoolId, status: "PENDING" },
    orderBy: { createdAt: "desc" },
    select: { id: true, studentId: true, title: true },
  });
  const seen = new Set<string>();
  const extraIds: string[] = [];
  for (const row of pending) {
    const key = `${row.studentId ?? ""}|${row.title}`;
    if (seen.has(key)) extraIds.push(row.id);
    else seen.add(key);
  }
  if (extraIds.length) {
    await prisma.changeRequest.updateMany({
      where: { id: { in: extraIds } },
      data: { status: "REJECTED" },
    });
  }
}

export async function createChangeRequest(
  formData: FormData,
): Promise<{ ok: boolean; error?: string }> {
  const user = await getSession();
  if (!user) return { ok: false, error: "Please sign in." };

  const kind = String(formData.get("kind") || "").trim();
  const caller = String(formData.get("caller") || "PARENT_TO_SCHOOL").trim();
  const changeTo = String(formData.get("changeTo") || "PARENT").trim();
  const details = String(formData.get("details") || "").trim();
  const studentId = String(formData.get("studentId") || "") || null;
  const trip = (String(formData.get("trip") || "PM") || "PM") as Trip;
  const fromBusNumber = String(formData.get("fromBusNumber") || "").trim();
  const busNumber = String(formData.get("busNumber") || "").trim();
  const destination = String(formData.get("destination") || "HOME").trim();
  const daycareName = String(formData.get("daycareName") || "").trim();
  const daycareAddress = String(formData.get("daycareAddress") || "").trim();
  const homeAddress = String(formData.get("homeAddress") || "").trim();
  const companyNeed = String(formData.get("companyNeed") || "").trim();
  const isTodayChange = kind === "TODAY_CHANGE";
  const isCompanyReport = kind === "COMPANY_REPORT" || kind === "PM_COMPANY";
  const title =
    String(formData.get("title") || "").trim() ||
    requestTitle(
      caller,
      changeTo,
      fromBusNumber,
      busNumber,
      destination,
      daycareName,
      companyNeed,
      homeAddress,
    );
  const source = requestSource(caller, user.role);

  if ((isTodayChange || isCompanyReport) && !studentId) {
    return { ok: false, error: "Click a student in the list first." };
  }

  if (studentId) {
    const recent = await prisma.changeRequest.findFirst({
      where: {
        schoolId: user.schoolId,
        studentId,
        title,
        status: "PENDING",
        createdAt: { gte: new Date(Date.now() - 15 * 60 * 1000) },
      },
      orderBy: { createdAt: "desc" },
    });
    if (recent) {
      return { ok: true };
    }
  }

  const request = await prisma.changeRequest.create({
    data: {
      schoolId: user.schoolId,
      studentId,
      trip,
      source,
      title,
      details,
      busNumber: busNumber || null,
      payload: JSON.stringify({
        kind: isTodayChange
          ? "TODAY_CHANGE"
          : isCompanyReport
            ? "COMPANY_REPORT"
            : "REQUEST",
        caller,
        changeTo: isTodayChange || isCompanyReport ? changeTo : null,
        companyNeed,
        fromBusNumber,
        busNumber,
        destination,
        daycareName,
        daycareAddress,
        homeAddress,
        trip: isCompanyReport ? "PM" : trip,
      }),
      status:
        isCompanyReport
          ? "PENDING"
          : user.role === "COORDINATOR" || user.role === "ADMINISTRATOR"
            ? "APPROVED"
            : "PENDING",
      createdById: user.id,
      reviewedById:
        user.role === "COORDINATOR" || user.role === "ADMINISTRATOR"
          ? user.id
          : null,
      reviewedAt:
        user.role === "COORDINATOR" || user.role === "ADMINISTRATOR"
          ? new Date()
          : null,
    },
  });

  await writeAudit({
    user,
    studentId,
    action: "CREATE_REQUEST",
    trip,
    newPlan: { title, details, source, status: request.status, caller, changeTo },
  });

  const staffCanApply =
    user.role === "COORDINATOR" || user.role === "ADMINISTRATOR";

  try {
    if (isTodayChange && staffCanApply && studentId) {
      await applyTodayPlan({
        studentId,
        trip,
        changeTo: planType(changeTo),
        busNumber,
        destination: destination === "DAYCARE" ? "DAYCARE" : "HOME",
        reason: details || title,
      });
    }

    if (isCompanyReport && staffCanApply && studentId) {
      await applyCompanyReport({
        studentId,
        companyNeed,
        daycareName,
        daycareAddress,
        homeAddress,
        reason: details || title,
      });
    }
  } catch {
    // The request is already saved. Do not block the staff member.
  }

  await notifyCoordinators(
    user.schoolId,
    source === "TEACHER"
      ? "Teacher concern"
      : isCompanyReport
        ? "Report to bus company"
        : "New transportation request",
    `${user.name}: ${title}`,
  );

  revalidatePath("/requests");
  revalidatePath("/changes");
  revalidatePath("/company");
  revalidatePath("/waiting");
  return { ok: true };
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

  if (nextStatus === "APPROVED" && existing.studentId) {
    let payload: {
      kind?: string;
      changeTo?: string | null;
      companyNeed?: string;
      busNumber?: string;
      destination?: string;
      daycareName?: string;
      daycareAddress?: string;
      homeAddress?: string;
      trip?: string;
    } = {};
    try {
      payload = JSON.parse(existing.payload || "{}") as {
        kind?: string;
        changeTo?: string | null;
        companyNeed?: string;
        busNumber?: string;
        destination?: string;
        daycareName?: string;
        daycareAddress?: string;
        homeAddress?: string;
        trip?: string;
      };
    } catch {
      payload = {};
    }
    if (payload.kind === "TODAY_CHANGE" && payload.changeTo) {
      await applyTodayPlan({
        studentId: existing.studentId,
        trip: (payload.trip || existing.trip || "PM") as Trip,
        changeTo: planType(payload.changeTo),
        busNumber: payload.busNumber || existing.busNumber || "",
        destination: payload.destination === "DAYCARE" ? "DAYCARE" : "HOME",
        reason: existing.title,
      });
    }
    if (payload.kind === "COMPANY_REPORT" || payload.kind === "PM_COMPANY") {
      await applyCompanyReport({
        studentId: existing.studentId,
        companyNeed: payload.companyNeed || payload.changeTo || "DAYCARE",
        daycareName: payload.daycareName,
        daycareAddress: payload.daycareAddress,
        homeAddress: payload.homeAddress,
        busNumber: payload.busNumber || existing.busNumber || "",
        reason: existing.title,
      });
    }
  }

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
  revalidatePath("/waiting");
  return { ok: true };
}

export async function assignBusFromCompany(formData: FormData): Promise<void> {
  const user = await getSession();
  if (
    !user ||
    (user.role !== "BUS_COMPANY" &&
      user.role !== "COORDINATOR" &&
      user.role !== "ADMINISTRATOR")
  ) {
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
  revalidatePath("/waiting");
}
