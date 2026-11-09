import { getSession } from "@/lib/auth";
import { schoolLocalTime, todayKey } from "@/lib/dates";
import {
  changeRequestLabel,
  companyAssignmentLabel,
  isRouteRequestStudent,
  isWaitingRide,
} from "@/lib/format";
import { defaultBusCompanyEmail } from "@/lib/ops-change-emails";
import { prisma } from "@/lib/prisma";
import { loadStudent, loadStudents } from "@/lib/transportation";
import { RequestRecordTable, type RequestRecordRow } from "@/components/RequestRecordTable";
import { RouteRequestForm } from "./RouteRequestForm";

function requestGrade(row: {
  student?: { grade: string } | null;
  details: string;
}) {
  const fromStudent = row.student?.grade?.trim();
  if (fromStudent && fromStudent !== "—") return fromStudent;
  const match = row.details.match(/Grade\s+([^·]+)/i);
  return match?.[1].trim() || "";
}

export default async function WaitingPage() {
  const session = await getSession();
  if (!session) return null;
  const busCompanyEmail = await defaultBusCompanyEmail(session.schoolId);
  const day = todayKey();
  const [pending, students] = await Promise.all([
    prisma.changeRequest.findMany({
      where: {
        schoolId: session.schoolId,
        title: { startsWith: "Request for route" },
        status: { in: ["PENDING", "COMPLETED", "NEEDS_CLARIFICATION"] },
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
  const byId = new Map(students.map((student) => [student.id, student]));
  const rows: RequestRecordRow[] = [];
  const seen = new Set<string>();

  for (const row of pending) {
    const reviewedDay = schoolLocalTime(row.reviewedAt || row.updatedAt).dateKey;
    if (row.status === "COMPLETED" && reviewedDay !== day) continue;
    const studentId = row.studentId || row.student?.id || "";
    const loaded =
      (studentId && byId.get(studentId)) ||
      (studentId ? (await loadStudent(studentId))?.effective : null);
    const name = loaded
      ? loaded.fullName
      : row.student
        ? `${row.student.firstName} ${row.student.lastName}`
        : row.title.replace(/^Request for route\s+[—-]\s+/i, "");
    const key = studentId || row.id;
    if (seen.has(key)) continue;
    seen.add(key);
    const waiting = loaded ? isWaitingRide(loaded) : !row.busNumber;
    rows.push({
      id: key,
      name,
      grade: loaded?.grade || requestGrade(row),
      request: loaded
        ? changeRequestLabel(loaded)
        : row.details.match(/·\s*([^·]+?)\s*·/)?.[1]?.trim() || "New route",
      company: loaded
        ? companyAssignmentLabel(loaded)
        : row.busNumber || "Waiting for company",
      waiting,
    });
  }

  for (const student of students) {
    if (!isRouteRequestStudent(student) || seen.has(student.id)) continue;
    seen.add(student.id);
    rows.push({
      id: student.id,
      name: student.fullName,
      grade: student.grade,
      request: changeRequestLabel(student),
      company: companyAssignmentLabel(student),
      waiting: isWaitingRide(student),
    });
  }

  return (
    <div className="space-y-6">
      <RouteRequestForm busCompanyEmail={busCompanyEmail} />
      <p className="max-w-2xl text-muted">
        The school submits the request. The bus company assigns the bus (Aim:
        Bus 4, Bus 5, or the 3rd bus). This list is the record — your request
        and their update.
      </p>
      <RequestRecordTable
        rows={rows}
        empty="No route requests yet. Submit a new request and it will stay here until the company assigns a bus."
      />
    </div>
  );
}
