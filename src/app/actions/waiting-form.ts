"use server";

import { getSession } from "@/lib/auth";
import { formatAddress } from "@/lib/format";
import { usableOpsEmail } from "@/lib/ops-change-emails";
import { prisma } from "@/lib/prisma";

export type WaitingRequestStudent = {
  id: string;
  fullName: string;
  parentPhone: string;
  parentPhone2: string;
  parentEmail: string;
  teacherEmail: string;
  homeAddress: string;
  daycareName: string;
  daycareAddress: string;
  daycarePhone: string;
};

export type WaitingFormBootstrap = {
  busCompanyEmail: string;
  coordinatorEmail: string;
  frontDeskEmail: string;
  students: WaitingRequestStudent[];
};

async function peekEmails(schoolId: string) {
  const [settings, companyUsers, deskUsers] = await Promise.all([
    prisma.$queryRaw<
      Array<{
        busCompanyEmail: string;
        coordinatorEmail: string;
        frontDeskEmail: string;
      }>
    >`
      SELECT "busCompanyEmail", "coordinatorEmail", "frontDeskEmail"
      FROM "SchoolSettings"
      WHERE "schoolId" = ${schoolId}
      LIMIT 1
    `.catch(() => []),
    prisma.user.findMany({
      where: { schoolId, active: true, role: "BUS_COMPANY" },
      select: { email: true },
      take: 3,
    }),
    prisma.user.findMany({
      where: {
        schoolId,
        active: true,
        role: { in: ["COORDINATOR", "FRONT_DESK"] },
      },
      select: { role: true, email: true },
    }),
  ]);

  const row = settings[0];
  let busCompanyEmail = usableOpsEmail(row?.busCompanyEmail || "");
  if (!busCompanyEmail) {
    busCompanyEmail =
      companyUsers.map((user) => usableOpsEmail(user.email)).find(Boolean) ||
      "";
  }

  let coordinatorEmail = usableOpsEmail(row?.coordinatorEmail || "");
  let frontDeskEmail = usableOpsEmail(row?.frontDeskEmail || "");
  if (!coordinatorEmail) {
    coordinatorEmail = usableOpsEmail(
      deskUsers.find((user) => user.role === "COORDINATOR")?.email || "",
    );
  }
  if (!frontDeskEmail) {
    frontDeskEmail = usableOpsEmail(
      deskUsers.find((user) => user.role === "FRONT_DESK")?.email || "",
    );
  }

  return { busCompanyEmail, coordinatorEmail, frontDeskEmail };
}

async function loadRequestStudents(
  schoolId: string,
): Promise<WaitingRequestStudent[]> {
  const rows = await prisma.student.findMany({
    where: { schoolId, active: true },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      parentPhone: true,
      parentPhone2: true,
      parentEmail: true,
      homeAddress: {
        select: { line1: true, city: true, state: true, zip: true },
      },
      daycare: {
        select: {
          name: true,
          phone: true,
          address: {
            select: { line1: true, city: true, state: true, zip: true },
          },
        },
      },
      classroom: {
        select: {
          teachers: { select: { email: true }, take: 1 },
        },
      },
    },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
  });

  return rows.map((row) => ({
    id: row.id,
    fullName: `${row.firstName} ${row.lastName}`.trim(),
    parentPhone: row.parentPhone || "",
    parentPhone2: row.parentPhone2 || "",
    parentEmail: row.parentEmail || "",
    teacherEmail: row.classroom.teachers[0]?.email || "",
    homeAddress: formatAddress(row.homeAddress),
    daycareName: row.daycare?.name || "",
    daycareAddress: row.daycare?.address
      ? formatAddress(row.daycare.address)
      : "",
    daycarePhone: row.daycare?.phone || "",
  }));
}

/** Used after the form paints so Continue opens instantly. */
export async function bootstrapWaitingForm(): Promise<WaitingFormBootstrap> {
  const empty: WaitingFormBootstrap = {
    busCompanyEmail: "",
    coordinatorEmail: "",
    frontDeskEmail: "",
    students: [],
  };
  const session = await getSession();
  if (!session) return empty;

  const [emails, students] = await Promise.all([
    peekEmails(session.schoolId),
    loadRequestStudents(session.schoolId).catch(
      () => [] as WaitingRequestStudent[],
    ),
  ]);

  return { ...emails, students };
}

export async function bootstrapRouteFormEmail() {
  const session = await getSession();
  if (!session) return "";
  const emails = await peekEmails(session.schoolId);
  return emails.busCompanyEmail;
}
