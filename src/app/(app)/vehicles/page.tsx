import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { loadGateRoster, loadVehicles } from "@/lib/gate";
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

  const [vehicles, students] = await Promise.all([
    loadVehicles(session.schoolId),
    loadGateRoster(session.schoolId),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-4xl">Transportation vehicles</h1>
        <p className="mt-2 max-w-3xl text-muted">
          Driver name and phone live on the vehicle, not on each student.
          Assigned Vehicle/Route defaults to Not Assigned and is optional for
          first-day arrival and dismissal.
        </p>
      </div>
      <VehicleDirectory vehicles={vehicles} students={students} />
    </div>
  );
}
