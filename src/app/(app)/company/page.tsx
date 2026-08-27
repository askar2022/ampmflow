import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { loadStudents } from "@/lib/transportation";
import { companyReportText, missingList } from "@/lib/reports";
import { planSummary } from "@/lib/format";
import {
  assignBusFromCompany,
  collapseDuplicateRequests,
  reviewRequest,
} from "@/app/actions/requests";
import { CompanyActions } from "./CompanyActions";
import { TodayChangeForm } from "@/components/TodayChangeForm";

export default async function CompanyPage() {
  const session = await getSession();
  if (!session) return null;
  await collapseDuplicateRequests(session.schoolId);
  const students = await loadStudents(session.schoolId);
  const waiting = missingList(students).filter(
    (s) =>
      s.am.waitingForAssignment ||
      s.pm.waitingForAssignment ||
      (s.am.type === "BUS" && !s.am.busNumber) ||
      (s.pm.type === "BUS" && !s.pm.busNumber),
  );
  const requests = await prisma.changeRequest.findMany({
    where: {
      schoolId: session.schoolId,
      source: { in: ["BUS_COMPANY", "COORDINATOR", "FRONT_DESK"] },
    },
    include: { student: true, createdBy: true },
    orderBy: { createdAt: "desc" },
    take: 30,
  });
  const report = companyReportText(students);
  const limited = session.role === "BUS_COMPANY";
  const routes = await prisma.busRoute.findMany({
    where: { schoolId: session.schoolId },
    orderBy: { number: "asc" },
    select: { number: true },
  });
  const busNumbers = [...new Set(routes.map((route) => route.number))];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-4xl">
          {limited ? "Transportation queue" : "Bus Company Updates"}
        </h1>
        <p className="mt-2 max-w-2xl text-muted">
          {limited
            ? "Record a parent call to the company, or send a today-only change to the school. Proposed bus numbers are not final until Admin or the Bus Coordinator approves them."
            : "Record a parent or company request. That save does not send email. Print the report at the bottom if you need a copy."}
        </p>
      </div>

      <section className="rounded-2xl border border-line bg-card p-5">
        <h2 className="font-serif text-2xl">Change request</h2>
        <p className="mt-1 text-sm text-muted">
          Today’s ride can be applied by the school. Moving / new address,
          daycare change, and parent pickup to bus are reported to the bus
          company. The school does not assign that new bus.
        </p>
        <TodayChangeForm
          defaultCaller={limited ? "PARENT_TO_COMPANY" : "COMPANY_TO_SCHOOL"}
          busNumbers={busNumbers}
          canApplyToday={!limited}
          students={students.map((student) => ({
            id: student.id,
            firstName: student.firstName,
            lastName: student.lastName,
            studentId: student.studentId,
            grade: student.grade,
          }))}
        />
      </section>

      <section className="rounded-2xl border border-line bg-card p-5">
        <h2 className="font-serif text-2xl">Students waiting for a bus</h2>
        <table className="mt-3 w-full text-left text-sm">
          <thead className="text-muted">
            <tr>
              <th className="py-2">Student</th>
              <th>Grade</th>
              <th>AM</th>
              <th>PM</th>
              <th>Address</th>
            </tr>
          </thead>
          <tbody>
            {waiting.map((student) => (
              <tr key={student.id} className="border-t border-line">
                <td className="py-2 font-medium">{student.fullName}</td>
                <td>{student.grade}</td>
                <td>{planSummary(student.am, "AM")}</td>
                <td>{planSummary(student.pm, "PM")}</td>
                <td>{student.homeAddress}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="rounded-2xl border border-line bg-card p-5">
        <h2 className="font-serif text-2xl">Requests</h2>
        <ul className="mt-3 space-y-3">
          {requests.map((request) => (
            <li key={request.id} className="rounded-xl border border-line p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <strong>{request.title}</strong>
                <span className="text-xs uppercase tracking-wider text-muted">
                  {request.status}
                </span>
              </div>
              <p className="mt-1 text-sm text-muted">{request.details}</p>
              {request.student ? (
                <p className="text-sm">
                  {request.student.firstName} {request.student.lastName}
                </p>
              ) : null}
              {limited && request.status !== "COMPLETED" ? (
                <form action={assignBusFromCompany} className="mt-3 flex flex-wrap gap-2">
                  <input type="hidden" name="requestId" value={request.id} />
                  <input
                    name="busNumber"
                    placeholder="Bus number"
                    className="rounded-xl border border-line px-3 py-2"
                  />
                  <input
                    name="companyNote"
                    placeholder="Short note"
                    className="min-w-60 flex-1 rounded-xl border border-line px-3 py-2"
                  />
                  <button className="rounded-xl bg-navy px-3 py-2 text-sm font-semibold text-white">
                    Propose assignment
                  </button>
                </form>
              ) : null}
              {!limited && request.status === "PENDING" && request.busNumber ? (
                <form
                  action={async () => {
                    "use server";
                    await reviewRequest(request.id, "APPROVED");
                  }}
                  className="mt-3"
                >
                  <button className="rounded-xl bg-green px-3 py-2 text-sm font-semibold text-white">
                    Approve Bus {request.busNumber}
                  </button>
                </form>
              ) : null}
            </li>
          ))}
        </ul>
      </section>

      {!limited ? <CompanyActions preview={report} /> : null}
    </div>
  );
}
