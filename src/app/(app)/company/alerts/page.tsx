import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { loadCompanySchools } from "@/lib/company-access";
import { loadLateRides } from "@/lib/late-alert";
import { loadLateAlertStaffPhones } from "@/lib/late-alert-staff";
import { prisma } from "@/lib/prisma";
import { LateAlertBoard } from "./LateAlertBoard";

export default async function CompanyLateAlertPage({
  searchParams,
}: {
  searchParams: Promise<{ school?: string }>;
}) {
  const session = await getSession();
  if (!session) return null;
  if (session.role !== "BUS_COMPANY") redirect("/changes");

  const liveName = await prisma.user
    .findUnique({
      where: { id: session.id },
      select: { name: true },
    })
    .then((row) => row?.name || session.name || "Bus company")
    .catch(() => session.name || "Bus company");

  const { school: wanted } = await searchParams;
  const schools = await loadCompanySchools(session);
  const selected =
    schools.find((school) => school.id === wanted || school.slug === wanted) ||
    schools[0];

  if (!selected) {
    return (
      <div>
        <h1 className="font-serif text-4xl text-navy">{liveName}</h1>
        <p className="mt-1 text-lg font-semibold text-navy">Late Bus Alert</p>
        <p className="mt-2 text-muted">
          No school is assigned to this login yet. Ask AMPM Flow to add the
          schools you serve.
        </p>
      </div>
    );
  }

  const [rides, staffPhones] = await Promise.all([
    loadLateRides(selected.id),
    loadLateAlertStaffPhones(selected.id),
  ]);

  return (
    <LateAlertBoard
      companyName={liveName}
      schools={schools}
      schoolId={selected.id}
      schoolName={selected.name}
      rides={rides}
      staffPhone1={staffPhones.phone1}
      staffPhone2={staffPhones.phone2}
    />
  );
}
