import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { loadStudents } from "@/lib/transportation";
import { loadChangeEvents } from "@/lib/operations";
import { eventPlanLabel } from "@/lib/operations";
import { LiveRefresh } from "@/components/LiveRefresh";
import { TeacherBoard } from "./TeacherBoard";

export default async function TeacherPage() {
  const session = await getSession();
  if (!session) return null;

  let students = await loadStudents(session.schoolId);
  let heading = "School dismissal list";
  if (session.teacherId) {
    const teacher = await prisma.teacher.findUnique({
      where: { id: session.teacherId },
      include: { classroom: true },
    });
    if (teacher) {
      students = students.filter((s) => s.classroomId === teacher.classroomId);
      heading = `${teacher.name} · ${teacher.classroom.name}`;
    }
  }

  const events = await loadChangeEvents(session.schoolId);
  const pending = events
    .filter((event) =>
      event.acknowledgments.some(
        (ack) => ack.userId === session.id && !ack.acknowledgedAt,
      ),
    )
    .map((event) => ({
      id: event.id,
      studentName: `${event.student.firstName} ${event.student.lastName}`,
      at: event.createdAt.toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
      }),
      by: event.createdBy.name,
      from: eventPlanLabel(event.previousPlan),
      to: eventPlanLabel(event.newPlan),
    }));

  return (
    <div className="space-y-3">
      <LiveRefresh />
      <TeacherBoard heading={heading} students={students} pending={pending} />
    </div>
  );
}
