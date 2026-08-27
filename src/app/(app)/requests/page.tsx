import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { collapseDuplicateRequests } from "@/app/actions/requests";
import { formatDateTime } from "@/lib/dates";
import { roleLabel } from "@/lib/format";
import { isCompanyReport, uniqueChangeRequests } from "@/lib/request-dedupe";
import { TodayChangeForm } from "@/components/TodayChangeForm";
import { RequestReviewButtons } from "./RequestReviewButtons";

export default async function RequestsPage({
  searchParams,
}: {
  searchParams: Promise<{ studentId?: string }>;
}) {
  const session = await getSession();
  if (!session) return null;
  await collapseDuplicateRequests(session.schoolId);
  const { studentId } = await searchParams;
  const requests = uniqueChangeRequests(
    await prisma.changeRequest.findMany({
      where: { schoolId: session.schoolId, status: { not: "REJECTED" } },
      include: { student: true, createdBy: true, reviewedBy: true },
      orderBy: { createdAt: "desc" },
    }),
  ).filter((request) => !isCompanyReport(request));
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
      <section className="overflow-hidden rounded-2xl border border-line bg-card p-6">
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

      <section className="relative z-20 space-y-3">
        <p className="text-sm text-muted">
          Today’s ride cards stay here. A move or new address is saved to Bus
          Company and Waiting for Route, not this list.
        </p>
        {requests.length === 0 ? (
          <p className="rounded-2xl border border-line bg-card p-5 text-sm text-muted">
            No today’s-ride requests on this list.
          </p>
        ) : null}
        {requests.map((request) => {
          const needsApprove =
            request.status === "PENDING" &&
            (session.role === "COORDINATOR" || session.role === "ADMINISTRATOR");

          return (
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
            {needsApprove ? (
              <RequestReviewButtons requestId={request.id} />
            ) : null}
          </article>
          );
        })}
      </section>
    </div>
  );
}
