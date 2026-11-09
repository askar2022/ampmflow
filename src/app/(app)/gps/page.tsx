import { getSession } from "@/lib/auth";
import { LiveGpsBoard } from "@/components/LiveGpsBoard";
import { fetchOneStepLiveBuses } from "@/lib/onestep-gps";
import { prisma } from "@/lib/prisma";

export default async function LiveGpsPage() {
  const session = await getSession();
  if (!session) return null;

  const [school, routes] = await Promise.all([
    prisma.school.findUnique({
      where: { id: session.schoolId },
      select: { name: true },
    }),
    prisma.busRoute.findMany({
      where: { schoolId: session.schoolId },
      select: { number: true },
      orderBy: { number: "asc" },
    }),
  ]);

  const feed = await fetchOneStepLiveBuses(school?.name);

  return (
    <LiveGpsBoard
      schoolName={school?.name || "School"}
      schoolId={session.schoolId}
      busLabels={routes.map((route) => route.number)}
      audience="school"
      initialFeed={feed}
    />
  );
}
