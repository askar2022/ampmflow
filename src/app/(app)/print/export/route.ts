import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { loadStudents } from "@/lib/transportation";
import { loadCheckInSummary } from "@/lib/operations";
import {
  checkInWorkbook,
  excelFileName,
  gateDismissalWorkbook,
  studentsWorkbook,
  workbookBytes,
} from "@/lib/excel";
import {
  loadGateRoster,
  parentPickupToday,
} from "@/lib/gate";
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

  const search = new URL(request.url).searchParams;
  const requested = search.get("kind") || "checkin";
  const group = search.get("group") || "";
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
  if (kind === "teacher" && group) {
    students = students.filter(
      (row) => `${row.teacherName} · ${row.classroomName}` === group,
    );
  }

  let workbook;
  if (kind === "checkin") {
    workbook = checkInWorkbook(await loadCheckInSummary(session.schoolId));
  } else if (kind === "pickup") {
    const roster = await loadGateRoster(session.schoolId);
    workbook = parentPickupToday(roster).length
      ? gateDismissalWorkbook("pickup", roster)
      : studentsWorkbook(kind, students);
  } else if (kind === "bus") {
    workbook = studentsWorkbook(kind, students);
  } else {
    workbook = studentsWorkbook(kind, students);
  }
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
