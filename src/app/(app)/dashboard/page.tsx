import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { loadVehicles } from "@/lib/gate";
import { loadStudents } from "@/lib/transportation";
import { ReceptionDesk } from "./ReceptionDesk";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ student?: string }>;
}) {
  const session = await getSession();
  if (!session) return null;
  const { student: selectedId = "" } = await searchParams;

  const students = await loadStudents(session.schoolId);
  const [routes, vehicles, vanRows] = await Promise.all([
    prisma.busRoute.findMany({
      where: { schoolId: session.schoolId },
      select: { number: true },
      orderBy: { number: "asc" },
    }),
    loadVehicles(session.schoolId).catch(() => []),
    prisma.student.findMany({
      where: { schoolId: session.schoolId, vehicleId: { not: null } },
      select: { id: true, vehicleId: true },
    }),
  ]);
  const buses = [...new Set(routes.map((route) => route.number))];
  const vans = vehicles
    .filter(
      (vehicle) =>
        vehicle.vehicleType.toUpperCase() === "VAN" || /van/i.test(vehicle.name),
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
        studentVanId={studentVanId}
        initialStudentId={selectedId}
        canPermanent={session.role === "ADMINISTRATOR" || session.role === "COORDINATOR"}
        canSeeEmergency={
          session.role === "ADMINISTRATOR" ||
          session.role === "COORDINATOR" ||
          session.role === "FRONT_DESK"
        }
      />
    </div>
  );
}
