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
  note?: string;
}) {
  if (!smtpConfigured()) {
    return { sent: false as const, reason: "email is not configured" };
  }

  const requester = usableOpsEmail(args.email);
  const admins = await platformAdminEmails();
  const results: string[] = [];

  if (requester) {
    const text = [
      "AMPM Flow received your message.",
      "",
      `School: ${args.schoolName}`,
      `Requested by: ${args.name}`,
      "",
      "This did not open a school or an account.",
      "The AMPM Flow administrator will review it and set the school up.",
      "You will get a private sign-in link when it is ready.",
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
      "A school asked to start AMPM Flow. Do not activate it until you review and set it up.",
      "",
      `School: ${args.schoolName}`,
      `Name: ${args.name}`,
      `Email: ${args.email}`,
      args.note ? `Note: ${args.note}` : "",
      "",
      "Open Users, then Set up a school. That creates the private sign-in link and emails them.",
      "https://www.ampmflow.com/admin/users",
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
  loginUrl?: string;
}) {
  const to = usableOpsEmail(args.email);
  if (!to || !smtpConfigured()) return { sent: false as const };
  const signIn = args.loginUrl || "https://www.ampmflow.com/login";
  const text = [
    `Hello ${args.name},`,
    "",
    `${args.schoolName} is ready on AMPM Flow.`,
    "",
    `Use this private sign-in link for your school only: ${signIn}`,
    "Ask your school administrator if other staff need an account.",
  ].join("\n");
  return sendMail({
    to,
    subject: `${args.schoolName} is ready on AMPM Flow`,
    text,
  });
}
