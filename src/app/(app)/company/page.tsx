import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { loadStudents } from "@/lib/transportation";
import { companyReportText, missingList } from "@/lib/reports";
import { planSummary } from "@/lib/format";
import { assignBusFromCompany, reviewRequest } from "@/app/actions/requests";
import { CompanyActions } from "./CompanyActions";

export default async function CompanyPage() {
  const session = await getSession();
  if (!session) return null;
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-4xl">
          {limited ? "Transportation queue" : "Bus Company Updates"}
        </h1>
        <p className="mt-2 max-w-2xl text-muted">
          {limited
            ? "You only see students who need a transportation assignment. Proposed bus numbers are not final until the coordinator approves them."
            : "For the first version, email a clean change report to the company. Direct company login can assign a number, but you still approve it."}
        </p>
      </div>

      {!limited ? <CompanyActions preview={report} /> : null}

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
    </div>
  );
}
