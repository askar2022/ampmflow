import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { loadStudents } from "@/lib/transportation";
import { formatLongDate, formatTime, schoolNow } from "@/lib/dates";
import { planSummary, planTone } from "@/lib/format";
import { StatusBadge } from "@/components/StatusBadge";
import { createChangeRequest } from "@/app/actions/requests";

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

  const now = schoolNow();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-muted">
            {formatLongDate(now)} · {formatTime(now)}
          </p>
          <h1 className="font-serif text-4xl">{heading}</h1>
          <p className="mt-1 text-muted">
            Read-only PM dismissal view. Temporary changes are highlighted. Report
            a concern to the coordinator if something looks wrong.
          </p>
        </div>
        <a
          href="/print?kind=teacher"
          className="rounded-full bg-navy px-4 py-2 text-sm font-semibold text-white"
        >
          Print classroom list
        </a>
      </div>

      <div className="flex flex-wrap gap-2 text-xs">
        <StatusBadge tone="yellow" />
        <StatusBadge tone="green" />
        <StatusBadge tone="red" />
        <StatusBadge tone="blue" />
      </div>

      <div className="overflow-hidden rounded-2xl border border-line bg-card">
        <table className="w-full text-left text-sm">
          <thead className="bg-paper text-muted">
            <tr>
              <th className="px-4 py-3">Student</th>
              <th>Today’s PM plan</th>
              <th>Location</th>
            </tr>
          </thead>
          <tbody>
            {students.map((student) => {
              const tone = planTone(student.pm);
              return (
                <tr key={student.id} className={`row-${tone} border-t border-line`}>
                  <td className="px-4 py-3 font-medium">{student.fullName}</td>
                  <td>
                    <StatusBadge tone={tone}>{planSummary(student.pm, "PM")}</StatusBadge>
                  </td>
                  <td>{student.pm.location}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <form
        action={createChangeRequest}
        className="rounded-2xl border border-line bg-card p-5"
      >
        <h2 className="font-serif text-2xl">Report a concern</h2>
        <input type="hidden" name="title" id="concern-title" />
        <label className="mt-3 block text-sm font-medium">
          Student
          <select
            name="studentId"
            className="mt-1 w-full rounded-xl border border-line px-3 py-2"
            defaultValue=""
          >
            <option value="">Whole class / not sure</option>
            {students.map((s) => (
              <option key={s.id} value={s.id}>
                {s.fullName}
              </option>
            ))}
          </select>
        </label>
        <label className="mt-3 block text-sm font-medium">
          What should the coordinator know?
          <textarea
            name="details"
            required
            rows={3}
            className="mt-1 w-full rounded-xl border border-line px-3 py-2"
            placeholder="Example: Parent is at the door and this student is still on the bus list."
          />
        </label>
        <button
          className="mt-4 rounded-xl bg-navy px-4 py-2 font-semibold text-white"
          formAction={async (formData) => {
            "use server";
            const details = String(formData.get("details") || "");
            formData.set("title", `Teacher concern: ${details.slice(0, 80)}`);
            formData.set("trip", "PM");
            await createChangeRequest(formData);
          }}
        >
          Send to coordinator
        </button>
      </form>
    </div>
  );
}
