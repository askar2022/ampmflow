import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { changeList } from "@/lib/reports";
import { loadStudents } from "@/lib/transportation";
import { formatLongDate, schoolNow } from "@/lib/dates";
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
  const waiting = students.filter(
    (student) => student.am.waitingForAssignment || student.pm.waitingForAssignment,
  ).length;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <p className="text-sm text-muted">{formatLongDate(schoolNow())}</p>
        <h1 className="font-serif text-4xl">Student desk</h1>
        <p className="mt-2 text-muted">
          Search a student, check today’s bus plan, and save one transportation
          change. {changed} change{changed === 1 ? "" : "s"} today
          {waiting ? ` · ${waiting} waiting for a route` : ""}.
        </p>
      </div>
      <ReceptionDesk
        students={students}
        buses={buses}
        initialStudentId={selectedId}
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
