import { randomUUID } from "crypto";
import { notifyCoordinators } from "./audit";
import {
  clockInWindow,
  formatLongDate,
  formatTime,
  isFriday,
  isSchoolWeekday,
  schoolLocalTime,
  schoolNow,
  todayKey,
} from "./dates";
import { sendMail, smtpConfigured } from "./email";
import { planSummary } from "./format";
import {
  opsChangesClockLabel,
  opsChangesTimeForToday,
} from "./policy";
import { prisma } from "./prisma";
import { changeList, groupByTeacher, stamp } from "./reports";
import { loadStudents } from "./transportation";
import type { EffectiveStudent } from "./types";

const WINDOW_MINUTES = 45;

export function usableOpsEmail(email: string) {
  const value = email.trim().toLowerCase();
  if (!value || !value.includes("@") || !value.includes(".")) return "";
  if (
    value.endsWith("@riverside.edu") ||
    value.endsWith("@example.com") ||
    value.endsWith("@school.edu")
  ) {
    return "";
  }
  return value;
}

function parseEmailList(raw: string) {
  return [
    ...new Set(
      raw
        .split(/[\s,;]+/)
        .map((email) => usableOpsEmail(email))
        .filter(Boolean),
    ),
  ];
}

async function ensureOpsEmailColumn() {
  await prisma.$executeRawUnsafe(
    `ALTER TABLE "SchoolSettings" ADD COLUMN IF NOT EXISTS "opsChangeEmails" TEXT NOT NULL DEFAULT ''`,
  );
}

async function ensureSettingsRow(schoolId: string) {
  await ensureOpsEmailColumn();
  const existing = await prisma.schoolSettings.findUnique({
    where: { schoolId },
    select: { id: true },
  });
  if (existing) return existing.id;
  const created = await prisma.schoolSettings.create({
    data: { id: randomUUID(), schoolId },
    select: { id: true },
  });
  return created.id;
}

export async function loadSavedOpsEmails(schoolId: string) {
  try {
    await ensureSettingsRow(schoolId);
    const rows = await prisma.$queryRaw<Array<{ opsChangeEmails: string }>>`
      SELECT "opsChangeEmails" FROM "SchoolSettings" WHERE "schoolId" = ${schoolId}
    `;
    return parseEmailList(rows[0]?.opsChangeEmails || "");
  } catch {
    return [];
  }
}

export async function saveOpsEmails(schoolId: string, emails: string[]) {
  const next = [...new Set(emails.map((email) => usableOpsEmail(email)).filter(Boolean))];
  await ensureSettingsRow(schoolId);
  const value = next.join("\n");
  await prisma.$executeRaw`
    UPDATE "SchoolSettings" SET "opsChangeEmails" = ${value} WHERE "schoolId" = ${schoolId}
  `;
  return next;
}

export async function addOpsEmail(schoolId: string, email: string) {
  const clean = usableOpsEmail(email);
  if (!clean) {
    return { ok: false as const, error: "Enter a real email address.", emails: await loadSavedOpsEmails(schoolId) };
  }
  try {
    const emails = await loadSavedOpsEmails(schoolId);
    if (emails.includes(clean)) {
      return { ok: true as const, emails };
    }
    return { ok: true as const, emails: await saveOpsEmails(schoolId, [...emails, clean]) };
  } catch {
    return {
      ok: false as const,
      error: "Could not save that email. Run SETUP-OPS-CHANGE-EMAILS.sql in the database, then try again.",
      emails: [],
    };
  }
}

export async function removeOpsEmail(schoolId: string, email: string) {
  try {
    const emails = await loadSavedOpsEmails(schoolId);
    return {
      ok: true as const,
      emails: await saveOpsEmails(
        schoolId,
        emails.filter((item) => item !== usableOpsEmail(email)),
      ),
    };
  } catch {
    return { ok: false as const, error: "Could not remove that email.", emails: [] };
  }
}

function changedTrips(student: EffectiveStudent) {
  const trips: Array<"AM" | "PM"> = [];
  if (student.am.source === "TODAY" || student.am.source === "DATE_RANGE") {
    trips.push("AM");
  }
  if (student.pm.source === "TODAY" || student.pm.source === "DATE_RANGE") {
    trips.push("PM");
  }
  return trips;
}

function windowLabel(student: EffectiveStudent) {
  const start = student.pm.startDate || student.am.startDate;
  const end = student.pm.endDate || student.am.endDate;
  if (!start && !end) return "Today only";
  if (start && end && start === end) return `Today only · ${start}`;
  if (start && end) return `${start} – ${end}`;
  return start || end || "Today only";
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function classroomGroups(students: EffectiveStudent[]) {
  return groupByTeacher(changeList(students)).filter(([, rows]) => rows.length);
}

export function opsChangesText(args: {
  generated: string;
  version: string;
  groups: [string, EffectiveStudent[]][];
}) {
  const when = opsChangesClockLabel();
  if (!args.groups.length) {
    return [
      "AMPM Flow",
      `${when} — today’s dismissal changes`,
      args.generated,
      args.version,
      "",
      "No dismissal changes today. Permanent plans stand.",
    ].join("\n");
  }

  const lines = [
    "AMPM Flow",
    `${when} — today’s dismissal changes`,
    args.generated,
    args.version,
    "",
    "Only students who changed today are listed, by class. Check these rooms first.",
    "",
    "Classes to check:",
    ...args.groups.map(
      ([name, rows]) =>
        `• ${name} — ${rows.length} student${rows.length === 1 ? "" : "s"}`,
    ),
    "",
  ];

  for (const [name, rows] of args.groups) {
    lines.push(name);
    for (const student of rows) {
      const trips = changedTrips(student);
      lines.push(`  ${student.fullName}`);
      for (const trip of trips) {
        const plan = trip === "AM" ? student.am : student.pm;
        lines.push(`    ${trip}: ${planSummary(plan, trip)}  ·  ${plan.location}`);
      }
      lines.push(`    Window: ${windowLabel(student)}`);
    }
    lines.push("");
  }

  return lines.join("\n");
}

export function opsChangesHtml(args: {
  generated: string;
  version: string;
  groups: [string, EffectiveStudent[]][];
}) {
  const when = opsChangesClockLabel();
  const total = args.groups.reduce((sum, [, rows]) => sum + rows.length, 0);
  const summary = args.groups.length
    ? args.groups
        .map(
          ([name, rows]) =>
            `<li style="margin:0 0 6px;"><strong>${escapeHtml(name)}</strong> — ${rows.length} student${rows.length === 1 ? "" : "s"}</li>`,
        )
        .join("")
    : "<li>No classes have changes today.</li>";

  const sections = args.groups.length
    ? args.groups
        .map(([name, rows]) => {
          const body = rows
            .map((student) => {
              const trips = changedTrips(student)
                .map((trip) => {
                  const plan = trip === "AM" ? student.am : student.pm;
                  return `${trip}: ${planSummary(plan, trip)} · ${plan.location}`;
                })
                .join("<br>");
              return `<tr>
                <td style="padding:10px 12px;border-top:1px solid #f0c7b8;background:#fff4f0;color:#8a1f11;">
                  <div style="font-weight:700;">${escapeHtml(student.fullName)}</div>
                  <div style="font-size:12px;margin-top:4px;">Changed today</div>
                </td>
                <td style="padding:10px 12px;border-top:1px solid #f0c7b8;background:#fff4f0;color:#8a1f11;">${trips}</td>
                <td style="padding:10px 12px;border-top:1px solid #f0c7b8;background:#fff4f0;color:#8a1f11;">${escapeHtml(windowLabel(student))}</td>
              </tr>`;
            })
            .join("");
          return `<h2 style="margin:22px 0 8px;font-size:20px;">${escapeHtml(name)}</h2>
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;font-family:Arial,sans-serif;font-size:14px;">
              <tr>
                <th align="left" style="padding:8px 12px;background:#f4f1ea;color:#5c6570;font-size:12px;">Student</th>
                <th align="left" style="padding:8px 12px;background:#f4f1ea;color:#5c6570;font-size:12px;">Today’s plan</th>
                <th align="left" style="padding:8px 12px;background:#f4f1ea;color:#5c6570;font-size:12px;">Window</th>
              </tr>
              ${body}
            </table>`;
        })
        .join("")
    : `<p style="margin:16px 0 0;font-size:15px;">No dismissal changes today. Permanent plans stand.</p>`;

  return `<!DOCTYPE html>
<html>
<body style="margin:0;background:#f4f1ea;font-family:Georgia,serif;color:#0e2438;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f1ea;padding:24px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="640" cellpadding="0" cellspacing="0" style="max-width:640px;background:#ffffff;border:1px solid #e6e0d4;">
          <tr>
            <td style="background:#0e2438;color:#ffffff;padding:18px 22px;">
              <div style="font-size:20px;font-weight:700;">AMPM Flow</div>
              <div style="font-size:12px;letter-spacing:0.12em;text-transform:uppercase;color:#c9d6c4;margin-top:4px;">Student Transportation &amp; Dismissal</div>
            </td>
          </tr>
          <tr>
            <td style="padding:22px;">
              <h1 style="margin:0 0 8px;font-size:26px;">${escapeHtml(when)} — today’s changes</h1>
              <p style="margin:0 0 16px;font-size:13px;color:#5c6570;">${escapeHtml(args.generated)} · ${escapeHtml(args.version)}</p>
              <p style="margin:0 0 12px;font-size:15px;line-height:1.5;">
                ${
                  total
                    ? `${total} student${total === 1 ? "" : "s"} changed today, in ${args.groups.length} class${args.groups.length === 1 ? "" : "es"}. Only those students are listed. Check these rooms first.`
                    : "No same-day changes are on the board."
                }
                ${isFriday() ? " Friday school closes at 12." : ""}
              </p>
              <p style="margin:0 0 6px;font-size:13px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:#5c6570;">Classes to check</p>
              <ul style="margin:0 0 8px;padding-left:18px;font-size:15px;">${summary}</ul>
              ${sections}
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
    where: { schoolId, action: "EMAIL_OPS_CHANGES" },
    orderBy: { createdAt: "desc" },
    take: 8,
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

export async function lastOpsChangeEmail(schoolId: string) {
  return prisma.auditLog.findFirst({
    where: { schoolId, action: { in: ["EMAIL_OPS_CHANGES", "EMAIL_OPS_CHANGES_NOW"] } },
    orderBy: { createdAt: "desc" },
  });
}

export async function sendOpsChangeDigest(args: {
  schoolId: string;
  actorId: string;
  automatic?: boolean;
}) {
  const dateKey = schoolLocalTime().dateKey;
  if (args.automatic && (await alreadySent(args.schoolId, dateKey))) {
    return { ok: true, sent: 0, alreadySent: true as const, recipients: [] as string[] };
  }

  const recipients = await loadSavedOpsEmails(args.schoolId);
  if (!recipients.length) {
    return {
      ok: false,
      sent: 0,
      recipients,
      error: "Add emails on Today’s Changes first.",
    };
  }

  if (!smtpConfigured()) {
    return {
      ok: false,
      sent: 0,
      recipients,
      error: "Email is not configured yet. Add RESEND_API_KEY.",
    };
  }

  const students = await loadStudents(args.schoolId);
  const groups = classroomGroups(students);
  const header = stamp();
  const when = opsChangesClockLabel();
  const text = opsChangesText({
    generated: header.generated,
    version: header.version,
    groups,
  });
  const html = opsChangesHtml({
    generated: header.generated,
    version: header.version,
    groups,
  });
  const result = await sendMail({
    to: recipients,
    subject: `${when} dismissal changes — ${formatLongDate(schoolNow())}`,
    text,
    html,
  });

  if (!result.sent) {
    return {
      ok: false,
      sent: 0,
      recipients,
      error: result.reason || "Could not send the email.",
    };
  }

  await prisma.auditLog.create({
    data: {
      schoolId: args.schoolId,
      actorId: args.actorId,
      approvedById: args.actorId,
      action: args.automatic ? "EMAIL_OPS_CHANGES" : "EMAIL_OPS_CHANGES_NOW",
      newPlan: JSON.stringify({
        dateKey,
        sent: recipients.length,
        classes: groups.length,
        changes: groups.reduce((sum, [, rows]) => sum + rows.length, 0),
        automatic: Boolean(args.automatic),
        at: formatTime(schoolNow()),
      }),
    },
  });

  if (args.automatic) {
    await notifyCoordinators(
      args.schoolId,
      `${when} change list sent`,
      `Emailed today’s changes to ${recipients.length} people.`,
    );
  }

  return { ok: true, sent: recipients.length, recipients };
}

export function isOpsChangesWindow() {
  const clock = schoolLocalTime();
  return (
    isSchoolWeekday(clock.weekday) &&
    clockInWindow(clock.hhmm, opsChangesTimeForToday(), WINDOW_MINUTES)
  );
}

export async function runScheduledOpsChangeDigests() {
  const clock = schoolLocalTime();
  if (!isSchoolWeekday(clock.weekday)) {
    return { ran: false as const, reason: "weekend", schools: 0 };
  }
  if (!isOpsChangesWindow()) {
    return { ran: false as const, reason: "outside-window", schools: 0 };
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
    const result = await sendOpsChangeDigest({
      schoolId: school.id,
      actorId: actor.id,
      automatic: true,
    });
    results.push({
      schoolId: school.id,
      sent: result.sent,
      skipped: result.alreadySent
        ? "already-sent"
        : result.error
          ? result.error
          : undefined,
    });
  }

  return { ran: true as const, reason: "ok", schools: schools.length, results };
}
