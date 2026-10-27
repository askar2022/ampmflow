import { sendMail, smtpConfigured } from "./email";
import { usableOpsEmail } from "./ops-change-emails";
import { PLATFORM_ADMIN_EMAIL } from "./platform";
import { prisma } from "./prisma";

function uniqueEmails(values: Array<string | null | undefined>) {
  return [...new Set(values.map((email) => usableOpsEmail(email || "")).filter(Boolean))];
}

export async function platformAdminEmails() {
  const first = await prisma.school.findFirst({
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  if (!first) {
    return uniqueEmails([PLATFORM_ADMIN_EMAIL, process.env.PLATFORM_ADMIN_EMAIL]);
  }
  const admins = await prisma.user.findMany({
    where: { schoolId: first.id, active: true, role: "ADMINISTRATOR" },
    select: { email: true },
  });
  return uniqueEmails([
    PLATFORM_ADMIN_EMAIL,
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

  const admins = await platformAdminEmails();
  if (!admins.length) {
    return { sent: false as const, reason: "no admin email" };
  }

  const text = [
    "Someone sent a message from the AMPM Flow contact form.",
    "Do not treat this as a school adding itself. Only you can add a school.",
    "",
    `School they mentioned: ${args.schoolName}`,
    `Name: ${args.name}`,
    `Their email: ${args.email}`,
    args.note ? `Note: ${args.note}` : "",
    "",
    "If you want this school on AMPM Flow, sign in on the landing page and add it.",
    "https://www.ampmflow.com/",
  ]
    .filter((line, index, lines) => line !== "" || lines[index - 1] !== "")
    .join("\n");
  const sent = await sendMail({
    to: admins,
    subject: `AMPM Flow contact — ${args.schoolName}`,
    text,
  });
  return { sent: sent.sent, recipients: sent.sent ? admins : [] };
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
