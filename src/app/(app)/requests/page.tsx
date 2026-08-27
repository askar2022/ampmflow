import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createChangeRequest, reviewRequest } from "@/app/actions/requests";
import { formatDateTime } from "@/lib/dates";
import { StudentPicker } from "@/components/StudentPicker";

export default async function RequestsPage({
  searchParams,
}: {
  searchParams: Promise<{ studentId?: string }>;
}) {
  const session = await getSession();
  if (!session) return null;
  const { studentId } = await searchParams;
  const requests = await prisma.changeRequest.findMany({
    where: { schoolId: session.schoolId },
    include: { student: true, createdBy: true, reviewedBy: true },
    orderBy: { createdAt: "desc" },
  });
  const students = await prisma.student.findMany({
    where: { schoolId: session.schoolId },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
  });

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <section className="rounded-2xl border border-line bg-card p-6">
        <h1 className="font-serif text-3xl">
          {session.role === "FRONT_DESK" ? "Record a parent request" : "Change requests"}
        </h1>
        <p className="mt-2 text-sm text-muted">
          Front desk can record a parent request. The coordinator must approve it
          before it changes a student’s plan.
        </p>
        <form action={createChangeRequest} className="mt-4 space-y-3">
          <label className="block text-sm font-medium">
            Student
            <StudentPicker
              defaultId={studentId || ""}
              students={students.map((student) => ({
                id: student.id,
                firstName: student.firstName,
                lastName: student.lastName,
                studentId: student.studentId,
                grade: student.grade,
              }))}
            />
          </label>
          <label className="block text-sm font-medium">
            Trip
            <select name="trip" className="mt-1 w-full rounded-xl border border-line px-3 py-2">
              <option value="PM">PM</option>
              <option value="AM">AM</option>
            </select>
          </label>
          <label className="block text-sm font-medium">
            Request
            <input
              name="title"
              required
              className="mt-1 w-full rounded-xl border border-line px-3 py-2"
              placeholder="Parent pickup today"
            />
          </label>
          <label className="block text-sm font-medium">
            Details
            <textarea
              name="details"
              rows={3}
              className="mt-1 w-full rounded-xl border border-line px-3 py-2"
            />
          </label>
          <button className="rounded-xl bg-navy px-4 py-2 font-semibold text-white">
            {session.role === "COORDINATOR" || session.role === "ADMINISTRATOR"
              ? "Save request"
              : "Submit for approval"}
          </button>
        </form>
      </section>

      <section className="space-y-3">
        {requests.map((request) => (
          <article key={request.id} className="rounded-2xl border border-line bg-card p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="font-semibold">{request.title}</h2>
                <p className="text-sm text-muted">
                  {request.createdBy.name} · {request.source} ·{" "}
                  {formatDateTime(request.createdAt)}
                </p>
              </div>
              <span className="text-xs font-semibold uppercase tracking-wider">
                {request.status}
              </span>
            </div>
            <p className="mt-2 text-sm">{request.details}</p>
            {request.student ? (
              <p className="mt-1 text-sm text-muted">
                {request.student.firstName} {request.student.lastName} · {request.trip}
              </p>
            ) : null}
            {(session.role === "COORDINATOR" || session.role === "ADMINISTRATOR") &&
            request.status === "PENDING" ? (
              <div className="mt-3 flex gap-2">
                <form
                  action={async () => {
                    "use server";
                    await reviewRequest(request.id, "APPROVED");
                  }}
                >
                  <button className="rounded-full bg-green px-3 py-1.5 text-sm text-white">
                    Approve
                  </button>
                </form>
                <form
                  action={async () => {
                    "use server";
                    await reviewRequest(request.id, "REJECTED");
                  }}
                >
                  <button className="rounded-full border border-line px-3 py-1.5 text-sm">
                    Reject
                  </button>
                </form>
              </div>
            ) : null}
          </article>
        ))}
      </section>
    </div>
  );
}
