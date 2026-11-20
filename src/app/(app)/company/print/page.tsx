import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { loadCompanySchools } from "@/lib/company-access";
import { loadDriverLists } from "@/lib/ridership";
import { companyFleetForSchool } from "@/lib/school-fleet";
import { DriverLists } from "@/app/(app)/print/DriverLists";
import { CompanyPrintSchoolPicker } from "./CompanyPrintSchoolPicker";

export const dynamic = "force-dynamic";

export default async function CompanyPrintPage({
  searchParams,
}: {
  searchParams: Promise<{ school?: string }>;
}) {
  const session = await getSession();
  if (!session) return null;
  if (session.role !== "BUS_COMPANY") redirect("/print");

  const { school: wanted } = await searchParams;
  const schools = await loadCompanySchools(session);
  const selected =
    schools.find((school) => school.id === wanted || school.slug === wanted) ||
    schools[0];
  const companyName = session.name || "Bus company";

  if (!selected) {
    return (
      <div>
        <h1 className="font-serif text-4xl text-navy">{companyName}</h1>
        <p className="mt-1 text-lg font-semibold text-navy">Print list</p>
        <p className="mt-2 text-muted">
          No school is assigned to this login yet. Ask AMPM Flow to add the
          schools you serve.
        </p>
      </div>
    );
  }

  const lists = await loadDriverLists(selected.id);
  const fleet = companyFleetForSchool(selected.name);

  const buses = fleet?.locked
    ? [
        ...new Set([...fleet.buses, ...lists.buses]),
      ].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
    : lists.buses;

  // Prefer real TransportVehicle rows so student vanId matches; fill gaps from fleet.
  const vansByName = new Map(
    lists.vans.map((van) => [van.name.trim().toLowerCase(), van]),
  );
  const vans = fleet?.locked
    ? fleet.vans.map((slot) => {
        const existing = vansByName.get(slot.name.trim().toLowerCase());
        return existing || { id: slot.id, name: slot.name, driverName: "" };
      })
    : lists.vans;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-4xl text-navy">{companyName}</h1>
        <p className="mt-1 text-lg font-semibold text-navy">Print list</p>
        <p className="mt-2 max-w-3xl text-muted">
          View every bus and van for this school. Print or export PDF for
          drivers — view only, no changes and no texts.
        </p>
        <CompanyPrintSchoolPicker
          schools={schools}
          schoolId={selected.id}
          schoolName={selected.name}
        />
      </div>

      <DriverLists
        riders={lists.riders}
        buses={buses}
        vans={vans}
        busDrivers={lists.busDrivers}
        aimSchool={lists.aimSchool}
        viewOnly
      />
    </div>
  );
}
