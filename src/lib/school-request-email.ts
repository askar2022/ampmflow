import { sendMail, smtpConfigured } from "./email";
import { usableOpsEmail } from "./ops-change-emails";
import { PLATFORM_ADMIN_EMAIL } from "./platform";

function uniqueEmails(values: Array<string | null | undefined>) {
  return [...new Set(values.map((email) => usableOpsEmail(email || "")).filter(Boolean))];
}

export async function platformAdminEmails() {
  return uniqueEmails([PLATFORM_ADMIN_EMAIL, process.env.PLATFORM_ADMIN_EMAIL]);
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
    to: admins[0],
    replyTo: args.email,
    subject: `AMPM Flow contact — ${args.schoolName}`,
    text,
  });
  return { sent: sent.sent, recipients: sent.sent ? [admins[0]] : [] };
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

/** Welcome the new staff login and alert AMPM that an account was created. */
export async function emailStaffAccountCreated(args: {
  schoolName: string;
  name: string;
  email: string;
  roleLabel: string;
  temporaryPassword: string;
  loginUrl: string;
  addedByName: string;
  addedByEmail: string;
}) {
  if (!smtpConfigured()) {
    return { sent: false as const, reason: "email is not configured" };
  }

  const to = usableOpsEmail(args.email);
  const admins = await platformAdminEmails();
  const results: Array<{ to: string; sent: boolean }> = [];

  if (to) {
    const welcome = [
      `Hello ${args.name},`,
      "",
      `You were added to AMPM Flow for ${args.schoolName}.`,
      `Role: ${args.roleLabel}`,
      `Added by: ${args.addedByName} (${args.addedByEmail})`,
      "",
      `Sign in here (this school only): ${args.loginUrl}`,
      `Email: ${args.email}`,
      `Temporary password: ${args.temporaryPassword}`,
      "",
      "Change your password after you sign in if your school asks you to.",
      "If you did not expect this account, reply to this email or tell your school admin right away.",
    ].join("\n");
    const sent = await sendMail({
      to,
      subject: `Your AMPM Flow login for ${args.schoolName}`,
      text: welcome,
      html: `<!DOCTYPE html>
<html lang="en">
<body style="margin:0;padding:24px;background:#f4f6f8;font-family:Arial,Helvetica,sans-serif;color:#102a43;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;margin:0 auto;background:#ffffff;">
    <tr>
      <td style="padding:24px 20px;">
        <p style="margin:0 0 12px;font-size:16px;">Hello ${escapeHtml(args.name)},</p>
        <p style="margin:0 0 16px;font-size:15px;line-height:1.5;">
          You were added to AMPM Flow for <strong>${escapeHtml(args.schoolName)}</strong>.
        </p>
        <p style="margin:0 0 8px;font-size:14px;line-height:1.5;">
          Role: ${escapeHtml(args.roleLabel)}<br/>
          Added by: ${escapeHtml(args.addedByName)} (${escapeHtml(args.addedByEmail)})
        </p>
        <p style="margin:16px 0;">
          <a href="${escapeHtml(args.loginUrl)}" style="display:inline-block;background:#102a43;color:#ffffff;text-decoration:none;padding:12px 18px;border-radius:8px;font-weight:700;">
            Sign in to ${escapeHtml(args.schoolName)}
          </a>
        </p>
        <p style="margin:0 0 12px;font-size:14px;line-height:1.5;">
          Email: ${escapeHtml(args.email)}<br/>
          Temporary password: <strong>${escapeHtml(args.temporaryPassword)}</strong>
        </p>
        <p style="margin:0;font-size:13px;color:#5b6d7e;line-height:1.4;">
          If you did not expect this account, tell your school admin right away.
        </p>
      </td>
    </tr>
  </table>
</body>
</html>`,
    });
    results.push({ to, sent: sent.sent });
  }

  for (const admin of admins) {
    if (admin === to) continue;
    const security = [
      "AMPM Flow security notice — staff account created",
      "",
      `School: ${args.schoolName}`,
      `New staff: ${args.name} <${args.email}>`,
      `Role: ${args.roleLabel}`,
      `Added by: ${args.addedByName} <${args.addedByEmail}>`,
      `Sign-in link: ${args.loginUrl}`,
      "",
      "This is an audit email only. The temporary password was sent to the new staff email, not copied here.",
    ].join("\n");
    const sent = await sendMail({
      to: admin,
      subject: `Staff added · ${args.schoolName} · ${args.email}`,
      text: security,
    });
    results.push({ to: admin, sent: sent.sent });
  }

  return {
    sent: results.some((row) => row.sent),
    results,
  };
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
