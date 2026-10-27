import Link from "next/link";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { loadStudents } from "@/lib/transportation";
import { loadVehicles } from "@/lib/gate";
import { loadSavedOpsEmails } from "@/lib/ops-change-emails";
import { groupByBus, stamp } from "@/lib/reports";
import { planSummary } from "@/lib/format";
import { addSpecialVan } from "@/app/actions/gate";
import { BusesToolbar } from "../buses/BusesToolbar";

export default async function PrintPage({
  searchParams,
}: {
  searchParams: Promise<{ bus?: string; van?: string }>;
}) {
  const session = await getSession();
  if (!session) return null;
  const { bus = "", van = "" } = await searchParams;

  const [students, routes, vehicles, suggested] = await Promise.all([
    loadStudents(session.schoolId),
    prisma.busRoute.findMany({
      where: { schoolId: session.schoolId },
      select: { number: true },
      orderBy: { number: "asc" },
    }),
    loadVehicles(session.schoolId).catch(() => []),
    loadSavedOpsEmails(session.schoolId),
  ]);

  const pmBuses = groupByBus(students, "PM");
  const busMap = new Map(pmBuses);
  for (const route of routes) {
    if (!busMap.has(route.number)) busMap.set(route.number, []);
  }
  const busCards = [...busMap.entries()].sort(([a], [b]) =>
    a.localeCompare(b, undefined, { numeric: true }),
  );
  const busRiders = students.filter(
    (student) => student.pm.type === "BUS" && student.pm.busNumber,
  ).length;

  const vans = vehicles.filter(
    (vehicle) =>
      vehicle.vehicleType.toUpperCase() === "VAN" || /van/i.test(vehicle.name),
  );
  const vanIds = vans.map((vehicle) => vehicle.id);
  const vanStudents = vanIds.length
    ? await prisma.student.findMany({
        where: { schoolId: session.schoolId, vehicleId: { in: vanIds } },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          grade: true,
          vehicleId: true,
        },
        orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      })
    : [];
  const vanCards = vans.map((vehicle) => ({
    ...vehicle,
    riders: vanStudents.filter((student) => student.vehicleId === vehicle.id),
  }));
  const selectedBus = bus ? busMap.get(bus) || [] : [];
  const selectedVan = vanCards.find((item) => item.id === van);

  const driverBuses = busCards.filter(([, riders]) => riders.length);
  const vanRiders = vanCards.reduce((sum, item) => sum + item.riders.length, 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-4xl">Reports</h1>
        <p className="mt-1 max-w-2xl text-muted">
          Print each bus or van list and give it to the driver. Parent pickup
          stays off these lists. Upload the student roster on Roster first.
        </p>
        <p className="mt-2 text-sm font-semibold text-navy">
          {busRiders} on buses
          {vanRiders ? ` · ${vanRiders} on vans` : ""}
          {` · ${students.length} on the roster`}
        </p>
        <BusesToolbar suggested={suggested} />
      </div>

      <section>
        <h2 className="mb-3 font-serif text-2xl">Buses</h2>
        {driverBuses.length ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {driverBuses.map(([number, riders]) => (
              <div
                key={number}
                className="rounded-2xl border border-line bg-card p-5 shadow-sm"
              >
                <p className="text-sm text-muted">Bus {number}</p>
                <p className="mt-2 font-serif text-4xl">{riders.length}</p>
                <p className="mt-1 text-sm text-muted">
                  student{riders.length === 1 ? "" : "s"}
                </p>
                <Link
                  href={`/buses/print?bus=${encodeURIComponent(number)}`}
                  className="mt-3 inline-block text-sm font-semibold text-navy"
                >
                  Print for driver
                </Link>
              </div>
            ))}
          </div>
        ) : (
          <p className="rounded-2xl border border-line bg-card px-4 py-6 text-sm text-muted">
            No bus students yet. Upload the roster, then save a bus number on
            Front Desk.
          </p>
        )}
      </section>

      <section>
        <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="font-serif text-2xl">Special vans</h2>
            <p className="text-sm text-muted">
              Vans for special students, separate from the regular buses.
            </p>
          </div>
          {session.role === "ADMINISTRATOR" || session.role === "COORDINATOR" ? (
            <form action={addSpecialVan} className="flex flex-wrap gap-2">
              <input type="hidden" name="vehicleType" value="VAN" />
              <input
                name="name"
                required
                placeholder="Van 1"
                className="rounded-xl border border-line bg-card px-3 py-2 text-sm"
              />
              <button className="rounded-full bg-navy px-4 py-2 text-sm font-semibold text-white">
                Add van
              </button>
            </form>
          ) : null}
        </div>
        {vanCards.length ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {vanCards.map((vehicle) => (
              <div
                key={vehicle.id}
                className="rounded-2xl border border-line bg-card p-5 shadow-sm"
              >
                <p className="text-sm text-muted">{vehicle.name}</p>
                <p className="mt-2 font-serif text-4xl">{vehicle.riders.length}</p>
                <p className="mt-1 text-sm text-muted">
                  special student{vehicle.riders.length === 1 ? "" : "s"}
                </p>
                {vehicle.driverName ? (
                  <p className="mt-2 text-sm text-muted">{vehicle.driverName}</p>
                ) : null}
                <Link
                  href={`/buses/print?van=${vehicle.id}`}
                  className="mt-3 inline-block text-sm font-semibold text-navy"
                >
                  Print for driver
                </Link>
              </div>
            ))}
          </div>
        ) : (
          <p className="rounded-2xl border border-line bg-card px-4 py-6 text-sm text-muted">
            No special vans yet. Add Van 1 for students who do not ride a
            regular bus.
          </p>
        )}
      </section>

      {selectedBus.length || bus ? (
        <RiderList
          title={`Bus ${bus}`}
          rows={selectedBus.map((student) => ({
            id: student.id,
            name: student.fullName,
            detail: `Grade ${student.grade} · ${planSummary(student.pm, "PM")}`,
          }))}
        />
      ) : null}

      {selectedVan ? (
        <RiderList
          title={selectedVan.name}
          rows={selectedVan.riders.map((student) => ({
            id: student.id,
            name: `${student.firstName} ${student.lastName}`,
            detail: `Grade ${student.grade}`,
          }))}
        />
      ) : null}
    </div>
  );
}

function RiderList({
  title,
  rows,
}: {
  title: string;
  rows: { id: string; name: string; detail: string }[];
}) {
  const header = stamp();
  return (
    <section className="print-sheet rounded-2xl border border-line bg-card p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="font-serif text-2xl">{title}</h2>
          <p className="text-sm text-muted">
            {header.generated} · {rows.length} student{rows.length === 1 ? "" : "s"}
          </p>
        </div>
        <Link href="/print" className="no-print text-sm font-semibold text-navy">
          Back to cards
        </Link>
      </div>
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="text-muted">
            <th className="py-2">Student</th>
            <th>Today</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="border-t border-line">
              <td className="py-2">
                <Link href={`/dashboard?student=${row.id}`} className="font-medium hover:underline">
                  {row.name}
                </Link>
              </td>
              <td>{row.detail}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {!rows.length ? (
        <p className="mt-3 text-sm text-muted">No students on this vehicle yet.</p>
      ) : null}
    </section>
  );
}
