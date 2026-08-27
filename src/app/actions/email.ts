"use server";

import { getSession } from "@/lib/auth";
import { sendMail, smtpConfigured } from "@/lib/email";
import { loadStudents } from "@/lib/transportation";
import { companyReportText, pickupList, stamp } from "@/lib/reports";
import { sendTeacherClassroomLists } from "@/lib/teacher-snapshot";
import { writeAudit } from "@/lib/audit";

export async function emailTeacherLists() {
  const user = await getSession();
  if (!user || (user.role !== "COORDINATOR" && user.role !== "ADMINISTRATOR")) {
    return { ok: false, error: "Not authorized to email lists." };
  }

  const result = await sendTeacherClassroomLists({
    schoolId: user.schoolId,
    actorId: user.id,
    automatic: false,
  });
  if (!result.ok) {
    const students = await loadStudents(user.schoolId);
    const { groupByTeacher } = await import("@/lib/reports");
    return {
      ok: false,
      error: result.error,
      preview: groupByTeacher(students)
        .map(([name, rows]) => `${name}: ${rows.length} students`)
        .join("\n"),
    };
  }
  return { ok: true, sent: result.sent, skipped: result.skipped };
}

export async function emailCompanyReport() {
  const user = await getSession();
  if (!user || (user.role !== "COORDINATOR" && user.role !== "ADMINISTRATOR")) {
    return { ok: false, error: "Only an admin or bus coordinator can email the company." };
  }
  const to = process.env.BUS_COMPANY_EMAIL;
  if (!to) {
    return { ok: false, error: "Set BUS_COMPANY_EMAIL in .env first." };
  }
  const students = await loadStudents(user.schoolId);
  const text = companyReportText(students);
  const header = stamp();
  const result = await sendMail({
    to,
    subject: `Transportation change report — ${header.generated}`,
    text,
  });
  if (!result.sent) {
    return { ok: false, error: result.reason, preview: text };
  }
  await writeAudit({
    user,
    action: "EMAIL_COMPANY_REPORT",
    newPlan: { to },
  });
  return { ok: true };
}

export async function emailPickupList() {
  const user = await getSession();
  if (!user || (user.role !== "COORDINATOR" && user.role !== "ADMINISTRATOR")) {
    return { ok: false, error: "Not authorized." };
  }
  const students = pickupList(await loadStudents(user.schoolId));
  const header = stamp();
  const text = [
    "Parent-pickup list",
    header.generated,
    header.version,
    "",
    ...students.map((s) => `${s.fullName}  ${s.grade}  ${s.teacherName}  ${s.parentName}  ${s.parentPhone}`),
  ].join("\n");
  return {
    ok: smtpConfigured(),
    error: smtpConfigured() ? undefined : "Resend is not configured. Copy the list below.",
    preview: text,
  };
}
