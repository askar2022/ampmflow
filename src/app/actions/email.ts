"use server";

import { getSession } from "@/lib/auth";
import { sendMail, smtpConfigured } from "@/lib/email";
import { loadStudents } from "@/lib/transportation";
import {
  companyReportText,
  groupByTeacher,
  pickupList,
  stamp,
} from "@/lib/reports";
import { planSummary } from "@/lib/format";
import { writeAudit } from "@/lib/audit";

export async function emailTeacherLists() {
  const user = await getSession();
  if (!user || (user.role !== "COORDINATOR" && user.role !== "ADMINISTRATOR")) {
    return { ok: false, error: "Not authorized to email lists." };
  }

  const students = await loadStudents(user.schoolId);
  const groups = groupByTeacher(students);
  const header = stamp();
  const teachers = await import("@/lib/prisma").then(({ prisma }) =>
    prisma.teacher.findMany({ where: { schoolId: user.schoolId } }),
  );

  if (!smtpConfigured()) {
    return {
      ok: false,
      error:
        "Email is not configured yet. Use Print to download lists, or add SMTP settings in .env.",
      preview: groups
        .map(([name, rows]) => `${name}: ${rows.length} students`)
        .join("\n"),
    };
  }

  let sent = 0;
  for (const [name, rows] of groups) {
    const teacherName = name.split(" · ")[0];
    const teacher = teachers.find((t) => t.name === teacherName);
    if (!teacher?.email) continue;
    const body = [
      "AMPM Flow",
      `Classroom dismissal list — ${name}`,
      header.generated,
      header.version,
      "",
      ...rows.map(
        (s) =>
          `${s.fullName.padEnd(24)}  ${planSummary(s.pm, "PM").padEnd(28)}  ${s.pm.location}`,
      ),
    ].join("\n");
    await sendMail({
      to: teacher.email,
      subject: `Dismissal list — ${name} — ${header.generated}`,
      text: body,
    });
    sent += 1;
  }

  await writeAudit({
    user,
    action: "EMAIL_TEACHER_LISTS",
    newPlan: { sent },
  });

  return { ok: true, sent };
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
    error: smtpConfigured() ? undefined : "SMTP is not configured. Copy the list below.",
    preview: text,
  };
}
