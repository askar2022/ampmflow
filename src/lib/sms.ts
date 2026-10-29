function toE164(value: string) {
  const trimmed = value.trim();
  const digits = trimmed.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  if (trimmed.startsWith("+") && digits.length >= 10) return `+${digits}`;
  return "";
}

export function smsConfigured() {
  return Boolean(
    process.env.TWILIO_ACCOUNT_SID &&
      process.env.TWILIO_AUTH_TOKEN &&
      process.env.TWILIO_FROM_NUMBER,
  );
}

export function parentSmsNumbers(...values: Array<string | null | undefined>) {
  return [
    ...new Set(values.map((value) => toE164(value || "")).filter(Boolean)),
  ];
}

export async function sendSms(args: { to: string | string[]; body: string }) {
  if (!smsConfigured()) {
    return {
      sent: false as const,
      recipients: [] as string[],
      reason: "Twilio is not configured. Add TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_FROM_NUMBER on Vercel.",
    };
  }

  const recipients = parentSmsNumbers(
    ...(Array.isArray(args.to) ? args.to : [args.to]),
  );
  if (!recipients.length) {
    return {
      sent: false as const,
      recipients,
      reason: "No parent phone that can receive a text.",
    };
  }

  const sid = process.env.TWILIO_ACCOUNT_SID || "";
  const token = process.env.TWILIO_AUTH_TOKEN || "";
  const from = process.env.TWILIO_FROM_NUMBER || "";
  const auth = Buffer.from(`${sid}:${token}`).toString("base64");
  const sent: string[] = [];
  const errors: string[] = [];

  for (const to of recipients) {
    const body = new URLSearchParams({ From: from, To: to, Body: args.body });
    const response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${auth}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body,
      },
    );
    if (response.ok) {
      sent.push(to);
      continue;
    }
    const payload = (await response.json().catch(() => ({}))) as {
      message?: string;
    };
    errors.push(payload.message || `Could not text ${to}.`);
  }

  if (!sent.length) {
    return {
      sent: false as const,
      recipients,
      reason: errors[0] || "Could not send the text.",
    };
  }
  return { sent: true as const, recipients: sent };
}
