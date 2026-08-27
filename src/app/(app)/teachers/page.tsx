import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { loadStudents } from "@/lib/transportation";
import {
  clearPlaceholderTeacherEmails,
  usableTeacherEmail,
} from "@/lib/teacher-snapshot";
import { TeacherCards } from "./TeacherCards";

export default async function TeachersPage() {
  const session = await getSession();
  if (!session) return null;
  await clearPlaceholderTeacherEmails(session.schoolId);
  const [students, teachers] = await Promise.all([
    loadStudents(session.schoolId),
    prisma.teacher.findMany({
      where: { schoolId: session.schoolId },
      include: { classroom: true },
      orderBy: { name: "asc" },
    }),
  ]);
  const counts = new Map<string, number>();
  for (const student of students) {
    counts.set(student.classroomId, (counts.get(student.classroomId) ?? 0) + 1);
  }
  const canEdit =
    session.role === "COORDINATOR" ||
    session.role === "ADMINISTRATOR" ||
    session.role === "FRONT_DESK";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-serif text-4xl">Teachers and classes</h1>
          <p className="mt-1 max-w-2xl text-muted">
            Names and rooms come from your student upload. Save each email once
            so the daily list can go out at 2:45, or 11:45 on Friday, from
            dismissal@ampmflow.com.
          </p>
        </div>
        <a
          href="/print/export?kind=teacher"
          className="inline-flex min-h-11 items-center rounded-xl border border-line bg-card px-4 py-2 text-sm font-medium"
        >
          Download Excel
        </a>
      </div>
      <TeacherCards
        canEdit={canEdit}
        teachers={teachers.map((teacher) => {
          const email = usableTeacherEmail(teacher.email);
          return {
            id: teacher.id,
            name: teacher.name,
            email,
            grade: teacher.classroom.grade,
            room: teacher.classroom.name,
            studentCount: counts.get(teacher.classroomId) ?? 0,
            rosterHref: `/print?kind=teacher&group=${encodeURIComponent(`${teacher.name} · ${teacher.classroom.name}`)}`,
          };
        })}
      />
    </div>
  );
}
