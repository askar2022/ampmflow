import { getSession } from "@/lib/auth";
import {
  AIM_FLEET_LABELS,
  ensureAimFleetVehicles,
  isAimSchool,
} from "@/lib/aim-fleet";
import { prisma } from "@/lib/prisma";
import { loadVehicles } from "@/lib/gate";
import {
  defaultBusCompanyEmail,
  loadSchoolDeskNotifyEmails,
} from "@/lib/ops-change-emails";
import { loadStudents } from "@/lib/transportation";
import { ReceptionDesk } from "./ReceptionDesk";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ student?: string }>;
}) {
  const session = await getSession();
  if (!session) return null;
  const { student: selectedId = "" } = await searchParams;

  const school = await prisma.school.findUnique({
    where: { id: session.schoolId },
    select: { name: true },
  });
  const aim = isAimSchool(school?.name);

  const students = await loadStudents(session.schoolId);
  const [routes, vehicles, vanRows, busCompanyEmail, deskEmails] =
    await Promise.all([
      prisma.busRoute.findMany({
        where: { schoolId: session.schoolId },
        select: { number: true },
        orderBy: { number: "asc" },
      }),
      (aim
        ? ensureAimFleetVehicles(session.schoolId)
        : loadVehicles(session.schoolId)
      ).catch(() => []),
      prisma.student.findMany({
        where: {
          schoolId: session.schoolId,
          active: true,
          vehicleId: { not: null },
        },
        select: { id: true, vehicleId: true },
      }),
      defaultBusCompanyEmail(session.schoolId),
      loadSchoolDeskNotifyEmails(session.schoolId),
    ]);

  const buses = aim
    ? AIM_FLEET_LABELS.map((label) =>
        label.replace(/^Bus\s+/i, "").trim() || label,
      )
    : [...new Set(routes.map((route) => route.number))];

  const vans = aim
    ? []
    : vehicles
        .filter(
          (vehicle) =>
            vehicle.vehicleType.toUpperCase() === "VAN" ||
            /van/i.test(vehicle.name),
        )
        .map((vehicle) => ({ id: vehicle.id, name: vehicle.name }));

  const studentVanId = Object.fromEntries(
    vanRows
      .filter((row) => row.vehicleId)
      .map((row) => [row.id, row.vehicleId as string]),
  );

  return (
    <div>
      <ReceptionDesk
        students={students}
        buses={buses}
        vans={vans}
        aimSchool={aim}
        studentVanId={studentVanId}
        busCompanyEmail={busCompanyEmail}
        coordinatorEmail={deskEmails.coordinatorEmail}
        frontDeskEmail={deskEmails.frontDeskEmail}
        initialStudentId={selectedId}
        canPermanent={
          session.role === "ADMINISTRATOR" || session.role === "COORDINATOR"
        }
        canSeeEmergency={
          session.role === "ADMINISTRATOR" ||
          session.role === "COORDINATOR" ||
          session.role === "FRONT_DESK"
        }
      />
    </div>
  );
}
