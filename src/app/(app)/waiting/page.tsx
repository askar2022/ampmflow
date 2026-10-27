import Link from "next/link";
import { getSession } from "@/lib/auth";
import { defaultBusCompanyEmail } from "@/lib/ops-change-emails";
import { prisma } from "@/lib/prisma";
import { RouteRequestForm } from "./RouteRequestForm";

export default async function WaitingPage() {
  const session = await getSession();
  if (!session) return null;
  const busCompanyEmail = await defaultBusCompanyEmail(session.schoolId);
  const pending = await prisma.changeRequest.findMany({
    where: {
      schoolId: session.schoolId,
      status: "PENDING",
      title: { contains: "Request for route" },
    },
    include: {
      student: {
        select: { id: true, firstName: true, lastName: true, grade: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-4xl">Request for Route</h1>
        <p className="mt-2 max-w-2xl text-muted">
          Submit a student to the bus company. The parent is emailed now. The
          student stays on this list until the company emails or calls with a
          bus or van, then Front Desk enters it.
        </p>
      </div>

      <RouteRequestForm busCompanyEmail={busCompanyEmail} />

      <section>
        <h2 className="font-serif text-2xl">Waiting for a bus or van</h2>
        {pending.length ? (
          <div className="mt-3 overflow-hidden rounded-2xl border border-line bg-card">
            <table className="w-full text-left text-sm">
              <thead className="bg-paper text-muted">
                <tr>
                  <th className="px-4 py-3">Student</th>
                  <th>Details</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {pending.map((row) => (
                  <tr key={row.id} className="row-red border-t border-line">
                    <td className="px-4 py-3 font-medium">
                      {row.student
                        ? `${row.student.firstName} ${row.student.lastName}`
                        : row.title}
                      {row.student ? (
                        <div className="text-xs text-muted">
                          Grade {row.student.grade}
                        </div>
                      ) : null}
                    </td>
                    <td className="max-w-md text-muted">{row.details}</td>
                    <td className="px-4">
                      {row.studentId ? (
                        <Link
                          href={`/dashboard?student=${row.studentId}`}
                          className="font-semibold text-blue"
                        >
                          Assign bus
                        </Link>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="mt-3 rounded-2xl border border-line bg-card px-4 py-6 text-sm text-muted">
            No submitted requests yet.
          </p>
        )}
      </section>
    </div>
  );
}
