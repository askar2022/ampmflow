import Link from "next/link";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { loadStudents } from "@/lib/transportation";
import { groupByTeacher } from "@/lib/reports";
import {
  clearPlaceholderTeacherEmails,
  usableTeacherEmail,
} from "@/lib/teacher-snapshot";
import { updateTeacherEmail } from "@/app/actions/teachers";

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
  const groups = groupByTeacher(students);
  const counts = new Map(groups.map(([name, rows]) => [name, rows.length]));
  const canEdit =
    session.role === "COORDINATOR" ||
    session.role === "ADMINISTRATOR" ||
    session.role === "FRONT_DESK";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-4xl">Teachers and classes</h1>
        <p className="mt-1 max-w-2xl text-muted">
          Save each teacher’s email here one time. After that, Vercel sends
          their class list every school day at 2:45, or 11:45 on Friday, with
          no click. You can also send it anytime from Reports. Mail comes from
          dismissal@ampmflow.com.
        </p>
        <a
          href="/print/export?kind=teacher"
          className="mt-3 inline-block rounded-xl border border-line bg-card px-4 py-2 text-sm font-semibold"
        >
          Download Excel
        </a>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {teachers.map((teacher) => {
          const groupName = `${teacher.name} · ${teacher.classroom.name}`;
          const email = usableTeacherEmail(teacher.email);
          return (
            <section
              key={teacher.id}
              className="rounded-2xl border border-line bg-card p-5"
            >
              <h2 className="font-serif text-2xl">{teacher.name}</h2>
              <p className="mt-1 text-sm text-muted">
                {teacher.classroom.name} · {counts.get(groupName) ?? 0} students
              </p>
              {email ? (
                <p className="mt-2 text-sm">List goes to {email}</p>
              ) : (
                <p className="mt-2 text-sm font-medium text-red">
                  No email yet — this class will not get the daily list.
                </p>
              )}
              {canEdit ? (
                <form action={updateTeacherEmail} className="mt-4 flex flex-col gap-2 sm:flex-row">
                  <input type="hidden" name="teacherId" value={teacher.id} />
                  <input
                    name="email"
                    type="email"
                    required
                    defaultValue={email}
                    placeholder="teacher@school.org"
                    className="w-full rounded-xl border border-line px-3 py-2"
                  />
                  <button className="rounded-xl bg-navy px-4 py-2 text-sm font-semibold text-white">
                    Save email
                  </button>
                </form>
              ) : null}
              <Link
                href={`/print?kind=teacher&group=${encodeURIComponent(groupName)}`}
                className="mt-3 inline-block text-sm font-semibold text-navy"
              >
                Open class list
              </Link>
            </section>
          );
        })}
      </div>
    </div>
  );
}
