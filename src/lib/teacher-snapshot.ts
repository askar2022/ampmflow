import { notifyCoordinators } from "./audit";
import {
  clockInWindow,
  formatLongDate,
  formatTime,
  isSchoolWeekday,
  isFriday,
  schoolLocalTime,
  schoolNow,
  todayKey,
} from "./dates";
import { sendMail, smtpConfigured } from "./email";
import { planSummary } from "./format";
import {
  FRIDAY_SNAPSHOT_TIME,
  SNAPSHOT_TIME,
  snapshotClockLabel,
} from "./policy";
import { prisma } from "./prisma";
import { groupByTeacher, stamp } from "./reports";
import { loadStudents } from "./transportation";
import type { EffectiveStudent } from "./types";

const SNAPSHOT_WINDOW_MINUTES = 45;

export function teacherListNote(student: EffectiveStudent) {
  if (student.pm.source === "MISSING" || !student.pm.type) return "No plan yet";
  if (student.pm.waitingForAssignment) return "Waiting for a bus number";
  if (student.pm.source === "TODAY" || student.pm.source === "DATE_RANGE") {
    return "Changed today";
  }
  return null;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function sortClassroom(students: EffectiveStudent[]) {
  return [...students].sort((a, b) => {
    const aChange = teacherListNote(a) ? 0 : 1;
    const bChange = teacherListNote(b) ? 0 : 1;
    return aChange - bChange || a.lastName.localeCompare(b.lastName);
  });
}

function laterBoardNote() {
  const when = snapshotClockLabel();
  return isFriday()
    ? `Friday school closes at 12. This is the ${when} snapshot. If a parent calls later, check the live board.`
    : `This is the ${when} snapshot for your class. If a parent calls later, check the live board.`;
}

export function teacherSnapshotText(args: {
  classroom: string;
  generated: string;
  version: string;
  students: EffectiveStudent[];
}) {
  const when = snapshotClockLabel();
  const rows = sortClassroom(args.students);
  return [
    "AMPM Flow",
    `${when} dismissal list — ${args.classroom}`,
    args.generated,
    args.version,
    "",
    laterBoardNote(),
    "",
    ...rows.map((student) => {
      const note = teacherListNote(student);
      return `${student.fullName.padEnd(24)}  ${planSummary(student.pm, "PM").padEnd(28)}  ${student.pm.location}${note ? `  · ${note}` : ""}`;
    }),
  ].join("\n");
}

export function teacherSnapshotHtml(args: {
  classroom: string;
  generated: string;
  version: string;
  students: EffectiveStudent[];
}) {
  const when = snapshotClockLabel();
  const rows = sortClassroom(args.students);
  const changed = rows.filter((student) => teacherListNote(student)).length;
  const bodyRows = rows
    .map((student) => {
      const note = teacherListNote(student);
      const highlight = note
        ? "background:#fff4f0;color:#8a1f11;"
        : "background:#ffffff;color:#0e2438;";
      return `<tr>
        <td style="padding:8px 10px;border-top:1px solid #e6e0d4;${highlight}">
          ${escapeHtml(student.fullName)}${note ? `<div style="font-size:12px;font-weight:600;margin-top:2px;">${escapeHtml(note)}</div>` : ""}
        </td>
        <td style="padding:8px 10px;border-top:1px solid #e6e0d4;${highlight}">${escapeHtml(planSummary(student.pm, "PM"))}</td>
        <td style="padding:8px 10px;border-top:1px solid #e6e0d4;${highlight}">${escapeHtml(student.pm.location)}</td>
      </tr>`;
    })
    .join("");

  return `<!DOCTYPE html>
<html>
<body style="margin:0;background:#f4f1ea;font-family:Georgia,serif;color:#0e2438;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f1ea;padding:24px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border:1px solid #e6e0d4;">
          <tr>
            <td style="background:#0e2438;color:#ffffff;padding:18px 22px;">
              <div style="font-size:20px;font-weight:700;">AMPM Flow</div>
              <div style="font-size:12px;letter-spacing:0.12em;text-transform:uppercase;color:#c9d6c4;margin-top:4px;">Student Transportation &amp; Dismissal</div>
            </td>
          </tr>
          <tr>
            <td style="padding:22px;">
              <h1 style="margin:0 0 8px;font-size:26px;">${escapeHtml(when)} dismissal list</h1>
              <p style="margin:0 0 4px;font-size:16px;">${escapeHtml(args.classroom)}</p>
              <p style="margin:0 0 16px;font-size:13px;color:#5c6570;">${escapeHtml(args.generated)} · ${escapeHtml(args.version)}</p>
              <p style="margin:0 0 16px;font-size:14px;line-height:1.5;">
                This is today’s ${escapeHtml(when)} snapshot for your class.
                ${changed ? `${changed} student${changed === 1 ? "" : "s"} changed today — those rows are marked.` : "No same-day changes are on this list."}
                ${isFriday() ? "Friday school closes at 12. " : ""}If a parent calls after ${escapeHtml(when)}, check the live board.
              </p>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;font-family:Arial,sans-serif;font-size:14px;">
                <tr>
                  <th align="left" style="padding:8px 10px;background:#f4f1ea;color:#5c6570;font-size:12px;">Student</th>
                  <th align="left" style="padding:8px 10px;background:#f4f1ea;color:#5c6570;font-size:12px;">How they go home</th>
                  <th align="left" style="padding:8px 10px;background:#f4f1ea;color:#5c6570;font-size:12px;">Where</th>
                </tr>
                ${bodyRows}
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

type TeacherContact = {
  name: string;
  email: string;
  classroomName: string;
  userEmail: string;
};

export function usableTeacherEmail(email: string) {
  const value = email.trim();
  if (!value || !value.includes("@")) return "";
  if (value.toLowerCase().endsWith("@riverside.edu")) return "";
  return value;
}

function teacherEmailForGroup(teachers: TeacherContact[], groupName: string) {
  const [teacherName, classroomName] = groupName.split(" · ");
  const match =
    teachers.find(
      (teacher) =>
        teacher.name === teacherName &&
        (!classroomName || teacher.classroomName === classroomName),
    ) ?? teachers.find((teacher) => teacher.name === teacherName);
  return (
    usableTeacherEmail(match?.email || "") ||
    usableTeacherEmail(match?.userEmail || "")
  );
}

async function snapshotAlreadySent(schoolId: string, dateKey: string) {
  const recent = await prisma.auditLog.findMany({
    where: { schoolId, action: "EMAIL_TEACHER_SNAPSHOT" },
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

export async function lastTeacherEmail(schoolId: string) {
  return prisma.auditLog.findFirst({
    where: {
      schoolId,
      action: { in: ["EMAIL_TEACHER_SNAPSHOT", "EMAIL_TEACHER_LISTS"] },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function snapshotTimeForSchool(schoolId: string) {
  if (isFriday()) return FRIDAY_SNAPSHOT_TIME;
  const settings = await prisma.schoolSettings.findUnique({
    where: { schoolId },
  });
  return settings?.snapshotTime || SNAPSHOT_TIME;
}

export function isTeacherSnapshotWindow(snapshotTime: string) {
  const clock = schoolLocalTime();
  return (
    isSchoolWeekday(clock.weekday) &&
    clockInWindow(clock.hhmm, snapshotTime, SNAPSHOT_WINDOW_MINUTES)
  );
}

export async function sendTeacherClassroomLists(args: {
  schoolId: string;
  actorId: string;
  automatic?: boolean;
}) {
  const dateKey = schoolLocalTime().dateKey;
  if (args.automatic && (await snapshotAlreadySent(args.schoolId, dateKey))) {
    return { ok: true, sent: 0, skipped: 0, alreadySent: true as const };
  }

  if (!smtpConfigured()) {
    return {
      ok: false,
      sent: 0,
      skipped: 0,
      error:
        "Email is not configured yet. Add RESEND_API_KEY, or use Print / Download Excel.",
    };
  }

  const [students, teacherRows] = await Promise.all([
    loadStudents(args.schoolId),
    prisma.teacher.findMany({
      where: { schoolId: args.schoolId },
      include: {
        classroom: true,
        users: { where: { active: true, role: "TEACHER" } },
      },
    }),
  ]);
  const teachers: TeacherContact[] = teacherRows.map((teacher) => ({
    name: teacher.name,
    email: teacher.email,
    classroomName: teacher.classroom.name,
    userEmail: teacher.users[0]?.email || "",
  }));
  const groups = groupByTeacher(students);
  const header = stamp();
  let sent = 0;
  let skipped = 0;

  for (const [name, rows] of groups) {
    const to = teacherEmailForGroup(teachers, name);
    if (!to) {
      skipped += 1;
      continue;
    }
    const text = teacherSnapshotText({
      classroom: name,
      generated: header.generated,
      version: header.version,
      students: rows,
    });
    const html = teacherSnapshotHtml({
      classroom: name,
      generated: header.generated,
      version: header.version,
      students: rows,
    });
    const result = await sendMail({
      to,
      subject: `${snapshotClockLabel()} dismissal list — ${name} — ${formatLongDate(schoolNow())}`,
      text,
      html,
    });
    if (result.sent) sent += 1;
    else skipped += 1;
  }

  await prisma.auditLog.create({
    data: {
      schoolId: args.schoolId,
      actorId: args.actorId,
      approvedById: args.actorId,
      action: args.automatic ? "EMAIL_TEACHER_SNAPSHOT" : "EMAIL_TEACHER_LISTS",
      newPlan: JSON.stringify({
        dateKey,
        sent,
        skipped,
        automatic: Boolean(args.automatic),
        at: formatTime(schoolNow()),
      }),
    },
  });

  if (args.automatic && sent) {
    await notifyCoordinators(
      args.schoolId,
      `${snapshotClockLabel()} teacher lists sent`,
      `Emailed ${sent} classroom list${sent === 1 ? "" : "s"}.`,
    );
  }

  return { ok: true, sent, skipped };
}

export async function runScheduledTeacherSnapshots() {
  const clock = schoolLocalTime();
  if (!isSchoolWeekday(clock.weekday)) {
    return { ran: false as const, reason: "weekend", schools: 0 };
  }

  const schools = await prisma.school.findMany({ select: { id: true } });
  const results: Array<{ schoolId: string; sent: number; skipped?: string }> = [];

  for (const school of schools) {
    const snapshotTime = await snapshotTimeForSchool(school.id);
    if (!isTeacherSnapshotWindow(snapshotTime)) {
      results.push({ schoolId: school.id, sent: 0, skipped: "outside-window" });
      continue;
    }
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
    const result = await sendTeacherClassroomLists({
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
