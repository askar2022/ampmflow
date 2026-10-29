function toE164(value: string) {
  const trimmed = value.trim();
  const digits = trimmed.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  if (trimmed.startsWith("+") && digits.length >= 10) return `+${digits}`;
  return "";
}

function twilioFromNumber() {
  return (
    process.env.TWILIO_PHONE_NUMBER ||
    process.env.TWILIO_FROM_NUMBER ||
    ""
  ).trim();
}

function twilioAuth() {
  const apiKey = (process.env.TWILIO_API_KEY_SID || "").trim();
  const apiSecret = (process.env.TWILIO_API_KEY_SECRET || "").trim();
  const accountSid = (process.env.TWILIO_ACCOUNT_SID || "").trim();
  const authToken = (process.env.TWILIO_AUTH_TOKEN || "").trim();
  const user = apiKey || accountSid;
  const pass = apiSecret || authToken;
  const pathSid = accountSid.startsWith("AC")
    ? accountSid
    : apiKey.startsWith("AC")
      ? apiKey
      : accountSid || apiKey;
  return { user, pass, pathSid };
}

export function smsConfigured() {
  const { user, pass, pathSid } = twilioAuth();
  return Boolean(user && pass && pathSid && twilioFromNumber());
}

export function parentSmsNumbers(...values: Array<string | null | undefined>) {
  return [
    ...new Set(values.map((value) => toE164(value || "")).filter(Boolean)),
  ];
}

export async function sendSms(args: { to: string | string[]; body: string }) {
  const { user, pass, pathSid } = twilioAuth();
  const from = twilioFromNumber();
  if (!user || !pass || !pathSid || !from) {
    return {
      sent: false as const,
      recipients: [] as string[],
      errors: [] as string[],
      reason:
        "Twilio is not configured. AMPM Flow reads TWILIO_API_KEY_SID, TWILIO_API_KEY_SECRET, and TWILIO_PHONE_NUMBER.",
    };
  }

  const recipients = parentSmsNumbers(
    ...(Array.isArray(args.to) ? args.to : [args.to]),
  );
  if (!recipients.length) {
    return {
      sent: false as const,
      recipients,
      errors: [] as string[],
      reason: "No parent phone that can receive a text.",
    };
  }

  const auth = Buffer.from(`${user}:${pass}`).toString("base64");
  const sent: string[] = [];
  const errors: string[] = [];

  for (const to of recipients) {
    const body = new URLSearchParams({ From: from, To: to, Body: args.body });
    const response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${pathSid}/Messages.json`,
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
    errors.push(`${to}: ${payload.message || "Could not send the text."}`);
  }

  if (!sent.length) {
    return {
      sent: false as const,
      recipients,
      errors,
      reason: errors[0] || "Could not send the text.",
    };
  }
  return { sent: true as const, recipients: sent, errors };
}
