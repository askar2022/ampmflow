import { getSession } from "@/lib/auth";
import { AIM_FLEET_LABELS, isAimSchool } from "@/lib/aim-fleet";
import { prisma } from "@/lib/prisma";
import { loadStudents } from "@/lib/transportation";
import { ReceptionDesk } from "./ReceptionDesk";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ student?: string }>;
}) {
  const session = await getSession();
  if (!session) return null;
  const { student: selectedId = "" } = await searchParams;

  // One parallel round-trip — no fleet rewrite or settings DDL on open.
  const [school, students, routes, vanRows, vehicleRows, settings] =
    await Promise.all([
      prisma.school.findUnique({
        where: { id: session.schoolId },
        select: { name: true },
      }),
      loadStudents(session.schoolId),
      prisma.busRoute.findMany({
        where: { schoolId: session.schoolId },
        select: { number: true },
        orderBy: { number: "asc" },
      }),
      prisma.student.findMany({
        where: {
          schoolId: session.schoolId,
          active: true,
          vehicleId: { not: null },
        },
        select: { id: true, vehicleId: true },
      }),
      prisma.$queryRaw<
        Array<{ id: string; name: string; vehicleType: string }>
      >`
        SELECT "id", "name", "vehicleType"
        FROM "TransportVehicle"
        WHERE "schoolId" = ${session.schoolId}
        ORDER BY "name"
      `.catch(() => []),
      prisma.$queryRaw<Array<{ busCompanyEmail: string }>>`
        SELECT "busCompanyEmail"
        FROM "SchoolSettings"
        WHERE "schoolId" = ${session.schoolId}
        LIMIT 1
      `.catch(() => []),
    ]);

  const aim = isAimSchool(school?.name);

  const buses = aim
    ? AIM_FLEET_LABELS.map((label) =>
        label.replace(/^Bus\s+/i, "").trim() || label,
      )
    : [...new Set(routes.map((route) => route.number))];

  const vans = aim
    ? []
    : vehicleRows
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
        busCompanyEmail={settings[0]?.busCompanyEmail || ""}
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
