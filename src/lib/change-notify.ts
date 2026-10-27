import { writeAudit } from "./audit";
import { sendMail, smtpConfigured } from "./email";
import { planSummary } from "./format";
import { loadSavedOpsEmails, usableOpsEmail } from "./ops-change-emails";
import { prisma } from "./prisma";
import { usableTeacherEmail } from "./teacher-snapshot";
import type { EffectiveStudent, SessionUser, Trip } from "./types";

export type ChangeNotice = {
  sent: string[];
  skipped: string[];
  waiting: boolean;
};

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function uniqueEmails(values: Array<string | null | undefined>) {
  return [...new Set(values.map((email) => usableOpsEmail(email || "")).filter(Boolean))];
}

export function changeNoticeText(args: {
  student: EffectiveStudent;
  trips: Trip[];
  previous: string;
  next: string;
  when: string;
  note: string;
  actorName: string;
  waiting: boolean;
}) {
  const trips = args.trips.join(" and ");
  return [
    "AMPM Flow — transportation change",
    "",
    `Student: ${args.student.fullName} (${args.student.studentId})`,
    `Grade ${args.student.grade} · ${args.student.teacherName}`,
    `Trip: ${trips}`,
    `Was: ${args.previous}`,
    `Now: ${args.next}`,
    `When: ${args.when}`,
    args.waiting ? "Status: Waiting for a bus route until the company confirms it." : "",
    args.note ? `Note: ${args.note}` : "",
    `Entered by: ${args.actorName}`,
    "",
    "The dismissal roster is updated. Same-day changes also go out again in the 2:30 p.m. reminder.",
  ]
    .filter((line) => line !== "")
    .join("\n");
}

function changeNoticeHtml(text: string) {
  return `<!DOCTYPE html>
<html>
<body style="margin:0;background:#f4f1ea;font-family:Georgia,serif;color:#0e2438;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:24px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border:1px solid #e6e0d4;">
          <tr>
            <td style="background:#0e2438;color:#ffffff;padding:16px 20px;">
              <div style="font-size:18px;font-weight:700;">AMPM Flow</div>
              <div style="font-size:12px;letter-spacing:0.1em;text-transform:uppercase;color:#c9d6c4;">Transportation change</div>
            </td>
          </tr>
          <tr>
            <td style="padding:20px;font-size:15px;line-height:1.5;white-space:pre-wrap;">${escapeHtml(text)}</td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

async function teacherEmails(classroomId: string, extra?: string) {
  const teachers = await prisma.teacher.findMany({
    where: { classroomId },
    select: { email: true },
  });
  return uniqueEmails([
    extra,
    ...teachers.map((teacher) => usableTeacherEmail(teacher.email)),
  ]);
}

async function opsEmails(schoolId: string, already: string[]) {
  const [saved, users] = await Promise.all([
    loadSavedOpsEmails(schoolId),
    prisma.user.findMany({
      where: {
        schoolId,
        active: true,
        role: { in: ["BUS_COMPANY", "COORDINATOR", "ADMINISTRATOR"] },
      },
      select: { email: true },
    }),
  ]);
  const used = new Set(already);
  return uniqueEmails([
    ...saved,
    process.env.BUS_COMPANY_EMAIL,
    ...users.map((user) => user.email),
  ]).filter((email) => !used.has(email));
}

export async function notifyTransportationChange(args: {
  user: SessionUser;
  student: EffectiveStudent;
  trips: Trip[];
  previous: string;
  next: string;
  when: string;
  note: string;
  waiting: boolean;
  teacherEmail?: string;
  busCompanyEmail?: string;
}): Promise<ChangeNotice> {
  const sent: string[] = [];
  const skipped: string[] = [];
  const text = changeNoticeText({
    student: args.student,
    trips: args.trips,
    previous: args.previous,
    next: args.next,
    when: args.when,
    note: args.note,
    actorName: args.user.name,
    waiting: args.waiting,
  });
  const html = changeNoticeHtml(text);
  const subject = `Transportation change — ${args.student.fullName}`;

  const teachers = await teacherEmails(
    args.student.classroomId,
    args.teacherEmail,
  );
  const parent = uniqueEmails([args.student.parentEmail]);
  const company = uniqueEmails([args.busCompanyEmail]);
  const ops = await opsEmails(args.user.schoolId, [
    ...parent,
    ...teachers,
    ...company,
  ]);

  if (!parent.length) skipped.push("parent (required)");
  if (!teachers.length) skipped.push("teacher (required)");
  if (!company.length) skipped.push("bus company (required)");

  if (!smtpConfigured()) {
    return {
      sent,
      skipped: [...skipped, "email is not configured"],
      waiting: args.waiting,
    };
  }

  const groups = [
    { label: "parent", to: parent },
    { label: "teacher", to: teachers },
    { label: "bus company", to: company },
    { label: "leadership", to: ops },
  ];

  for (const group of groups) {
    if (!group.to.length) continue;
    const result = await sendMail({
      to: group.to,
      subject,
      text,
      html,
    });
    if (result.sent) {
      sent.push(...group.to.map((email) => `${group.label}: ${email}`));
    } else {
      skipped.push(`${group.label} (${result.reason})`);
    }
  }

  await writeAudit({
    user: args.user,
    studentId: args.student.id,
    action: "EMAIL_CHANGE_NOW",
    trip: args.trips.join("+"),
    newPlan: {
      sent,
      skipped,
      next: args.next,
      when: args.when,
    },
  }).catch(() => undefined);

  return { sent, skipped, waiting: args.waiting };
}

export async function notifyRouteRequest(args: {
  user: SessionUser;
  studentName: string;
  studentId?: string;
  grade: string;
  teacherName: string;
  parentPhone: string;
  parentEmail: string;
  busCompanyEmail: string;
  address: string;
  emergency: string;
}): Promise<ChangeNotice> {
  const sent: string[] = [];
  const skipped: string[] = [];
  const details = [
    `Student: ${args.studentName}${args.studentId ? ` (${args.studentId})` : ""}`,
    args.grade ? `Grade ${args.grade}` : "",
    args.teacherName ? `Teacher: ${args.teacherName}` : "",
    `Parent phone: ${args.parentPhone || "—"}`,
    `Parent email: ${args.parentEmail || "—"}`,
    `Address: ${args.address || "—"}`,
    args.emergency ? `Emergency contact: ${args.emergency}` : "",
    `Requested by: ${args.user.name}`,
  ].filter(Boolean);

  const companyText = [
    "AMPM Flow — request for route",
    "",
    "Please assign a bus or van for this student, then email or call the school with the number.",
    "Front Desk will update the student after you confirm.",
    "",
    ...details,
  ].join("\n");

  const parentText = [
    "AMPM Flow",
    "",
    `We requested a bus or van for ${args.studentName}.`,
    "The bus company will assign a route and the school will update you when the number is on file.",
    "",
    ...details,
  ].join("\n");

  const parent = uniqueEmails([args.parentEmail]);
  const company = uniqueEmails([args.busCompanyEmail]);
  if (!parent.length) skipped.push("parent (email required)");
  if (!company.length) skipped.push("bus company (email required)");
  if (!smtpConfigured()) {
    return { sent, skipped: [...skipped, "email is not configured"], waiting: true };
  }

  const groups = [
    {
      label: "parent",
      to: parent,
      subject: `Bus request for ${args.studentName}`,
      text: parentText,
    },
    {
      label: "bus company",
      to: company,
      subject: `Request for route — ${args.studentName}`,
      text: companyText,
    },
  ];

  for (const group of groups) {
    if (!group.to.length) continue;
    const result = await sendMail({
      to: group.to,
      subject: group.subject,
      text: group.text,
      html: changeNoticeHtml(group.text),
    });
    if (result.sent) {
      sent.push(...group.to.map((email) => `${group.label}: ${email}`));
    } else {
      skipped.push(`${group.label} (${result.reason})`);
    }
  }

  await writeAudit({
    user: args.user,
    studentId: args.studentId,
    action: "EMAIL_ROUTE_REQUEST",
    newPlan: { sent, skipped },
  }).catch(() => undefined);
  return { sent, skipped, waiting: true };
}

export function noticeSummary(notice: ChangeNotice) {
  const parts = [];
  if (notice.waiting) {
    parts.push("Marked Waiting for Route until the bus company confirms it.");
  }
  if (notice.sent.length) {
    parts.push(`Emailed ${notice.sent.join(", ")}.`);
  }
  if (notice.skipped.length) {
    parts.push(`Could not email ${notice.skipped.join(", ")}.`);
  }
  parts.push("Same-day changes also go out again in the 2:30 p.m. reminder.");
  return parts.join(" ");
}

export function planLine(student: EffectiveStudent, trips: Trip[]) {
  return trips
    .map((trip) => {
      const plan = trip === "AM" ? student.am : student.pm;
      return `${trip}: ${planSummary(plan, trip)}`;
    })
    .join(" · ");
}
