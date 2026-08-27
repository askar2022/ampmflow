import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { loadStudents } from "@/lib/transportation";
import {
  clearPlaceholderTeacherEmails,
  teacherEmailPlan,
  usableTeacherEmail,
} from "@/lib/teacher-snapshot";
import { EmailTeacherButton } from "@/components/EmailTeacherButton";
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
  const canEmail =
    session.role === "COORDINATOR" || session.role === "ADMINISTRATOR";
  const emailPlan = canEmail
    ? await teacherEmailPlan(session.schoolId)
    : { ready: [], missing: [] };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-serif text-4xl">Teachers and classes</h1>
          <p className="mt-1 max-w-2xl text-muted">
            Use Email on a card to send that class only. Use Email all teachers
            to send every class at once. Daily send is still 2:45, or 11:45 on
            Friday.
          </p>
        </div>
        <a
          href="/print/export?kind=teacher"
          className="inline-flex min-h-11 items-center rounded-xl border border-line bg-card px-4 py-2 text-sm font-medium"
        >
          Download Excel
        </a>
      </div>
      {canEmail ? (
        <section className="rounded-2xl border border-line bg-card p-5">
          <h2 className="text-lg font-semibold text-navy">Email all teachers</h2>
          <p className="mt-1 text-sm text-muted">
            This is the one-time send for every class. Each card below emails
            one teacher only.
          </p>
          {emailPlan.ready.length ? (
            <p className="mt-3 text-sm">
              Ready: {emailPlan.ready.map((row) => row.name).join(", ")}.
            </p>
          ) : (
            <p className="mt-3 text-sm text-red">
              No teacher emails saved yet.
            </p>
          )}
          {emailPlan.missing.length ? (
            <p className="mt-2 text-sm">
              Still need an email for:{" "}
              {emailPlan.missing.map((row) => row.name).join(", ")}.
            </p>
          ) : null}
          <div className="mt-4 max-w-xs">
            <EmailTeacherButton
              label="Email all teachers"
              disabled={emailPlan.ready.length === 0}
            />
          </div>
        </section>
      ) : null}
      <TeacherCards
        canEdit={canEdit}
        canEmail={canEmail}
        teachers={teachers.map((teacher) => {
          const email = usableTeacherEmail(teacher.email);
          const groupName = `${teacher.name} · ${teacher.classroom.name}`;
          return {
            id: teacher.id,
            name: teacher.name,
            email,
            grade: teacher.classroom.grade,
            room: teacher.classroom.name,
            studentCount: counts.get(teacher.classroomId) ?? 0,
            groupName,
            rosterHref: `/print?kind=teacher&group=${encodeURIComponent(groupName)}`,
          };
        })}
      />
    </div>
  );
}
