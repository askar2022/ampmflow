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
        <h1 className="font-serif text-4xl">Reports</h1>
        <p className="mt-1 max-w-2xl text-muted">
          Search one bus or van at a time, like Front Desk. See those students,
          then print or email that list to the driver. Parent pickup stays off
          these lists.
        </p>
        <p className="mt-2 text-sm font-semibold text-navy">
          {lists.buses.length} bus{lists.buses.length === 1 ? "" : "es"}
          {lists.vans.length ? ` · ${lists.vans.length} van${lists.vans.length === 1 ? "" : "s"}` : ""}
          {` · ${lists.riders.length} on the roster`}
        </p>
      </div>
      <DriverLists
        riders={lists.riders}
        buses={lists.buses}
        vans={lists.vans}
      />
    </div>
  );
}
