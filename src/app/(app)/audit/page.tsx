import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatDateTime } from "@/lib/dates";

export default async function AuditPage() {
  const session = await getSession();
  if (!session) return null;
  const logs = await prisma.auditLog.findMany({
    where: { schoolId: session.schoolId },
    include: { actor: true, approvedBy: true, student: true },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-serif text-4xl">Audit history</h1>
        <p className="mt-1 text-muted">
          Old assignment, new assignment, who changed it, when, whether it was
          temporary or permanent, and who approved it. History is never deleted.
        </p>
      </div>
      <div className="overflow-hidden rounded-2xl border border-line bg-card">
        <table className="w-full text-left text-sm">
          <thead className="bg-paper text-muted">
            <tr>
              <th className="px-4 py-3">When</th>
              <th>Student</th>
              <th>Who</th>
              <th>Action</th>
              <th>Duration</th>
              <th>Old</th>
              <th>New</th>
              <th>Approved by</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((log) => (
              <tr key={log.id} className="border-t border-line align-top">
                <td className="px-4 py-2 whitespace-nowrap">{formatDateTime(log.createdAt)}</td>
                <td>
                  {log.student
                    ? `${log.student.firstName} ${log.student.lastName}`
                    : "—"}
                </td>
                <td>{log.actor.name}</td>
                <td>{log.action}</td>
                <td>{log.durationType ?? "—"}</td>
                <td className="max-w-xs break-all text-muted">{log.oldPlan}</td>
                <td className="max-w-xs break-all">{log.newPlan}</td>
                <td>{log.approvedBy?.name ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
