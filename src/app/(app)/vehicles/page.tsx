import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import {
  AIM_FLEET_LABELS,
  ensureAimFleetVehicles,
  isAimSchool,
} from "@/lib/aim-fleet";
import { loadGateRoster, loadVehicles } from "@/lib/gate";
import { prisma } from "@/lib/prisma";
import { VehicleDirectory } from "./VehicleDirectory";

export const dynamic = "force-dynamic";

export default async function VehiclesPage() {
  const session = await getSession();
  if (
    !session ||
    (session.role !== "ADMINISTRATOR" && session.role !== "COORDINATOR")
  ) {
    redirect("/gate");
  }

  const school = await prisma.school.findUnique({
    where: { id: session.schoolId },
    select: { name: true },
  });
  const aim = isAimSchool(school?.name);

  const [rawVehicles, students] = await Promise.all([
    aim
      ? ensureAimFleetVehicles(session.schoolId)
      : loadVehicles(session.schoolId),
    loadGateRoster(session.schoolId),
  ]);

  const fleetKeys = new Set(
    AIM_FLEET_LABELS.map((label) => label.toLowerCase()),
  );
  const vehicles = aim
    ? rawVehicles.filter((vehicle) =>
        fleetKeys.has(vehicle.name.trim().toLowerCase()),
      )
    : rawVehicles;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-4xl">Transportation vehicles</h1>
        <p className="mt-2 max-w-3xl text-muted">
          {aim
            ? "Aim / Minnehaha runs three buses only: Bus 4, Bus 5, and the 3rd bus (name coming later). No vans."
            : "Driver name and phone live on the vehicle, not on each student. Assigned Vehicle/Route defaults to Not Assigned and is optional for first-day arrival and dismissal."}
        </p>
      </div>
      <VehicleDirectory vehicles={vehicles} students={students} />
    </div>
  );
}
