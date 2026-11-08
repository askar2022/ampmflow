import { getSession } from "@/lib/auth";
import { LiveGpsBoard } from "@/components/LiveGpsBoard";
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

  return (
    <LiveGpsBoard
      schoolName={school?.name || "School"}
      busLabels={routes.map((route) => route.number)}
      audience="school"
    />
  );
}
