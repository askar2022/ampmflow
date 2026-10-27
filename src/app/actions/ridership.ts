"use server";

import { getSession } from "@/lib/auth";
import { writeAudit } from "@/lib/audit";
import { formatLongDate, schoolNow } from "@/lib/dates";
import { sendMail, smtpConfigured } from "@/lib/email";
import { usableOpsEmail } from "@/lib/ops-change-emails";
import { loadDriverLists, oneVehicleText } from "@/lib/ridership";

function parseSendTo(raw: string) {
  return [
    ...new Set(
      raw
        .split(/[\s,;]+/)
        .map((email) => usableOpsEmail(email))
        .filter(Boolean),
    ),
  ];
}

export async function emailDriverList(args: {
  to: string;
  bus?: string;
  van?: string;
}) {
  const user = await getSession();
  if (
    !user ||
    (user.role !== "FRONT_DESK" &&
      user.role !== "COORDINATOR" &&
      user.role !== "ADMINISTRATOR")
  ) {
    return { ok: false as const, error: "You cannot email this list.", recipients: [] as string[] };
  }

  const bus = String(args.bus || "").trim();
  const van = String(args.van || "").trim();
  if (!bus && !van) {
    return {
      ok: false as const,
      error: "Choose a bus or van first.",
      recipients: [] as string[],
    };
  }

  const recipients = parseSendTo(args.to);
  if (!recipients.length) {
    return {
      ok: false as const,
      error: "Type the driver or bus company email first.",
      recipients,
    };
  }
  if (!smtpConfigured()) {
    return {
      ok: false as const,
      error: "Email is not configured yet.",
      recipients,
    };
  }

  const lists = await loadDriverLists(user.schoolId);
  const picked = oneVehicleText({
    riders: lists.riders,
    vans: lists.vans,
    bus: bus || undefined,
    van: van || undefined,
  });
  if (!picked.rows.length) {
    return {
      ok: false as const,
      error: "No students on that bus or van yet.",
      recipients,
    };
  }

  const result = await sendMail({
    to: recipients,
    subject: `${picked.title} — ${formatLongDate(schoolNow())}`,
    text: picked.text,
  });
  if (!result.sent) {
    return {
      ok: false as const,
      error: result.reason || "Could not send the email.",
      recipients,
    };
  }

  await writeAudit({
    user,
    action: "EMAIL_DRIVER_LIST",
    newPlan: { sent: recipients.length, title: picked.title, students: picked.rows.length },
  }).catch(() => undefined);

  return { ok: true as const, recipients, title: picked.title };
}
