import { getSession } from "@/lib/auth";
import { loadDriverLists } from "@/lib/ridership";
import { DriverLists } from "./DriverLists";

export default async function PrintPage() {
  const session = await getSession();
  if (!session) return null;
  const lists = await loadDriverLists(session.schoolId);
  const fleetBusCount = lists.fleetVehicles.filter((v) => v.kind === "bus").length;
  const vanCount = lists.aimSchool
    ? 0
    : lists.fleetVehicles.filter((v) => v.kind === "van").length;
  const busCount = lists.buses.length + fleetBusCount;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-4xl text-navy">Print list</h1>
        <p className="mt-2 max-w-3xl text-muted">
          Print for drivers in case they do not have the student roster from the
          bus company.
        </p>
      </div>

      <div
        className={`grid gap-3 ${vanCount > 0 ? "sm:grid-cols-3" : "sm:grid-cols-2"}`}
      >
        <div className="rounded-[12px] border border-line bg-card px-4 py-3 shadow-sm">
          <p className="font-serif text-3xl leading-none text-navy">
            {busCount}
          </p>
          <p className="mt-1 text-sm font-semibold text-muted">Buses</p>
        </div>
        {vanCount > 0 ? (
          <div className="rounded-[12px] border border-line bg-card px-4 py-3 shadow-sm">
            <p className="font-serif text-3xl leading-none text-navy">
              {vanCount}
            </p>
            <p className="mt-1 text-sm font-semibold text-muted">Vans</p>
          </div>
        ) : null}
        <div className="rounded-[12px] border border-line bg-card px-4 py-3 shadow-sm">
          <p className="font-serif text-3xl leading-none text-navy">
            {lists.riders.length}
          </p>
          <p className="mt-1 text-sm font-semibold text-muted">
            Students Assigned
          </p>
          <span className="mt-2 block h-1 w-8 rounded-full bg-[#f4d35e]" />
        </div>
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
