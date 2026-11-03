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
        <h1 className="font-serif text-4xl text-navy">Reports</h1>
        <p className="mt-2 max-w-3xl text-muted">
          Select a bus or van to view its student roster. You can print the
          roster or email it directly to the driver. Parent Pickup students
          are excluded.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-[12px] border border-line bg-card px-4 py-3 shadow-sm">
          <p className="font-serif text-3xl leading-none text-navy">
            {lists.buses.length}
          </p>
          <p className="mt-1 text-sm font-semibold text-muted">Buses</p>
        </div>
        <div className="rounded-[12px] border border-line bg-card px-4 py-3 shadow-sm">
          <p className="font-serif text-3xl leading-none text-navy">
            {lists.vans.length}
          </p>
          <p className="mt-1 text-sm font-semibold text-muted">Vans</p>
        </div>
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
      />
    </div>
  );
}
