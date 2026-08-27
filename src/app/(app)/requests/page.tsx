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
  const pendingRides = uniqueChangeRequests(
    await prisma.changeRequest.findMany({
      where: { schoolId: session.schoolId, status: "PENDING" },
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
  const canReview =
    session.role === "COORDINATOR" || session.role === "ADMINISTRATOR";

  return (
    <div className="space-y-8">
      <section className="rounded-2xl border border-line bg-card p-6 md:p-8">
        <h1 className="font-serif text-4xl">Change requests</h1>
        <p className="mt-2 max-w-3xl text-sm text-muted">
          Today’s ride: bus to parent pickup, or bus to a different bus. Report
          to the bus company: moving / new address, daycare, or parent pickup to
          bus. That student goes to Waiting for Route.
        </p>
        <TodayChangeForm
          defaultStudentId={studentId || ""}
          defaultCaller="PARENT_TO_SCHOOL"
          busNumbers={busNumbers}
          canApplyToday={canReview}
          students={students.map((student) => ({
            id: student.id,
            firstName: student.firstName,
            lastName: student.lastName,
            studentId: student.studentId,
            grade: student.grade,
          }))}
        />
      </section>

      {canReview && pendingRides.length ? (
        <section className="space-y-3">
          <h2 className="font-serif text-2xl">Needs your review</h2>
          {pendingRides.map((request) => (
            <article
              key={request.id}
              className="rounded-2xl border border-line bg-card p-5"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-semibold">{request.title}</h3>
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
                  {request.student.firstName} {request.student.lastName} ·{" "}
                  {request.trip}
                </p>
              ) : null}
              <RequestReviewButtons requestId={request.id} />
            </article>
          ))}
        </section>
      ) : null}
    </div>
  );
}
