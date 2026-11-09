import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { loadCompanySchools } from "@/lib/company-access";
import { LiveGpsBoard } from "@/components/LiveGpsBoard";
import { fetchOneStepLiveBuses } from "@/lib/onestep-gps";
import { prisma } from "@/lib/prisma";

export default async function CompanyLiveGpsPage({
  searchParams,
}: {
  searchParams: Promise<{ school?: string }>;
}) {
  const session = await getSession();
  if (!session) return null;
  if (session.role !== "BUS_COMPANY") redirect("/gps");

  const { school: wanted } = await searchParams;
  const schools = await loadCompanySchools(session);
  const selected =
    schools.find((school) => school.id === wanted || school.slug === wanted) ||
    schools[0];

  if (!selected) {
    return (
      <div>
        <h1 className="font-serif text-4xl text-navy">Live GPS</h1>
        <p className="mt-2 text-muted">
          No school is assigned to this login yet.
        </p>
      </div>
    );
  }

  const [routes, feed] = await Promise.all([
    prisma.busRoute.findMany({
      where: { schoolId: selected.id },
      select: { number: true },
      orderBy: { number: "asc" },
    }),
    fetchOneStepLiveBuses(selected.name),
  ]);

  return (
    <LiveGpsBoard
      schoolName={selected.name}
      schoolId={selected.id}
      busLabels={routes.map((route) => route.number)}
      audience="company"
      initialFeed={feed}
    />
  );
}
