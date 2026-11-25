import { usableOpsEmail } from "./ops-change-emails";
import { usableTeacherEmail } from "./teacher-snapshot";

/** Exact emails/phones the school entered on one Open request. */
export type RequestNotifyEmails = {
  parentEmail: string;
  parentPhone: string;
  parentPhone2: string;
  teacherEmail: string;
  busCompanyEmail: string;
  coordinatorEmail: string;
  frontDeskEmail: string;
};

export function emptyRequestNotifyEmails(): RequestNotifyEmails {
  return {
    parentEmail: "",
    parentPhone: "",
    parentPhone2: "",
    teacherEmail: "",
    busCompanyEmail: "",
    coordinatorEmail: "",
    frontDeskEmail: "",
  };
}

/** Snapshot stored on ChangeRequest.payload when the school submits. */
export function requestNotifyEmailsPayload(emails: {
  parentEmail?: string;
  parentPhone?: string;
  parentPhone2?: string;
  teacherEmail?: string;
  busCompanyEmail?: string;
  coordinatorEmail?: string;
  frontDeskEmail?: string;
}) {
  return {
    parentEmail: usableOpsEmail(emails.parentEmail || ""),
    parentPhone: (emails.parentPhone || "").trim(),
    parentPhone2: (emails.parentPhone2 || "").trim(),
    teacherEmail: usableTeacherEmail(emails.teacherEmail || ""),
    busCompanyEmail: usableOpsEmail(emails.busCompanyEmail || ""),
    coordinatorEmail: usableOpsEmail(emails.coordinatorEmail || ""),
    frontDeskEmail: usableOpsEmail(emails.frontDeskEmail || ""),
  };
}

/** Read only the emails saved on that request — never school-wide defaults. */
export function parseRequestNotifyEmails(
  payload: string | null | undefined,
): RequestNotifyEmails {
  const empty = emptyRequestNotifyEmails();
  if (!payload) return empty;
  try {
    const parsed = JSON.parse(payload) as {
      emails?: Partial<RequestNotifyEmails>;
      parentEmail?: string;
      parentPhone?: string;
      parentPhone2?: string;
      teacherEmail?: string;
      busCompanyEmail?: string;
      coordinatorEmail?: string;
      frontDeskEmail?: string;
    };
    const raw = parsed.emails || parsed;
    return {
      parentEmail: usableOpsEmail(raw.parentEmail || ""),
      parentPhone: String(raw.parentPhone || "").trim(),
      parentPhone2: String(raw.parentPhone2 || "").trim(),
      teacherEmail: usableTeacherEmail(raw.teacherEmail || ""),
      busCompanyEmail: usableOpsEmail(raw.busCompanyEmail || ""),
      coordinatorEmail: usableOpsEmail(raw.coordinatorEmail || ""),
      frontDeskEmail: usableOpsEmail(raw.frontDeskEmail || ""),
    };
  } catch {
    return empty;
  }
}

export function requestHasNotifyEmails(emails: RequestNotifyEmails) {
  return Boolean(
    emails.parentEmail ||
      emails.teacherEmail ||
      emails.busCompanyEmail ||
      emails.coordinatorEmail ||
      emails.frontDeskEmail ||
      emails.parentPhone ||
      emails.parentPhone2,
  );
}
