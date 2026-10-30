import {
  loadCoordinatorAnalytics,
  type CoordinatorAnalytics,
} from "./analytics";
import {
  clockInWindow,
  formatLongDate,
  schoolLocalTime,
  schoolNow,
  todayKey,
} from "./dates";
import { sendMail, smtpConfigured } from "./email";
import { loadSavedOpsEmails, usableOpsEmail } from "./ops-change-emails";
import { prisma } from "./prisma";
import { APP_ORIGIN } from "./school-slug";

const NAVY = "#0b2942";
const PAGE = "#f4f1ea";
const CARD = "#ffffff";
const INK = "#102a43";
const MUTED = "#52606d";
const LINE = "#e6e0d4";
const TEAL = "#087f6b";
const WINDOW_MINUTES = 45;
const FRIDAY_NOON = "12:00";
const MINNESOTA_TZ = "America/Chicago";

function minnesotaClock(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: MINNESOTA_TZ,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    hourCycle: "h23",
  }).formatToParts(date);
  const get = (type: string) =>
    parts.find((part) => part.type === type)?.value || "00";
  let hour = get("hour");
  if (hour === "24") hour = "00";
  return { weekday: get("weekday"), hhmm: `${hour}:${get("minute")}` };
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function headerImageUrl() {
  return `${APP_ORIGIN.replace(/\/$/, "")}/landingimage.png`;
}

export function isFridayLeadershipWindow() {
  const clock = minnesotaClock();
  return (
    (clock.weekday === "Fri" || clock.weekday === "Friday") &&
    clockInWindow(clock.hhmm, FRIDAY_NOON, WINDOW_MINUTES)
  );
}

export async function leadershipReportEmails(schoolId: string) {
  const [saved, users] = await Promise.all([
    loadSavedOpsEmails(schoolId),
    prisma.user.findMany({
      where: {
        schoolId,
        active: true,
        role: { in: ["ADMINISTRATOR", "COORDINATOR"] },
      },
      select: { email: true },
    }),
  ]);
  return [
    ...new Set(
      [...saved, ...users.map((user) => usableOpsEmail(user.email))].filter(Boolean),
    ),
  ];
}

function kpiCell(label: string, value: number) {
  return `<td width="50%" valign="top" style="padding:6px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f6f8fa;border:1px solid ${LINE};">
      <tr>
        <td style="padding:16px 14px;">
          <div style="font-size:11px;letter-spacing:0.08em;text-transform:uppercase;color:${MUTED};font-weight:700;">${escapeHtml(label)}</div>
          <div style="font-size:28px;line-height:1.1;font-weight:700;color:${NAVY};margin-top:6px;">${value}</div>
        </td>
      </tr>
    </table>
  </td>`;
}

export function fridayLeadershipText(args: {
  schoolName: string;
  data: CoordinatorAnalytics;
}) {
  const { data } = args;
  return [
    "AMPM Flow — Friday leadership report",
    args.schoolName,
    formatLongDate(schoolNow()),
    `Week ${data.weekLabel}`,
    "",
    `Bus riders: ${data.busRiders}`,
    `Van riders: ${data.vanRiders}`,
    `Buses: ${data.buses}`,
    `Vans: ${data.vans}`,
    "",
    `New route requests this week: ${data.requestsWeek}`,
    `Bus or van changes this week: ${data.changesWeek}`,
    `Still waiting for a bus: ${data.waiting}`,
    "",
    "Changes each week:",
    ...data.weeks.map(
      (week) =>
        `  ${week.label}: ${week.changes} change${week.changes === 1 ? "" : "s"}, ${week.requests} new request${week.requests === 1 ? "" : "s"}`,
    ),
  ].join("\n");
}

export function fridayLeadershipHtml(args: {
  schoolName: string;
  data: CoordinatorAnalytics;
}) {
  const { data } = args;
  const dateLabel = formatLongDate(schoolNow());
  const weekRows = data.weeks
    .map(
      (week, index) => `<tr>
        <td style="padding:10px 12px;border-top:1px solid ${LINE};color:${INK};">${escapeHtml(week.label)}</td>
        <td style="padding:10px 12px;border-top:1px solid ${LINE};text-align:right;font-weight:700;color:${NAVY};">${week.changes}</td>
        <td style="padding:10px 12px;border-top:1px solid ${LINE};text-align:right;font-weight:700;color:${TEAL};">${week.requests}</td>
      </tr>${index === data.weeks.length - 1 ? "" : ""}`,
    )
    .join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Friday leadership report — ${escapeHtml(args.schoolName)}</title>
</head>
<body style="margin:0;padding:0;background:${PAGE};font-family:Georgia,serif;color:${INK};">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:24px 12px;background:${PAGE};">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background:${CARD};border:1px solid ${LINE};">
          <tr>
            <td style="padding:0;font-size:0;line-height:0;">
              <img src="${headerImageUrl()}" alt="AMPM Flow" width="600" style="display:block;width:100%;max-width:600px;height:auto;border:0;">
            </td>
          </tr>
          <tr>
            <td style="background:${NAVY};color:#ffffff;padding:18px 24px;">
              <div style="font-size:12px;letter-spacing:0.12em;text-transform:uppercase;color:#c9d6c4;">AMPM Flow</div>
              <div style="font-size:22px;font-weight:700;margin-top:4px;">Friday leadership report</div>
              <div style="font-size:15px;color:#e8eef5;margin-top:4px;">${escapeHtml(args.schoolName)}</div>
              <div style="font-size:13px;color:#c9d6e3;margin-top:6px;">${escapeHtml(dateLabel)} · Week ${escapeHtml(data.weekLabel)}</div>
            </td>
          </tr>
          <tr>
            <td style="padding:22px 24px 8px;">
              <p style="margin:0 0 16px;font-size:15px;line-height:1.5;">
                A short Friday picture of transportation: who is on a bus or van,
                how many new routes were requested, and how often staff changed
                a ride this week.
              </p>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  ${kpiCell("Bus riders", data.busRiders)}
                  ${kpiCell("Van riders", data.vanRiders)}
                </tr>
                <tr>
                  ${kpiCell("Buses", data.buses)}
                  ${kpiCell("Vans", data.vans)}
                </tr>
                <tr>
                  ${kpiCell("New route requests this week", data.requestsWeek)}
                  ${kpiCell("Changes this week", data.changesWeek)}
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:8px 24px 24px;">
              <div style="font-size:12px;letter-spacing:0.08em;text-transform:uppercase;color:${MUTED};font-weight:700;margin:12px 0 8px;">How often rides changed</div>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid ${LINE};">
                <tr>
                  <td style="padding:10px 12px;background:#f6f8fa;font-size:12px;text-transform:uppercase;letter-spacing:0.06em;color:${MUTED};">Week</td>
                  <td style="padding:10px 12px;background:#f6f8fa;font-size:12px;text-transform:uppercase;letter-spacing:0.06em;color:${MUTED};text-align:right;">Changes</td>
                  <td style="padding:10px 12px;background:#f6f8fa;font-size:12px;text-transform:uppercase;letter-spacing:0.06em;color:${MUTED};text-align:right;">New requests</td>
                </tr>
                ${weekRows}
              </table>
              <p style="margin:16px 0 0;font-size:13px;color:${MUTED};">
                ${data.waiting} student${data.waiting === 1 ? "" : "s"} still waiting for a bus number.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

async function alreadySent(schoolId: string, dateKey: string) {
  const recent = await prisma.auditLog.findMany({
    where: { schoolId, action: "EMAIL_FRIDAY_LEADERSHIP" },
    orderBy: { createdAt: "desc" },
    take: 6,
  });
  return recent.some((log) => {
    try {
      const payload = JSON.parse(log.newPlan) as { dateKey?: string };
      if (payload.dateKey) return payload.dateKey === dateKey;
    } catch {
      /* use created time */
    }
    return todayKey(log.createdAt) === dateKey;
  });
}

export async function sendFridayLeadershipReport(args: {
  schoolId: string;
  actorId: string;
  automatic?: boolean;
}) {
  const dateKey = schoolLocalTime().dateKey;
  if (args.automatic && (await alreadySent(args.schoolId, dateKey))) {
    return { ok: true as const, sent: 0, alreadySent: true, recipients: [] as string[] };
  }

  const school = await prisma.school.findUnique({
    where: { id: args.schoolId },
    select: { name: true },
  });
  const schoolName = school?.name || "School";
  const data = await loadCoordinatorAnalytics(args.schoolId);
  const recipients = await leadershipReportEmails(args.schoolId);
  if (!recipients.length) {
    return {
      ok: false as const,
      sent: 0,
      recipients,
      error: "Add a leadership email on Today’s Changes first.",
    };
  }
  if (!smtpConfigured()) {
    return {
      ok: false as const,
      sent: 0,
      recipients,
      error: "Email is not configured yet.",
    };
  }

  const result = await sendMail({
    to: recipients,
    subject: `Friday leadership report — ${schoolName}`,
    text: fridayLeadershipText({ schoolName, data }),
    html: fridayLeadershipHtml({ schoolName, data }),
  });
  if (!result.sent) {
    return {
      ok: false as const,
      sent: 0,
      recipients,
      error: result.reason || "Could not send the email.",
    };
  }

  await prisma.auditLog
    .create({
      data: {
        schoolId: args.schoolId,
        actorId: args.actorId,
        approvedById: args.actorId,
        action: "EMAIL_FRIDAY_LEADERSHIP",
        newPlan: JSON.stringify({
          dateKey,
          sent: recipients.length,
          automatic: Boolean(args.automatic),
        }),
      },
    })
    .catch(() => undefined);

  return { ok: true as const, sent: recipients.length, recipients };
}

export async function runScheduledFridayLeadershipReports() {
  if (!isFridayLeadershipWindow()) {
    return { ran: false as const, reason: "outside-friday-noon", schools: 0 };
  }

  const schools = await prisma.school.findMany({ select: { id: true } });
  const results: Array<{ schoolId: string; sent: number; skipped?: string }> = [];

  for (const school of schools) {
    const actor = await prisma.user.findFirst({
      where: {
        schoolId: school.id,
        active: true,
        role: { in: ["COORDINATOR", "ADMINISTRATOR"] },
      },
      orderBy: { role: "asc" },
    });
    if (!actor) {
      results.push({ schoolId: school.id, sent: 0, skipped: "no-sender" });
      continue;
    }
    const result = await sendFridayLeadershipReport({
      schoolId: school.id,
      actorId: actor.id,
      automatic: true,
    });
    results.push({
      schoolId: school.id,
      sent: result.sent,
      skipped: result.ok
        ? result.alreadySent
          ? "already-sent"
          : undefined
        : result.error,
    });
  }

  return { ran: true as const, schools: schools.length, results };
}
