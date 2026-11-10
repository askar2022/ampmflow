import { getSession } from "@/lib/auth";
import { loadDriverLists } from "@/lib/ridership";
import { DriverLists } from "./DriverLists";

export default async function PrintPage() {
  const session = await getSession();
  if (!session) return null;
  const lists = await loadDriverLists(session.schoolId);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-4xl text-navy">Print list</h1>
        <p className="mt-2 max-w-3xl text-muted">
          Print for drivers in case they do not have the student roster from the
          bus company.
        </p>
      </div>

      <DriverLists
        riders={lists.riders}
        buses={lists.buses}
        vans={lists.vans}
        busDrivers={lists.busDrivers}
        aimSchool={lists.aimSchool}
      />
    </div>
  );
}
