"use server";

import { getSession } from "@/lib/auth";
import { writeAudit } from "@/lib/audit";
import { formatLongDate, schoolNow } from "@/lib/dates";
import { sendMail, smtpConfigured } from "@/lib/email";
import { usableOpsEmail } from "@/lib/ops-change-emails";
import { loadRidership, ridershipText } from "@/lib/ridership";

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

export async function emailBusVanList(toRaw: string) {
  const user = await getSession();
  if (
    !user ||
    (user.role !== "FRONT_DESK" &&
      user.role !== "COORDINATOR" &&
      user.role !== "ADMINISTRATOR")
  ) {
    return { ok: false as const, error: "You cannot email this list.", recipients: [] as string[] };
  }

  const recipients = parseSendTo(toRaw);
  if (!recipients.length) {
    return {
      ok: false as const,
      error: "Type the email of the bus company or driver first.",
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

  const list = await loadRidership(user.schoolId);
  if (!list.busRiders && !list.vanRiders) {
    return {
      ok: false as const,
      error: "No bus or van students to email.",
      recipients,
    };
  }

  const text = ridershipText(list);
  const result = await sendMail({
    to: recipients,
    subject: `Bus and van list — ${formatLongDate(schoolNow())}`,
    text,
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
    action: "EMAIL_BUS_VAN_LIST",
    newPlan: { sent: recipients.length, buses: list.buses.length, vans: list.vans.length },
  }).catch(() => undefined);

  return { ok: true as const, recipients };
}
