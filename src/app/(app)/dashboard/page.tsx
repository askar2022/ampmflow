import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { changeList } from "@/lib/reports";
import { loadStudents } from "@/lib/transportation";
import { ReceptionDesk } from "./ReceptionDesk";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ student?: string }>;
}) {
  const session = await getSession();
  if (!session) return null;
  const { student: selectedId = "" } = await searchParams;

  const students = await loadStudents(session.schoolId);
  const routes = await prisma.busRoute.findMany({
    where: { schoolId: session.schoolId },
    select: { number: true },
    orderBy: { number: "asc" },
  });
  const buses = [...new Set(routes.map((route) => route.number))];
  const changed = changeList(students).length;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <ReceptionDesk
        students={students}
        buses={buses}
        initialStudentId={selectedId}
        changeCount={changed}
        canPermanent={session.role === "ADMINISTRATOR" || session.role === "COORDINATOR"}
        canSeeEmergency={
          session.role === "ADMINISTRATOR" ||
          session.role === "COORDINATOR" ||
          session.role === "FRONT_DESK"
        }
      />
    </div>
  );
}
