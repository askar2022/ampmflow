import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { changeList } from "@/lib/reports";
import { loadStudents } from "@/lib/transportation";
import { getSchoolIdentityById } from "@/lib/school";
import { WelcomeBanner } from "@/components/WelcomeBanner";
import { ReceptionDesk } from "./ReceptionDesk";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ student?: string }>;
}) {
  const session = await getSession();
  if (!session) return null;
  const { student: selectedId = "" } = await searchParams;

  const school = await getSchoolIdentityById(session.schoolId);
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
    <div className="mx-auto max-w-4xl space-y-6">
      <WelcomeBanner
        schoolName={school?.name}
        copy={`Search or filter by grade, class, or bus. Saving a change emails the teacher, parent, and bus company right away.${
          changed ? ` ${changed} change${changed === 1 ? "" : "s"} today.` : ""
        }${waiting ? ` ${waiting} waiting for a route.` : ""}`}
      />
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
        canUpload={session.role === "ADMINISTRATOR" || session.role === "COORDINATOR"}
        canManageTeachers={session.role === "ADMINISTRATOR" || session.role === "COORDINATOR"}
      />
    </div>
  );
}
