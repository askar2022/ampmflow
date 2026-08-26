import nodemailer from "nodemailer";

export function smtpConfigured() {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER);
}

export async function sendMail(args: {
  to: string | string[];
  subject: string;
  text: string;
  html?: string;
}) {
  if (!smtpConfigured()) {
    return { sent: false as const, reason: "SMTP is not configured." };
  }

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_PORT === "465",
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  await transporter.sendMail({
    from: process.env.SMTP_FROM,
    to: Array.isArray(args.to) ? args.to.join(", ") : args.to,
    subject: args.subject,
    text: args.text,
    html: args.html ?? `<pre>${args.text}</pre>`,
  });

  return { sent: true as const };
}
