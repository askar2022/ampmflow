"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth";
import { sendMail } from "@/lib/email";
import { formatLongDate, formatTime, schoolNow, todayKey } from "@/lib/dates";
import {
  leadershipDashboardHtml,
  leadershipDashboardSubject,
  leadershipDashboardText,
  leadershipDashboardUrl,
} from "@/lib/first-day-email";
import { getSchoolIdentityById } from "@/lib/school";
import {
  AM_LABEL,
  PM_LABEL,
  activeDismissalStudents,
  applyFamilyStatuses,
  assignStudentVehicle,
  assignTempVehicleToFamilies,
  busTomorrowFamilies,
  gateCounts,
  lastUpdatedStamp,
  loadGateRoster,
  saveVehicle,
  searchGateStudents,
  setGradeConfirm,
  upsertGateStatus,
  type AmArrival,
  type AmFollowUp,
  type GradeConfirm,
  type PmDismissal,
} from "@/lib/gate";
import { writeAudit } from "@/lib/audit";
import { loadSavedOpsEmails, usableOpsEmail } from "@/lib/ops-change-emails";
import { prisma } from "@/lib/prisma";
import type { SessionUser } from "@/lib/types";

function canUseGate(role: string) {
  return (
    role === "ADMINISTRATOR" ||
    role === "COORDINATOR" ||
    role === "FRONT_DESK"
  );
}

function canLead(role: string) {
  return role === "ADMINISTRATOR" || role === "COORDINATOR";
}

async function requireGateUser() {
  const user = await getSession();
  if (!user || !canUseGate(user.role)) {
    return { user: null, error: "Reception, coordinators, or admin can use The Gate." };
  }
  return { user, error: null };
}

function refreshGate() {
  revalidatePath("/gate");
  revalidatePath("/dismissal-grade");
  revalidatePath("/bus-tomorrow");
  revalidatePath("/first-day");
  revalidatePath("/vehicles");
}

export async function updateGateField(input: {
  studentId: string;
  field: "amArrival" | "amFollowUp" | "pmDismissal" | "transportNotes";
  value: string;
  expected?: string | null;
  confirmedIdentity?: boolean;
  warnPickupToBus?: boolean;
}) {
  const { user, error } = await requireGateUser();
  if (!user) return { ok: false as const, error };

  if (
    input.field === "pmDismissal" &&
    (input.expected === "PARENT_PICKUP_CONFIRMED" ||
      input.expected === "PARENT_PICKUP_TODAY_BUS_TOMORROW") &&
    input.value === "CONFIRMED_BUS" &&
    !input.warnPickupToBus
  ) {
    return {
      ok: false as const,
      needsBusWarning: true,
      error:
        "This student is marked for parent pickup. Confirm they should ride a bus today before changing to Confirmed Bus.",
    };
  }

  const result = await upsertGateStatus({
    user,
    studentId: input.studentId,
    field: input.field,
    value: input.value,
    expected: input.expected,
    confirmedIdentity: input.confirmedIdentity,
  });
  refreshGate();
  return result;
}

export async function applyFamilyGate(input: {
  studentId: string;
  amArrival?: AmArrival;
  pmDismissal?: PmDismissal;
  amFollowUp?: AmFollowUp;
  transportNotes?: string;
  confirmed: boolean;
}) {
  const { user, error } = await requireGateUser();
  if (!user) return { ok: false as const, error };
  const result = await applyFamilyStatuses({ user, ...input });
  refreshGate();
  return result;
}

export async function updateGradeConfirmAction(grade: string, status: GradeConfirm) {
  const { user, error } = await requireGateUser();
  if (!user) return { ok: false as const, error };
  const result = await setGradeConfirm({ user, grade, status });
  refreshGate();
  return result;
}

export async function saveVehicleAction(formData: FormData) {
  const user = await getSession();
  if (!user || !canLead(user.role)) {
    return { ok: false as const, error: "Only admin or a coordinator can edit vehicles." };
  }
  const result = await saveVehicle({
    user,
    id: String(formData.get("id") || "") || undefined,
    name: String(formData.get("name") || ""),
    vehicleType: String(formData.get("vehicleType") || "BUS"),
    driverName: String(formData.get("driverName") || ""),
    driverPhone: String(formData.get("driverPhone") || ""),
  });
  refreshGate();
  return result;
}

export async function assignStudentVehicleAction(studentId: string, vehicleId: string) {
  const user = await getSession();
  if (!user || !canLead(user.role)) {
    return { ok: false as const, error: "Only admin or a coordinator can assign vehicles." };
  }
  const result = await assignStudentVehicle({
    user,
    studentId,
    vehicleId: vehicleId === "" || vehicleId === "NOT_ASSIGNED" ? null : vehicleId,
  });
  refreshGate();
  return result;
}

export async function assignTempVehiclesAction(familyIds: string[], vehicleName: string) {
  const { user, error } = await requireGateUser();
  if (!user) return { ok: false as const, error };
  const result = await assignTempVehicleToFamilies({
    user,
    familyIds,
    vehicleName,
  });
  refreshGate();
  return result;
}

export async function emailGradeTeacherAction(grade: string, to?: string) {
  const { user, error } = await requireGateUser();
  if (!user) return { ok: false as const, error };

  const date = todayKey();
  const roster = await loadGateRoster(user.schoolId, date);
  const gradeStudents = roster.filter((s) => s.grade === grade);
  const active = activeDismissalStudents(gradeStudents);

  let emails = [usableOpsEmail(to || "")].filter(Boolean);
  if (!emails.length) {
    const teachers = await prisma.teacher.findMany({
      where: {
        schoolId: user.schoolId,
        classroom: { grade },
      },
      select: { email: true, name: true },
    });
    emails = [
      ...new Set(
        teachers
          .map((t) => usableOpsEmail(t.email))
          .filter(Boolean),
      ),
    ];
  }
  if (!emails.length) {
    return {
      ok: false as const,
      error: `No usable teacher email is saved for ${grade}. Open Teachers and add a real email, or type one below.`,
    };
  }

  const groups: Array<[string, typeof active]> = [
    ["Parent Pickup—Confirmed", active.filter((s) => s.pmDismissal === "PARENT_PICKUP_CONFIRMED")],
    [
      "Parent Pickup Today Only—Bus Needed Tomorrow",
      active.filter((s) => s.pmDismissal === "PARENT_PICKUP_TODAY_BUS_TOMORROW"),
    ],
    ["Confirmed Bus", active.filter((s) => s.pmDismissal === "CONFIRMED_BUS")],
    ["Not Confirmed — needs follow-up", active.filter((s) => s.pmDismissal === "NOT_CONFIRMED")],
  ];

  const lines = [
    `AMPM Flow — Dismissal by Grade/Class`,
    `${grade} only`,
    formatLongDate(),
    `Last updated: ${lastUpdatedStamp(gradeStudents)}`,
    "",
    `This email contains only ${grade}. It is not the school list.`,
    "",
    ...groups.flatMap(([title, rows]) => [
      `${title} (${rows.length})`,
      ...rows.map(
        (s) =>
          `  ${s.fullName} · ${s.teacherName} · AM ${AM_LABEL[s.amArrival]} · PM ${PM_LABEL[s.pmDismissal]}`,
      ),
      "",
    ]),
  ];

  const sent = await sendMail({
    to: emails,
    subject: `${grade} dismissal list — ${formatLongDate()}`,
    text: lines.join("\n"),
  });
  if (!sent.sent) return { ok: false as const, error: sent.reason };
  return { ok: true as const, to: emails };
}

type LeadershipSend =
  | { ok: true; to: string[]; alreadySent?: boolean }
  | { ok: false; error: string };

const leadershipSendInFlight = new Map<string, Promise<LeadershipSend>>();

function parseAuditEmails(raw: string | null | undefined) {
  try {
    const payload = JSON.parse(raw || "{}") as { to?: string[] };
    return Array.isArray(payload.to) ? payload.to.filter(Boolean) : [];
  } catch {
    return [];
  }
}

async function recentLeadershipSend(schoolId: string) {
  const since = new Date(Date.now() - 45_000);
  return prisma.auditLog.findFirst({
    where: {
      schoolId,
      action: "EMAIL_LEADERSHIP_DASHBOARD",
      createdAt: { gte: since },
    },
    orderBy: { createdAt: "desc" },
  });
}

async function sendLeadershipDashboard(user: SessionUser, extraTo?: string) {
  const recent = await recentLeadershipSend(user.schoolId);
  if (recent) {
    return {
      ok: true as const,
      to: parseAuditEmails(recent.newPlan),
      alreadySent: true,
    };
  }

  const roster = await loadGateRoster(user.schoolId);
  const counts = gateCounts(roster);
  const school = await getSchoolIdentityById(user.schoolId);
  const extra = usableOpsEmail(extraTo || "");
  const saved = await loadSavedOpsEmails(user.schoolId);
  const emails = [...new Set([extra, ...saved].filter(Boolean))];
  if (!emails.length) {
    return {
      ok: false as const,
      error:
        "Add leadership emails on Today’s Changes → Daily change emails, or type an address first.",
    };
  }

  const stamp = lastUpdatedStamp(roster);
  const updatedTime = stamp.includes(" · ")
    ? stamp.split(" · ")[1]
    : formatTime(schoolNow());
  const report = {
    schoolName: school?.name || "Sankofa Prep",
    dateLabel: formatLongDate(),
    updatedTime,
    counts,
    dashboardUrl: leadershipDashboardUrl(),
  };

  await writeAudit({
    user,
    action: "EMAIL_LEADERSHIP_DASHBOARD",
    newPlan: { to: emails, subject: leadershipDashboardSubject(counts, report.schoolName) },
  });

  const sent = await sendMail({
    to: emails,
    subject: leadershipDashboardSubject(counts, report.schoolName),
    text: leadershipDashboardText(report),
    html: leadershipDashboardHtml(report),
  });
  if (!sent.sent) return { ok: false as const, error: sent.reason };
  return { ok: true as const, to: emails };
}

export async function emailLeadershipAction(to?: string) {
  const user = await getSession();
  if (!user || !canLead(user.role)) {
    return { ok: false as const, error: "Only admin or a coordinator can email leadership." };
  }

  const key = user.schoolId;
  const existing = leadershipSendInFlight.get(key);
  if (existing) return existing;

  const work = sendLeadershipDashboard(user, to).finally(() => {
    setTimeout(() => leadershipSendInFlight.delete(key), 8_000);
  });
  leadershipSendInFlight.set(key, work);
  return work;
}

export async function emailBusTomorrowAction(familyIds: string[], to?: string) {
  const { user, error } = await requireGateUser();
  if (!user) return { ok: false as const, error };
  const email = usableOpsEmail(to || "");
  if (!email) {
    return { ok: false as const, error: "Type a real email address for this driver report." };
  }
  const roster = await loadGateRoster(user.schoolId);
  const wanted = new Set(familyIds);
  const families = busTomorrowFamilies(roster).filter((f) =>
    wanted.has(f.familyId),
  );
  if (!families.length) {
    return { ok: false as const, error: "Select at least one family first." };
  }
  const students = families.flatMap((f) => f.students);
  const text = [
    "AMPM Flow — Bus Needed Tomorrow (selected families only)",
    formatLongDate(),
    `Families: ${families.length}`,
    `Students: ${students.length}`,
    "",
    ...families.map((family) =>
      [
        `${family.familyKey} · ${family.parentName} · ${family.parentPhone}`,
        `${family.address}, ${family.city} ${family.zip}`,
        `Temporary vehicle: ${family.students[0]?.tempVehicleName || "Not assigned"}`,
        family.students
          .map((s) => `  ${s.fullName} (${s.grade})`)
          .join("\n"),
        family.students[0]?.transportNotes
          ? `Notes: ${family.students[0].transportNotes}`
          : "",
      ]
        .filter(Boolean)
        .join("\n"),
    ),
  ].join("\n\n");

  const sent = await sendMail({
    to: email,
    subject: `Bus needed tomorrow — ${families.length} families`,
    text,
  });
  if (!sent.sent) return { ok: false as const, error: sent.reason };
  return { ok: true as const, to: [email] };
}

export async function searchGateAction(query: string) {
  const { user, error } = await requireGateUser();
  if (!user) return { ok: false as const, error, students: [] };
  const roster = await loadGateRoster(user.schoolId);
  return {
    ok: true as const,
    students: searchGateStudents(roster, query),
    stamp: lastUpdatedStamp(roster),
  };
}
