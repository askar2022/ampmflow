import { getSession } from "@/lib/auth";
import {
  defaultBusCompanyEmail,
  loadSchoolDeskNotifyEmails,
} from "@/lib/ops-change-emails";
import { formatAddress } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { ensureStudentContactColumns } from "@/lib/transportation";
import { RequestHub } from "./RequestHub";
import { RouteRequestForm } from "./RouteRequestForm";
import {
  StudentChangeRequestForm,
  type RequestStudent,
} from "./StudentChangeRequestForm";

export const dynamic = "force-dynamic";

export default async function WaitingPage({
  searchParams,
}: {
  searchParams: Promise<{ kind?: string; student?: string }>;
}) {
  const session = await getSession();
  if (!session) return null;
  const { kind = "", student: startStudentId = "" } = await searchParams;

  const [busCompanyEmail, deskEmails] = await Promise.all([
    defaultBusCompanyEmail(session.schoolId),
    loadSchoolDeskNotifyEmails(session.schoolId),
  ]);

  if (kind === "route") {
    return <RouteRequestForm busCompanyEmail={busCompanyEmail} />;
  }

  if (kind === "daycare" || kind === "address") {
    await ensureStudentContactColumns().catch(() => undefined);
    const rows = await prisma.student.findMany({
      where: { schoolId: session.schoolId, active: true },
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
            address: { select: { line1: true, city: true, state: true, zip: true } },
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

    const students: RequestStudent[] = rows.map((row) => ({
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

    return (
      <StudentChangeRequestForm
        kind={kind}
        students={students}
        initialStudentId={startStudentId}
        busCompanyEmail={busCompanyEmail}
        coordinatorEmail={deskEmails.coordinatorEmail}
        frontDeskEmail={deskEmails.frontDeskEmail}
        canPermanent={
          session.role === "ADMINISTRATOR" || session.role === "COORDINATOR"
        }
      />
    );
  }

  return <RequestHub />;
}
