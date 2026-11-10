import { writeAudit } from "./audit";
import { schoolStaffEmails } from "./company-access";
import { after } from "next/server";
import { sendMail, smtpConfigured } from "./email";
import { planSummary } from "./format";
import { usableOpsEmail } from "./ops-change-emails";
import { prisma } from "./prisma";
import { parentSmsNumbers, sendSms, smsConfigured } from "./sms";
import { usableTeacherEmail } from "./teacher-snapshot";
import type { Destination, EffectiveStudent, SessionUser, Trip } from "./types";

export type ParentSmsKind =
  | "daycare-request"
  | "address-request"
  | "ride-request"
  | "assigned";

function pickupTimeLine(amPickup?: string, pmPickup?: string) {
  return [
    amPickup?.trim() ? `AM pickup ${amPickup.trim()}` : "",
    pmPickup?.trim() ? `PM pickup ${pmPickup.trim()}` : "",
  ]
    .filter(Boolean)
    .join(". ");
}

function pickupTimeLineSo(amPickup?: string, pmPickup?: string) {
  return [
    amPickup?.trim() ? `Qaadista AM ${amPickup.trim()}` : "",
    pmPickup?.trim() ? `Qaadista PM ${pmPickup.trim()}` : "",
  ]
    .filter(Boolean)
    .join(". ");
}

function bilingualSms(english: string, somali: string) {
  return `${english}\n${somali}`;
}

const REQUEST_SO =
  "Waxaan u dirney codisigaagii kambaniga basaska. Waanu kuu soo diri doonaa marka bas ama van lagu qoro.";

function parentChangeSms(args: {
  student: EffectiveStudent;
  next: string;
  note: string;
  when: string;
  kind: ParentSmsKind;
  amPickup?: string;
  pmPickup?: string;
}) {
  const name = args.student.fullName;
  if (
    args.kind === "daycare-request" ||
    args.kind === "address-request" ||
    args.kind === "ride-request"
  ) {
    const english =
      args.kind === "daycare-request"
        ? `AMPM Flow: we asked the bus company to add a daycare route for ${name}. We will text you when a bus or van is assigned.`
        : args.kind === "address-request"
          ? `AMPM Flow: we sent ${name}'s new address to the bus company. We will text you when a bus or van is assigned.`
          : `AMPM Flow: we asked the bus company for a bus or van for ${name}. We will text you when it is assigned.`;
    return bilingualSms(english, `${name}: ${REQUEST_SO}`);
  }
  const times = pickupTimeLine(args.amPickup, args.pmPickup);
  const timesSo = pickupTimeLineSo(args.amPickup, args.pmPickup);
  const blob = `${args.next} ${args.note} ${args.when}`;
  const van =
    blob.match(/Van\s+[A-Za-z0-9-]+/i)?.[0] ||
    args.note.match(/Van\s+[A-Za-z0-9-]+/i)?.[0];
  const bus =
    args.next.match(/Bus\s+\d+/i)?.[0] || args.note.match(/Bus\s+\d+/i)?.[0];
  const ride = van || bus || "a bus or van";
  const rideSo = van || bus || "bas ama van";
  const assigned = `AMPM Flow: ${name} is assigned ${ride}`;
  const assignedSo = `${name} waxaa lagu qoray ${rideSo}`;
  return bilingualSms(
    times ? `${assigned}. ${times}.` : `${assigned}.`,
    timesSo ? `${assignedSo}. ${timesSo}.` : `${assignedSo}.`,
  );
}

export type ChangeNotice = {
  sent: string[];
  skipped: string[];
  waiting: boolean;
};

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function uniqueEmails(values: Array<string | null | undefined>) {
  return [...new Set(values.map((email) => usableOpsEmail(email || "")).filter(Boolean))];
}

export type CompanyRequestKind = "DAYCARE" | "ADDRESS" | "NEW_ROUTE" | "ROUTE";

const COMPANY_REQUEST_TITLES: Record<CompanyRequestKind, string> = {
  DAYCARE: "Daycare Change Request",
  ADDRESS: "New Address Request",
  NEW_ROUTE: "New Route Request",
  ROUTE: "Route Change Request",
};

function gradeOnly(grade: string) {
  return String(grade).replace(/^grade\s+/i, "") || "—";
}

function stripTripPrefix(line: string) {
  return line.replace(/^(AM|PM):\s*/gi, "").replace(/\s+/g, " ").trim();
}

export function companyRequestKind(args: {
  destination?: Destination | null;
  waiting?: boolean;
  enrollmentSource?: string;
}): CompanyRequestKind {
  if (args.destination === "DAYCARE") return "DAYCARE";
  if (args.destination === "CUSTOM") return "ADDRESS";
  if (
    args.waiting &&
    (args.enrollmentSource === "ROUTE_REQUEST" ||
      args.enrollmentSource === "NEW_APPLICATION" ||
      !args.destination ||
      args.destination === "HOME")
  ) {
    return "NEW_ROUTE";
  }
  return "ROUTE";
}

export function destinationFromStudent(student: EffectiveStudent): Destination | null {
  for (const plan of [student.pm, student.am]) {
    if (plan.destination === "DAYCARE" || plan.destination === "CUSTOM") {
      return plan.destination;
    }
  }
  return student.pm.destination || student.am.destination;
}

export function companyAddressFor(args: {
  kind: CompanyRequestKind;
  student?: EffectiveStudent;
  address?: string;
}) {
  if (args.address?.trim()) return args.address.trim();
  const student = args.student;
  if (!student) return "";
  if (args.kind === "ADDRESS") {
    const value =
      student.pm.customAddress ||
      student.am.customAddress ||
      student.homeAddress;
    return value && value !== "—" ? value : "";
  }
  if (args.kind === "DAYCARE") {
    return student.daycareAddress || "";
  }
  if (args.kind === "NEW_ROUTE") {
    return student.homeAddress && student.homeAddress !== "—"
      ? student.homeAddress
      : "";
  }
  return "";
}

export function companyEffectiveDate(student: EffectiveStudent, trips: Trip[]) {
  const plan = trips.includes("AM") && !trips.includes("PM") ? student.am : student.pm;
  if (plan.source === "TODAY") return "Today only";
  if (plan.source === "DATE_RANGE") {
    if (plan.startDate && plan.endDate) return `${plan.startDate} – ${plan.endDate}`;
    return "Date range";
  }
  if (plan.source === "PERMANENT") return "Permanent";
  return "Until a bus or van is assigned";
}

function requestedChangeLine(trips: Trip[], previous: string, next: string) {
  const trip =
    trips.length > 1
      ? "AM and PM transportation"
      : trips[0] === "AM"
        ? "AM transportation"
        : "PM transportation";
  const from = stripTripPrefix(previous);
  const to = stripTripPrefix(next);
  if (from && to && from !== to) return `${trip} from ${from} to ${to}`;
  if (to) return `${trip} to ${to}`;
  if (from) return `${trip} from ${from}`;
  return trip;
}

function companyNoticeHtml(lines: string[], banner: string) {
  const body = lines
    .map((line) => {
      const idx = line.indexOf(":");
      if (idx === -1) {
        return `<div style="margin:0 0 10px;">${escapeHtml(line)}</div>`;
      }
      const label = line.slice(0, idx + 1);
      const value = line.slice(idx + 1);
      return `<div style="margin:0 0 10px;"><strong>${escapeHtml(label)}</strong>${escapeHtml(value)}</div>`;
    })
    .join("");
  return `<!DOCTYPE html>
<html>
<body style="margin:0;background:#f4f1ea;font-family:Georgia,serif;color:#0e2438;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:24px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border:1px solid #e6e0d4;">
          <tr>
            <td style="background:#0e2438;color:#ffffff;padding:16px 20px;">
              <div style="font-size:18px;font-weight:700;">AMPM Flow</div>
              <div style="font-size:12px;letter-spacing:0.1em;text-transform:uppercase;color:#c9d6c4;">${escapeHtml(banner)}</div>
            </td>
          </tr>
          <tr>
            <td style="padding:20px;font-size:16px;line-height:1.5;">${body}</td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export function companyChangeEmail(args: {
  studentName: string;
  grade: string;
  trips: Trip[];
  previous?: string;
  next: string;
  when: string;
  kind: CompanyRequestKind;
  address?: string;
  amPickup?: string;
  pmPickup?: string;
}) {
  const title = COMPANY_REQUEST_TITLES[args.kind];
  const subject = `${title} — ${args.studentName}`;
  const addressLabel = args.kind === "DAYCARE" ? "Daycare address" : "Address";
  const lines = [
    `Student: ${args.studentName}`,
    `Grade: ${gradeOnly(args.grade)}`,
    `Requested change: ${requestedChangeLine(args.trips, args.previous || "", args.next)}`,
    `Effective date: ${args.when}`,
    args.amPickup ? `AM pickup: ${args.amPickup}` : "",
    args.pmPickup ? `PM pickup: ${args.pmPickup}` : "",
    args.address ? `${addressLabel}: ${args.address}` : "",
  ].filter(Boolean);
  return {
    subject,
    text: lines.join("\n"),
    html: companyNoticeHtml(lines, title),
  };
}

function teacherRideLabel(line: string) {
  const text = stripTripPrefix(line);
  const van = text.match(/Van\s+[A-Za-z0-9-]+/i)?.[0];
  if (van) return van.replace(/^van/i, "Van");
  if (/pending|waiting/i.test(text)) return "Bus pending";
  const bus = text.match(/Bus\s+\d+/i)?.[0];
  if (bus) return bus;
  if (/parent/i.test(text)) return /AM/i.test(line) ? "Parent drop-off" : "Parent pickup";
  return text || "Updated";
}

export function teacherChangeEmail(args: {
  student: EffectiveStudent;
  trips: Trip[];
  previous: string;
  next: string;
  when: string;
}) {
  const tripLabel =
    args.trips.length > 1 ? "AM and PM" : args.trips[0] === "AM" ? "AM" : "PM";
  const subject = `${tripLabel} Transportation Change — ${args.student.fullName}`;
  const grade = `Grade ${gradeOnly(args.student.grade)}`;
  const classroom = args.student.classroomName?.trim();
  const gradeClass =
    classroom &&
    classroom !== "—" &&
    classroom.toLowerCase() !== args.student.teacherName.toLowerCase()
      ? `${grade} · ${classroom}`
      : grade;
  const from = teacherRideLabel(args.previous);
  const to = teacherRideLabel(args.next);
  const change = from && to && from !== to ? `${from} → ${to}` : to || from;
  const lines = [
    `Student: ${args.student.fullName}`,
    `Grade/Class: ${gradeClass}`,
    `Trip: ${tripLabel}`,
    `Change: ${change}`,
    `Effective: ${args.when}`,
  ];
  const banner = `${tripLabel} Transportation Change`;
  const body = lines
    .map((line) => {
      const idx = line.indexOf(":");
      const label = line.slice(0, idx + 1);
      const value = line.slice(idx + 1);
      if (label.startsWith("Change")) {
        return `<div style="margin:14px 0;padding:12px 14px;background:#f4f1ea;border:1px solid #e6e0d4;">
          <div style="font-size:12px;letter-spacing:0.08em;text-transform:uppercase;color:#5c6570;">${escapeHtml(label.replace(":", ""))}</div>
          <div style="margin-top:4px;font-size:20px;font-weight:700;color:#0e2438;">${escapeHtml(value.trim())}</div>
        </div>`;
      }
      return `<div style="margin:0 0 10px;"><strong>${escapeHtml(label)}</strong>${escapeHtml(value)}</div>`;
    })
    .join("");
  return {
    subject,
    text: lines.join("\n"),
    html: `<!DOCTYPE html>
<html>
<body style="margin:0;background:#f4f1ea;font-family:Georgia,serif;color:#0e2438;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:24px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border:1px solid #e6e0d4;">
          <tr>
            <td style="background:#0e2438;color:#ffffff;padding:16px 20px;">
              <div style="font-size:18px;font-weight:700;">AMPM Flow</div>
              <div style="font-size:12px;letter-spacing:0.1em;text-transform:uppercase;color:#c9d6c4;">${escapeHtml(banner)}</div>
            </td>
          </tr>
          <tr>
            <td style="padding:20px;font-size:16px;line-height:1.5;">${body}</td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`,
  };
}

function tripHeading(trips: Trip[]) {
  return trips.length > 1 ? "AM and PM" : trips[0] === "AM" ? "AM" : "PM";
}

function labeledNotice(args: {
  banner: string;
  lines: string[];
  highlight?: string;
}) {
  const body = args.lines
    .map((line) => {
      const idx = line.indexOf(":");
      if (idx === -1) {
        return `<p style="margin:12px 0 0;font-size:15px;color:#0e2438;">${escapeHtml(line)}</p>`;
      }
      const label = line.slice(0, idx + 1);
      const value = line.slice(idx + 1);
      if (args.highlight && label.startsWith(args.highlight)) {
        return `<div style="margin:14px 0;padding:12px 14px;background:#f4f1ea;border:1px solid #e6e0d4;">
          <div style="font-size:12px;letter-spacing:0.08em;text-transform:uppercase;color:#5c6570;">${escapeHtml(label.replace(":", ""))}</div>
          <div style="margin-top:4px;font-size:20px;font-weight:700;color:#0e2438;">${escapeHtml(value.trim())}</div>
        </div>`;
      }
      return `<div style="margin:0 0 10px;"><strong>${escapeHtml(label)}</strong>${escapeHtml(value)}</div>`;
    })
    .join("");
  return `<!DOCTYPE html>
<html>
<body style="margin:0;background:#f4f1ea;font-family:Georgia,serif;color:#0e2438;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:24px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border:1px solid #e6e0d4;">
          <tr>
            <td style="background:#0e2438;color:#ffffff;padding:16px 20px;">
              <div style="font-size:18px;font-weight:700;">AMPM Flow</div>
              <div style="font-size:12px;letter-spacing:0.1em;text-transform:uppercase;color:#c9d6c4;">${escapeHtml(args.banner)}</div>
            </td>
          </tr>
          <tr>
            <td style="padding:20px;font-size:16px;line-height:1.5;">${body}</td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export function parentChangeEmail(args: {
  student: EffectiveStudent;
  trips: Trip[];
  previous: string;
  next: string;
  when: string;
  note: string;
  kind: ParentSmsKind;
  amPickup?: string;
  pmPickup?: string;
}) {
  const tripLabel = tripHeading(args.trips);
  const subject = `${tripLabel} Transportation Change — ${args.student.fullName}`;
  const from = teacherRideLabel(args.previous);
  const to = teacherRideLabel(`${args.next} ${args.note}`);
  const assigned = from && to && from !== to ? `${from} → ${to}` : to || from;
  const waitingNote =
    args.kind === "daycare-request"
      ? "We asked the bus company for a daycare route. We will text you when a bus or van is assigned."
      : args.kind === "address-request"
        ? "We sent the new address to the bus company. We will text you when a bus or van is assigned."
        : args.kind === "ride-request"
          ? "We asked the bus company for a bus or van. We will text you when it is assigned."
          : "";
  const lines = waitingNote
    ? [
        `Student: ${args.student.fullName}`,
        `Trip: ${tripLabel}`,
        `Change: Waiting for a bus or van`,
        waitingNote,
      ]
    : [
        `Student: ${args.student.fullName}`,
        `Trip: ${tripLabel}`,
        `Change: ${assigned}`,
        `Effective: ${args.when}`,
        args.amPickup?.trim() ? `AM pickup: ${args.amPickup.trim()}` : "",
        args.pmPickup?.trim() ? `PM pickup: ${args.pmPickup.trim()}` : "",
      ].filter(Boolean);
  return {
    subject,
    text: lines.join("\n"),
    html: labeledNotice({
      banner: `${tripLabel} Transportation Change`,
      lines,
      highlight: "Change",
    }),
  };
}

export function changeNoticeText(args: {
  student: EffectiveStudent;
  trips: Trip[];
  previous: string;
  next: string;
  when: string;
  note: string;
  actorName: string;
  waiting: boolean;
  amPickup?: string;
  pmPickup?: string;
}) {
  const trips = args.trips.join(" and ");
  return [
    "AMPM Flow — transportation change",
    "",
    `Student: ${args.student.fullName}`,
    `Parent: ${args.student.parentName && args.student.parentName !== "—" ? args.student.parentName : "—"}`,
    `Primary 1 phone: ${args.student.parentPhone || "—"}`,
    args.student.parentPhone2 ? `Primary 2 phone: ${args.student.parentPhone2}` : "",
    `Grade ${String(args.student.grade).replace(/^grade\s+/i, "")} · ${args.student.teacherName}`,
    `Trip: ${trips}`,
    `Was: ${args.previous}`,
    `Now: ${args.next}`,
    `When: ${args.when}`,
    args.waiting ? "Status: Waiting for a bus route until the company confirms it." : "",
    args.amPickup ? `AM pickup: ${args.amPickup}` : "",
    args.pmPickup ? `PM pickup: ${args.pmPickup}` : "",
    args.note ? `Note: ${args.note}` : "",
    `Entered by: ${args.actorName}`,
    "",
    "The dismissal roster is updated. Same-day changes also go out again in the 2:30 p.m. reminder.",
  ]
    .filter((line) => line !== "")
    .join("\n");
}

function changeNoticeHtml(text: string, banner = "Transportation change") {
  return `<!DOCTYPE html>
<html>
<body style="margin:0;background:#f4f1ea;font-family:Georgia,serif;color:#0e2438;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:24px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border:1px solid #e6e0d4;">
          <tr>
            <td style="background:#0e2438;color:#ffffff;padding:16px 20px;">
              <div style="font-size:18px;font-weight:700;">AMPM Flow</div>
              <div style="font-size:12px;letter-spacing:0.1em;text-transform:uppercase;color:#c9d6c4;">${escapeHtml(banner)}</div>
            </td>
          </tr>
          <tr>
            <td style="padding:20px;font-size:15px;line-height:1.5;white-space:pre-wrap;">${escapeHtml(text)}</td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

async function teacherEmails(classroomId: string, extra?: string) {
  const teachers = await prisma.teacher.findMany({
    where: { classroomId },
    select: { email: true },
  });
  return uniqueEmails([
    extra,
    ...teachers.map((teacher) => usableTeacherEmail(teacher.email)),
  ]);
}

export async function notifyTransportationChange(args: {
  user: SessionUser;
  student: EffectiveStudent;
  trips: Trip[];
  previous: string;
  next: string;
  when: string;
  note: string;
  waiting: boolean;
  destination?: Destination;
  parentSms?: ParentSmsKind;
  teacherEmail?: string;
  busCompanyEmail?: string;
  notifySchool?: boolean;
  schoolId?: string;
  amPickup?: string;
  pmPickup?: string;
}): Promise<ChangeNotice> {
  const sent: string[] = [];
  const skipped: string[] = [];
  const text = changeNoticeText({
    student: args.student,
    trips: args.trips,
    previous: args.previous,
    next: args.next,
    when: args.when,
    note: args.note,
    actorName: args.user.name,
    waiting: args.waiting,
    amPickup: args.amPickup,
    pmPickup: args.pmPickup,
  });
  const html = changeNoticeHtml(text);
  const kind = companyRequestKind({
    destination:
      args.destination || destinationFromStudent(args.student),
    waiting: args.waiting,
    enrollmentSource: args.student.enrollmentSource,
  });
  const companyMail = companyChangeEmail({
    studentName: args.student.fullName,
    grade: args.student.grade,
    trips: args.trips,
    previous: args.previous,
    next: args.next,
    when: args.when,
    kind,
    address: companyAddressFor({ kind, student: args.student }),
    amPickup: args.amPickup,
    pmPickup: args.pmPickup,
  });
  const teacherMail = teacherChangeEmail({
    student: args.student,
    trips: args.trips,
    previous: args.previous,
    next: args.next,
    when: args.when,
  });

  const parent = uniqueEmails([args.student.parentEmail]);
  const company = uniqueEmails([args.busCompanyEmail]);
  const teachers = await teacherEmails(
    args.student.classroomId,
    args.teacherEmail,
  );
  const schoolDesk =
    args.notifySchool && args.schoolId
      ? await schoolStaffEmails(args.schoolId)
      : [];

  if (!parent.length) skipped.push("parent (required)");
  if (!teachers.length) skipped.push("teacher (required)");
  if (!company.length) skipped.push("bus company (required)");
  if (args.notifySchool && !schoolDesk.length) {
    skipped.push("school (coordinator or front desk email needed)");
  }

  const smsKind =
    args.parentSms ||
    (args.waiting && args.destination === "DAYCARE"
      ? "daycare-request"
      : args.waiting && args.destination === "CUSTOM"
        ? "address-request"
        : args.waiting
          ? "ride-request"
          : "assigned");
  const smsBody = parentChangeSms({
    student: args.student,
    next: args.next,
    note: args.note,
    when: args.when,
    kind: smsKind,
    amPickup: args.amPickup,
    pmPickup: args.pmPickup,
  });
  const parentMail = parentChangeEmail({
    student: args.student,
    trips: args.trips,
    previous: args.previous,
    next: args.next,
    when: args.when,
    note: args.note,
    kind: smsKind,
    amPickup: args.amPickup,
    pmPickup: args.pmPickup,
  });
  const parentPhones = parentSmsNumbers(
    args.student.parentPhone,
    args.student.parentPhone2,
  );

  const jobs: Array<Promise<void>> = [];
  if (!smtpConfigured()) {
    skipped.push("email is not configured");
  } else {
    const groups = [
      {
        label: "parent",
        to: parent,
        subject: parentMail.subject,
        text: parentMail.text,
        html: parentMail.html,
      },
      {
        label: "teacher",
        to: teachers,
        subject: teacherMail.subject,
        text: teacherMail.text,
        html: teacherMail.html,
      },
      {
        label: "bus company",
        to: company,
        subject: companyMail.subject,
        text: companyMail.text,
        html: companyMail.html,
      },
      {
        label: "school",
        to: schoolDesk,
        subject: `Bus update — ${args.student.fullName}`,
        text,
        html,
      },
    ];
    for (const group of groups) {
      if (!group.to.length) continue;
      jobs.push(
        sendMail({
          to: group.to,
          subject: group.subject,
          text: group.text,
          html: group.html,
        }).then((result) => {
          if (result.sent) {
            sent.push(...group.to.map((email) => `${group.label}: ${email}`));
          } else {
            skipped.push(`${group.label} (${result.reason})`);
          }
        }),
      );
    }
  }

  if (!parentPhones.length) {
    skipped.push("parent text (phone required)");
  } else if (!smsConfigured()) {
    skipped.push("parent text (Twilio is not set)");
  } else {
    jobs.push(
      sendSms({ to: parentPhones, body: smsBody }).then((texted) => {
        if (texted.sent) {
          sent.push(
            ...texted.recipients.map((phone) => `parent text: ${phone}`),
          );
        }
        if (texted.errors.length) {
          skipped.push(
            ...texted.errors.map((error) => `parent text (${error})`),
          );
        } else if (!texted.sent) {
          skipped.push(`parent text (${texted.reason})`);
        }
      }),
    );
  }
  await Promise.all(jobs);

  await writeAudit({
    user: args.user,
    studentId: args.student.id,
    action: "EMAIL_CHANGE_NOW",
    trip: args.trips.join("+"),
    newPlan: {
      sent,
      skipped,
      next: args.next,
      when: args.when,
    },
  }).catch(() => undefined);

  return { sent, skipped, waiting: args.waiting };
}

export async function notifyStudentLeft(args: {
  user: SessionUser;
  student: EffectiveStudent;
  previous: string;
  reason: string;
  note: string;
  teacherEmail?: string;
  busCompanyEmail?: string;
}): Promise<ChangeNotice> {
  const sent: string[] = [];
  const skipped: string[] = [];
  const text = [
    "AMPM Flow — student left",
    "",
    `Student: ${args.student.fullName}`,
    `Parent: ${args.student.parentName && args.student.parentName !== "—" ? args.student.parentName : "—"}`,
    `Primary 1 phone: ${args.student.parentPhone || "—"}`,
    args.student.parentPhone2 ? `Primary 2 phone: ${args.student.parentPhone2}` : "",
    `Grade ${String(args.student.grade).replace(/^grade\s+/i, "")} · ${args.student.teacherName}`,
    `Was: ${args.previous}`,
    `Now: Removed from the transportation list`,
    `Reason: ${args.reason}`,
    args.note ? `Note: ${args.note}` : "",
    `Entered by: ${args.user.name}`,
    "",
    "Please take this student off morning pickup and afternoon dismissal.",
  ]
    .filter((line) => line !== "")
    .join("\n");
  const html = changeNoticeHtml(text, "Student left");
  const subject = `Student left — ${args.student.fullName}`;

  const parent = uniqueEmails([args.student.parentEmail]);
  const company = uniqueEmails([args.busCompanyEmail]);
  const teachers = await teacherEmails(
    args.student.classroomId,
    args.teacherEmail,
  );

  if (!parent.length) skipped.push("parent (required)");
  if (!teachers.length) skipped.push("teacher (required)");
  if (!company.length) skipped.push("bus company (required)");

  const smsBody = bilingualSms(
    [
      `AMPM Flow: ${args.student.fullName} is no longer on the school transportation list`,
      args.reason,
    ]
      .filter(Boolean)
      .join(". "),
    `${args.student.fullName} kama sii jiro liiska gaadiidka dugsiga.`,
  );
  const parentPhones = parentSmsNumbers(
    args.student.parentPhone,
    args.student.parentPhone2,
  );

  const jobs: Array<Promise<void>> = [];
  if (!smtpConfigured()) {
    skipped.push("email is not configured");
  } else {
    const groups = [
      { label: "parent", to: parent },
      { label: "teacher", to: teachers },
      { label: "bus company", to: company },
    ];
    for (const group of groups) {
      if (!group.to.length) continue;
      jobs.push(
        sendMail({
          to: group.to,
          subject,
          text,
          html,
        }).then((result) => {
          if (result.sent) {
            sent.push(...group.to.map((email) => `${group.label}: ${email}`));
          } else {
            skipped.push(`${group.label} (${result.reason})`);
          }
        }),
      );
    }
  }

  if (!parentPhones.length) {
    skipped.push("parent text (phone required)");
  } else if (!smsConfigured()) {
    skipped.push("parent text (Twilio is not set)");
  } else {
    jobs.push(
      sendSms({ to: parentPhones, body: smsBody }).then((texted) => {
        if (texted.sent) {
          sent.push(
            ...texted.recipients.map((phone) => `parent text: ${phone}`),
          );
        }
        if (texted.errors.length) {
          skipped.push(
            ...texted.errors.map((error) => `parent text (${error})`),
          );
        } else if (!texted.sent) {
          skipped.push(`parent text (${texted.reason})`);
        }
      }),
    );
  }
  await Promise.all(jobs);

  await writeAudit({
    user: args.user,
    studentId: args.student.id,
    action: "EMAIL_STUDENT_LEFT",
    newPlan: { sent, skipped, reason: args.reason, note: args.note },
  }).catch(() => undefined);

  return { sent, skipped, waiting: false };
}

export async function notifyRouteRequest(args: {
  user: SessionUser;
  studentName: string;
  studentId?: string;
  grade: string;
  teacherName: string;
  parentPhone: string;
  parentEmail: string;
  busCompanyEmail: string;
  address: string;
  emergency: string;
}): Promise<ChangeNotice> {
  const sent: string[] = [];
  const skipped: string[] = [];
  const companyMail = companyChangeEmail({
    studentName: args.studentName,
    grade: args.grade,
    trips: ["AM", "PM"],
    next: args.address || "new bus or van route",
    when: "Until a bus or van is assigned",
    kind: "NEW_ROUTE",
    address: args.address,
  });

  const parentLines = [
    `Student: ${args.studentName}`,
    `Trip: AM and PM`,
    `Change: Waiting for a bus or van`,
    "We asked the bus company for a bus or van. We will text you when it is assigned.",
  ];
  const parentMail = {
    subject: `AM and PM Transportation Change — ${args.studentName}`,
    text: parentLines.join("\n"),
    html: labeledNotice({
      banner: "AM and PM Transportation Change",
      lines: parentLines,
      highlight: "Change",
    }),
  };

  const parent = uniqueEmails([args.parentEmail]);
  const company = uniqueEmails([args.busCompanyEmail]);
  if (!parent.length) skipped.push("parent (email required)");
  if (!company.length) skipped.push("bus company (email required)");
  if (!smtpConfigured()) {
    skipped.push("email is not configured");
  } else {
    const groups = [
      {
        label: "parent",
        to: parent,
        subject: parentMail.subject,
        text: parentMail.text,
        html: parentMail.html,
      },
      {
        label: "bus company",
        to: company,
        subject: companyMail.subject,
        text: companyMail.text,
        html: companyMail.html,
      },
    ];

    for (const group of groups) {
      if (!group.to.length) continue;
      const result = await sendMail({
        to: group.to,
        subject: group.subject,
        text: group.text,
        html: group.html || changeNoticeHtml(group.text, "Request"),
      });
      if (result.sent) {
        sent.push(...group.to.map((email) => `${group.label}: ${email}`));
      } else {
        skipped.push(`${group.label} (${result.reason})`);
      }
    }
  }

  const requestPhones = parentSmsNumbers(args.parentPhone);
  if (requestPhones.length && smsConfigured()) {
    const texted = await sendSms({
      to: requestPhones,
      body: bilingualSms(
        `AMPM Flow: we requested a bus or van for ${args.studentName}. The school will update you when the number is on file.`,
        `${args.studentName}: ${REQUEST_SO}`,
      ),
    });
    if (texted.sent) {
      sent.push(...texted.recipients.map((phone) => `parent text: ${phone}`));
    }
    if (texted.errors.length) {
      skipped.push(
        ...texted.errors.map((error) => `parent text (${error})`),
      );
    } else if (!texted.sent) {
      skipped.push(`parent text (${texted.reason})`);
    }
  }

  await writeAudit({
    user: args.user,
    studentId: args.studentId,
    action: "EMAIL_ROUTE_REQUEST",
    newPlan: { sent, skipped },
  }).catch(() => undefined);
  return { sent, skipped, waiting: true };
}

export function noticeSummary(notice: ChangeNotice, extra?: string) {
  const parts = [];
  if (notice.waiting) {
    parts.push("Marked Waiting for Route until the bus company confirms it.");
  }
  const emailed = notice.sent.filter((item) => !item.startsWith("parent text"));
  const texted = notice.sent.filter((item) => item.startsWith("parent text"));
  if (emailed.length) {
    parts.push(`Emailed ${emailed.join(", ")}.`);
  }
  if (texted.length) {
    parts.push(`Texted ${texted.join(", ")}.`);
  }
  if (notice.skipped.length) {
    parts.push(`Could not send ${notice.skipped.join(", ")}.`);
  }
  parts.push(extra || "Same-day changes also go out again in the 2:30 p.m. reminder.");
  return parts.join(" ");
}

/** Do not block the UI on SMTP/Twilio — send after the action returns. */
export function scheduleChangeNotify(job: Promise<unknown>) {
  // after() keeps the Vercel worker alive so mail/SMS still go out.
  after(() => job.then(() => undefined, () => undefined));
}

export function queuedNoticeMessage(waiting: boolean, extra?: string) {
  const parts: string[] = [];
  if (waiting) {
    parts.push("Marked Waiting for Route until the bus company confirms it.");
  }
  parts.push("Saved. Emails and parent texts are sending in the background.");
  if (extra) parts.push(extra);
  else parts.push("Same-day changes also go out again in the 2:30 p.m. reminder.");
  return parts.join(" ");
}

export function planLine(student: EffectiveStudent, trips: Trip[]) {
  return trips
    .map((trip) => {
      const plan = trip === "AM" ? student.am : student.pm;
      return `${trip}: ${planSummary(plan, trip)}`;
    })
    .join(" · ");
}
