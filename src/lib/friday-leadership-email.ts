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
import {
  loadSavedOpsEmails,
  saveOpsEmails,
  usableOpsEmail,
} from "./ops-change-emails";
import { prisma } from "./prisma";
import { schoolTheme } from "./school";
import { APP_ORIGIN } from "./school-slug";

const PAGE = "#f4f6f8";
const CARD = "#ffffff";
const INK = "#102a43";
const MUTED = "#5b6d7e";
const LINE = "#e4ebf0";
const BLUE = "#2b6aa3";
const PINK = "#d4537e";
const TEAL = "#087f6b";
const ORANGE = "#c05621";
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

const METRO_FRIDAY_EMAILS = [
  "ahelmi@metroschoolsmn.org",
  "mahmed@metroschoolsmn.org",
  "askar@automationllc.org",
];

export async function leadershipReportEmails(schoolId: string) {
  const [saved, users, school] = await Promise.all([
    loadSavedOpsEmails(schoolId),
    prisma.user.findMany({
      where: {
        schoolId,
        active: true,
        role: { in: ["ADMINISTRATOR", "COORDINATOR"] },
      },
      select: { email: true },
    }),
    prisma.school.findUnique({
      where: { id: schoolId },
      select: { name: true },
    }),
  ]);
  const metro = /metro/i.test(school?.name || "") ? METRO_FRIDAY_EMAILS : [];
  if (metro.some((email) => !saved.includes(email))) {
    await saveOpsEmails(schoolId, [...saved, ...metro]).catch(() => undefined);
  }
  return [
    ...new Set(
      [
        ...saved,
        ...metro,
        ...users.map((user) => usableOpsEmail(user.email)),
      ].filter(Boolean),
    ),
  ];
}

function barWidth(part: number, whole: number) {
  if (!whole || !part) return 4;
  return Math.min(100, Math.max(8, Math.round((part / whole) * 100)));
}

function statBar(args: {
  label: string;
  value: number;
  of: number;
  color: string;
  hint: string;
}) {
  const width = barWidth(args.value, args.of);
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 18px;">
    <tr>
      <td style="font-size:15px;font-weight:700;color:${INK};padding:0 0 4px;">${escapeHtml(args.label)}</td>
      <td align="right" style="font-size:15px;font-weight:700;color:${INK};padding:0 0 4px;">${args.value}</td>
    </tr>
    <tr>
      <td colspan="2" style="padding:0 0 4px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eef2f5;border-radius:999px;">
          <tr>
            <td width="${width}%" height="10" bgcolor="${args.color}" style="background:${args.color};height:10px;border-radius:999px;font-size:0;line-height:0;">&nbsp;</td>
            <td width="${100 - width}%" height="10" style="height:10px;font-size:0;line-height:0;">&nbsp;</td>
          </tr>
        </table>
      </td>
    </tr>
    <tr>
      <td colspan="2" style="font-size:12px;color:${MUTED};">${escapeHtml(args.hint)}</td>
    </tr>
  </table>`;
}

export function fridayLeadershipText(args: {
  schoolName: string;
  data: CoordinatorAnalytics;
}) {
  const { data } = args;
  return [
    "AMPM Flow — Friday snapshot",
    `Hello, ${args.schoolName}`,
    `Transportation this week · ${data.weekLabel}`,
    "",
    `Thank you for keeping dismissal safe. Here is how buses and vans looked this week.`,
    "",
    `This week: ${data.busRiders} bus riders · ${data.vanRiders} van riders · ${data.changesWeek} changes · ${data.requestsWeek} new requests`,
    "",
    `Bus riders: ${data.busRiders} of ${data.students} students`,
    `Van riders: ${data.vanRiders} of ${data.students} students`,
    `Buses: ${data.buses} · Vans: ${data.vans}`,
    `Changes this week: ${data.changesWeek}`,
    `New route requests this week: ${data.requestsWeek}`,
    `Still waiting for a bus: ${data.waiting}`,
    "",
    "Each week:",
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
  const theme = schoolTheme(args.schoolName);
  const header = theme.navy;
  const students = Math.max(data.students, 1);
  const weekMax = Math.max(
    1,
    data.changesWeek,
    data.requestsWeek,
    ...data.weeks.flatMap((week) => [week.changes, week.requests]),
  );
  const weekRows = data.weeks
    .map(
      (week) => `<tr>
        <td style="padding:10px 0;border-top:1px solid ${LINE};color:${INK};">${escapeHtml(week.label)}</td>
        <td style="padding:10px 0;border-top:1px solid ${LINE};text-align:right;font-weight:700;color:${BLUE};">${week.changes}</td>
        <td style="padding:10px 0;border-top:1px solid ${LINE};text-align:right;font-weight:700;color:${TEAL};">${week.requests}</td>
      </tr>`,
    )
    .join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Friday snapshot — ${escapeHtml(args.schoolName)}</title>
</head>
<body style="margin:0;padding:0;background:${PAGE};font-family:Arial,Helvetica,sans-serif;color:${INK};">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:24px 12px;background:${PAGE};">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background:${CARD};border-radius:24px;overflow:hidden;">
          <tr>
            <td style="padding:0;font-size:0;line-height:0;">
              <img src="${headerImageUrl()}" alt="" width="600" style="display:block;width:100%;max-width:600px;height:auto;border:0;">
            </td>
          </tr>
          <tr>
            <td align="center" style="background:${header};color:#ffffff;padding:28px 28px 32px;">
              <div style="font-size:11px;letter-spacing:0.16em;text-transform:uppercase;color:#d9f3ee;font-weight:700;">Friday snapshot</div>
              <div style="font-size:28px;line-height:1.2;font-weight:700;margin:10px 0 8px;">Hello, ${escapeHtml(args.schoolName)}</div>
              <div style="font-size:15px;color:#e8eef5;">Transportation this week · ${escapeHtml(data.weekLabel)}</div>
            </td>
          </tr>
          <tr>
            <td style="padding:28px 28px 8px;">
              <p style="margin:0 0 18px;font-size:16px;line-height:1.55;color:${INK};">
                Thank you for keeping dismissal safe. Here is how families used buses and vans this week.
              </p>
              <p style="margin:0 0 22px;font-size:15px;line-height:1.5;color:${INK};">
                <strong>This week</strong><br>
                ${data.busRiders} bus riders · ${data.vanRiders} van riders · ${data.buses} buses · ${data.vans} vans
              </p>
              ${statBar({
                label: "Bus riders",
                value: data.busRiders,
                of: students,
                color: BLUE,
                hint: `${data.students} students on the roster`,
              })}
              ${statBar({
                label: "Van riders",
                value: data.vanRiders,
                of: students,
                color: PINK,
                hint: `${data.vans} van${data.vans === 1 ? "" : "s"} on file`,
              })}
              ${statBar({
                label: "Bus or van changes this week",
                value: data.changesWeek,
                of: weekMax,
                color: TEAL,
                hint: "How often Front Desk changed a ride",
              })}
              ${statBar({
                label: "New route requests this week",
                value: data.requestsWeek,
                of: weekMax,
                color: ORANGE,
                hint: "New students waiting for a bus or van",
              })}
            </td>
          </tr>
          <tr>
            <td style="padding:8px 28px 28px;">
              <div style="font-size:12px;letter-spacing:0.08em;text-transform:uppercase;color:${MUTED};font-weight:700;margin:8px 0 10px;">Each week</div>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="padding:0 0 8px;font-size:12px;color:${MUTED};">Week</td>
                  <td style="padding:0 0 8px;font-size:12px;color:${MUTED};text-align:right;">Changes</td>
                  <td style="padding:0 0 8px;font-size:12px;color:${MUTED};text-align:right;">New requests</td>
                </tr>
                ${weekRows}
              </table>
              <p style="margin:18px 0 0;font-size:13px;color:${MUTED};">
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
    subject: `Friday snapshot — Hello, ${schoolName}`,
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
