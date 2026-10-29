import { getSession } from "@/lib/auth";
import { defaultBusCompanyEmail } from "@/lib/ops-change-emails";
import { prisma } from "@/lib/prisma";
import { loadStudents } from "@/lib/transportation";
import { AssignBusList, type WaitingStudent } from "./AssignBusList";
import { RouteRequestForm } from "./RouteRequestForm";

export default async function WaitingPage() {
  const session = await getSession();
  if (!session) return null;
  const busCompanyEmail = await defaultBusCompanyEmail(session.schoolId);
  const [pending, students] = await Promise.all([
    prisma.changeRequest.findMany({
      where: {
        schoolId: session.schoolId,
        status: "PENDING",
      },
      include: {
        student: {
          select: { id: true, firstName: true, lastName: true, grade: true },
        },
      },
      orderBy: { createdAt: "desc" },
    }),
    loadStudents(session.schoolId),
  ]);

  const rows: WaitingStudent[] = [];
  const seen = new Set<string>();

  for (const row of pending) {
    const studentId = row.studentId || row.student?.id || "";
    const name = row.student
      ? `${row.student.firstName} ${row.student.lastName}`
      : row.title.replace(/^Request for route\s+[—-]\s+/i, "");
    const key = studentId || row.id;
    if (seen.has(key)) continue;
    seen.add(key);
    rows.push({
      requestId: row.id,
      studentId: studentId || undefined,
      name,
      grade: row.student?.grade || "",
      details: row.details,
    });
  }

  for (const student of students) {
    const waiting =
      student.am.waitingForAssignment ||
      student.pm.waitingForAssignment ||
      (student.am.type === "BUS" && !student.am.busNumber) ||
      (student.pm.type === "BUS" && !student.pm.busNumber);
    if (!waiting || seen.has(student.id)) continue;
    seen.add(student.id);
    rows.push({
      studentId: student.id,
      name: student.fullName,
      grade: student.grade,
      details: "Waiting for a bus number from the company.",
    });
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-4xl">Request for Route</h1>
        <p className="mt-2 max-w-2xl text-muted">
          Submit a student to the bus company. When they email that the student
          is assigned bus 4, search the name below and type 4. Parent, teacher,
          and the bus company are notified.
        </p>
      </div>

      <RouteRequestForm busCompanyEmail={busCompanyEmail} />

      <AssignBusList rows={rows} />
    </div>
  );
}
