import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { reviewRequest } from "@/app/actions/requests";
import { formatDateTime } from "@/lib/dates";
import { roleLabel } from "@/lib/format";
import { TodayChangeForm } from "@/components/TodayChangeForm";

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
  const routes = await prisma.busRoute.findMany({
    where: { schoolId: session.schoolId },
    orderBy: { number: "asc" },
    select: { number: true },
  });
  const busNumbers = [...new Set(routes.map((route) => route.number))];

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <section className="rounded-2xl border border-line bg-card p-6">
        <h1 className="font-serif text-3xl">Change requests</h1>
        <p className="mt-2 text-sm text-muted">
          <strong>Today’s ride</strong> is a same-day switch the school can
          apply: bus to parent pickup, or bus to a different bus. A parent
          request to the <strong>bus company</strong> is one of three things:
          moving / new address, daycare change or new daycare, or parent
          pickup to bus. The school cannot assign that new bus — report it and
          keep the student on Waiting for Route.
        </p>
        <TodayChangeForm
          defaultStudentId={studentId || ""}
          defaultCaller="PARENT_TO_SCHOOL"
          busNumbers={busNumbers}
          canApplyToday={
            session.role === "COORDINATOR" || session.role === "ADMINISTRATOR"
          }
          students={students.map((student) => ({
            id: student.id,
            firstName: student.firstName,
            lastName: student.lastName,
            studentId: student.studentId,
            grade: student.grade,
          }))}
        />
      </section>

      <section className="space-y-3">
        {requests.map((request) => (
          <article key={request.id} className="rounded-2xl border border-line bg-card p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="font-semibold">{request.title}</h2>
                <p className="text-sm text-muted">
                  {request.createdBy.name} · {roleLabel(request.source)} ·{" "}
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
