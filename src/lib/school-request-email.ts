import { sendMail, smtpConfigured } from "./email";
import { usableOpsEmail } from "./ops-change-emails";
import { prisma } from "./prisma";

function uniqueEmails(values: Array<string | null | undefined>) {
  return [...new Set(values.map((email) => usableOpsEmail(email || "")).filter(Boolean))];
}

export async function platformAdminEmails() {
  const first = await prisma.school.findFirst({
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  if (!first) return uniqueEmails([process.env.PLATFORM_ADMIN_EMAIL]);
  const admins = await prisma.user.findMany({
    where: { schoolId: first.id, active: true, role: "ADMINISTRATOR" },
    select: { email: true },
  });
  return uniqueEmails([
    process.env.PLATFORM_ADMIN_EMAIL,
    ...admins.map((admin) => admin.email),
  ]);
}

export async function emailNewSchoolRequest(args: {
  schoolName: string;
  name: string;
  email: string;
}) {
  if (!smtpConfigured()) {
    return { sent: false as const, reason: "email is not configured" };
  }

  const requester = usableOpsEmail(args.email);
  const admins = await platformAdminEmails();
  const results: string[] = [];

  if (requester) {
    const text = [
      "AMPM Flow received your school request.",
      "",
      `School: ${args.schoolName}`,
      `Requested by: ${args.name}`,
      "",
      "You cannot sign in yet. The AMPM Flow administrator must approve the school first.",
      "You will get another email when the school is ready.",
    ].join("\n");
    const sent = await sendMail({
      to: requester,
      subject: `AMPM Flow received ${args.schoolName}`,
      text,
    });
    if (sent.sent) results.push(requester);
  }

  if (admins.length) {
    const text = [
      "A school asked to join AMPM Flow.",
      "",
      `School: ${args.schoolName}`,
      `Name: ${args.name}`,
      `Email: ${args.email}`,
      "",
      "Open Users, approve them as Admin, then they can sign in for a demo.",
      "https://ampmflow.com/admin/users",
    ].join("\n");
    const sent = await sendMail({
      to: admins,
      subject: `New school request — ${args.schoolName}`,
      text,
    });
    if (sent.sent) results.push(...admins);
  }

  return { sent: results.length > 0, recipients: results };
}

export async function emailSchoolApproved(args: {
  schoolName: string;
  name: string;
  email: string;
}) {
  const to = usableOpsEmail(args.email);
  if (!to || !smtpConfigured()) return { sent: false as const };
  const text = [
    `Hello ${args.name},`,
    "",
    `${args.schoolName} is ready on AMPM Flow.`,
    "",
    "Sign in at https://ampmflow.com/login with the email and password you used when you requested the school.",
    "Use the student desk to search a child and save a bus change. Teacher, parent, and the bus company are emailed right away.",
  ].join("\n");
  return sendMail({
    to,
    subject: `${args.schoolName} is ready on AMPM Flow`,
    text,
  });
}
