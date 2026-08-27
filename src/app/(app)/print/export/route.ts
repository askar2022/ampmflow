import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { loadStudents } from "@/lib/transportation";
import { loadCheckInSummary } from "@/lib/operations";
import {
  checkInWorkbook,
  excelFileName,
  studentsWorkbook,
  workbookBytes,
} from "@/lib/excel";
import type { ReportKind } from "@/lib/reports";

const KINDS: ReportKind[] = [
  "teacher",
  "master",
  "bus",
  "pickup",
  "changes",
  "missing",
  "company",
  "checkin",
];

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) {
    return new Response("Please sign in.", { status: 401 });
  }

  const requested = new URL(request.url).searchParams.get("kind") || "checkin";
  const kind = (
    session.role === "TEACHER"
      ? "teacher"
      : KINDS.includes(requested as ReportKind)
        ? requested
        : "checkin"
  ) as ReportKind;

  let students = await loadStudents(session.schoolId);
  if (session.role === "TEACHER" && session.teacherId) {
    const teacher = await prisma.teacher.findUnique({
      where: { id: session.teacherId },
    });
    if (teacher) {
      students = students.filter((row) => row.classroomId === teacher.classroomId);
    }
  }

  const workbook =
    kind === "checkin"
      ? checkInWorkbook(await loadCheckInSummary(session.schoolId))
      : studentsWorkbook(kind, students);
  const bytes = workbookBytes(workbook);
  const name = excelFileName(kind);

  return new Response(bytes, {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${name}"`,
    },
  });
}
