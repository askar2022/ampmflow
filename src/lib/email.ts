import { Resend } from "resend";

export function emailConfigured() {
  return Boolean(process.env.RESEND_API_KEY);
}

export const smtpConfigured = emailConfigured;

function fromAddress() {
  return (
    process.env.RESEND_FROM ||
    process.env.RESEND_FROM_EMAIL ||
    process.env.EMAIL_FROM ||
    "AMPM Flow <dismissal@ampmflow.com>"
  );
}

export async function sendMail(args: {
  to: string | string[];
  subject: string;
  text: string;
  html?: string;
}) {
  if (!emailConfigured()) {
    return {
      sent: false as const,
      reason: "Resend is not configured. Add RESEND_API_KEY on Vercel.",
    };
  }

  const resend = new Resend(process.env.RESEND_API_KEY);
  const { error } = await resend.emails.send({
    from: fromAddress(),
    to: args.to,
    subject: args.subject,
    text: args.text,
    html: args.html ?? `<pre>${args.text}</pre>`,
  });

  if (error) {
    return { sent: false as const, reason: error.message };
  }

  return { sent: true as const };
}
