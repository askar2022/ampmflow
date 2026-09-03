import Link from "next/link";
import { notFound } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { loadStudent } from "@/lib/transportation";
import { formatDateTime } from "@/lib/dates";
import { destinationLabel, durationLabel, planSummary, planTone, typeLabel } from "@/lib/format";
import { StatusBadge } from "@/components/StatusBadge";
import { UndoLastChangeButton } from "./UndoLastChangeButton";
import { ParentChangeButton } from "@/components/ParentChangeCard";
import { listBusNumbers } from "@/app/actions/plans";
import {
  AM_LABEL,
  ENROLL_LABEL,
  FOLLOW_LABEL,
  PM_LABEL,
  familyGroupKey,
  loadGateHistory,
  loadGateRoster,
} from "@/lib/gate";

export default async function StudentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSession();
  if (!session) return null;
  const { id } = await params;
  const loaded = await loadStudent(id);
  if (!loaded) notFound();
  const { effective: student, record } = loaded;

  const audits = await prisma.auditLog.findMany({
    where: { studentId: id },
    include: { actor: true, approvedBy: true },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  const [gateHistory, roster, listed] = await Promise.all([
    loadGateHistory(session.schoolId, id),
    loadGateRoster(session.schoolId),
    listBusNumbers(session.schoolId),
  ]);
  const gateStudent = roster.find((row) => row.id === id);
  const siblings = roster.filter(
    (row) =>
      Boolean(gateStudent) &&
      familyGroupKey(row) === familyGroupKey(gateStudent!),
  );

  const canUndo = audits.some(
    (log) => log.action === "UPDATE_PERMANENT" || log.action === "CREATE_TEMPORARY",
  );

  return (
    <div className="space-y-8">
      <Link href="/students" className="inline-block text-sm font-medium text-navy underline">
        ← Back to students
      </Link>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm text-muted">{student.studentId}</p>
          <h1 className="font-serif text-4xl">{student.fullName}</h1>
          <p className="mt-1 text-muted">
            Grade {student.grade} · {student.teacherName} · {student.classroomName}
          </p>
        </div>
        <div className="flex flex-wrap items-start gap-2">
          {session.role === "COORDINATOR" ||
          session.role === "ADMINISTRATOR" ||
          session.role === "FRONT_DESK" ? (
            <>
              <ParentChangeButton
                student={student}
                buses={listed.numbers}
                allowPermanent={
                  session.role === "COORDINATOR" ||
                  session.role === "ADMINISTRATOR"
                }
              />
              <Link
                href={`/students/${id}/update`}
                className="rounded-full bg-navy px-4 py-2 text-sm font-semibold text-white"
              >
                Full form
              </Link>
            </>
          ) : null}
          {(session.role === "COORDINATOR" || session.role === "ADMINISTRATOR") &&
          canUndo ? (
            <UndoLastChangeButton studentId={id} />
          ) : null}
        </div>
      </div>

      <section className="grid gap-4 md:grid-cols-2">
        {[student.am, student.pm].map((plan) => (
          <div key={plan.trip} className="rounded-2xl border border-line bg-card p-5">
            <div className="flex items-center justify-between">
              <h2 className="font-serif text-2xl">{plan.trip} transportation</h2>
              <StatusBadge tone={planTone(plan)} />
            </div>
            <dl className="mt-4 space-y-2 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-muted">Today’s plan</dt>
                <dd className="font-medium">{planSummary(plan, plan.trip)}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted">Type</dt>
                <dd>{typeLabel(plan.type, plan.trip)}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted">Destination</dt>
                <dd>{destinationLabel(plan.destination)}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted">Bus number</dt>
                <dd>{plan.busNumber ?? (plan.waitingForAssignment ? "Waiting for company" : "—")}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted">Status</dt>
                <dd>
                  {plan.source === "PERMANENT"
                    ? "Permanent"
                    : plan.source === "MISSING"
                      ? "Missing"
                      : durationLabel(plan.source)}
                </dd>
              </div>
            </dl>
          </div>
        ))}
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-line bg-card p-5">
          <h2 className="font-serif text-2xl">Family & destinations</h2>
          <dl className="mt-4 space-y-2 text-sm">
            <Row label="Family ID" value={gateStudent?.familyKey || "—"} />
            <Row
              label="Enrollment"
              value={
                gateStudent
                  ? ENROLL_LABEL[gateStudent.enrollmentSource]
                  : "—"
              }
            />
            <Row
              label="Siblings"
              value={
                siblings.length
                  ? siblings.map((row) => row.fullName).join(", ")
                  : "None grouped"
              }
            />
            <Row
              label="Assigned Vehicle/Route"
              value={
                gateStudent
                  ? `${gateStudent.vehicleName}${
                      gateStudent.driverName
                        ? ` · ${gateStudent.driverName} ${gateStudent.driverPhone}`
                        : ""
                    }`
                  : "Not Assigned"
              }
            />
            <Row label="Parent" value={`${student.parentName} · ${student.parentPhone}`} />
            <Row label="Home address" value={student.homeAddress} />
            <Row label="Daycare" value={student.daycareName ? `${student.daycareName} — ${student.daycareAddress}` : "None on file"} />
            <Row label="Notes" value={student.notes || "—"} />
            <Row
              label="Last updated"
              value={
                student.lastUpdatedAt
                  ? `${student.lastUpdatedBy} · ${formatDateTime(student.lastUpdatedAt)}`
                  : "—"
              }
            />
          </dl>
        </div>
        <div className="rounded-2xl border border-line bg-card p-5">
          <h2 className="font-serif text-2xl">Permanent assignments</h2>
          <p className="mt-1 text-sm text-muted">
            Temporary changes never overwrite these records. That is why Mohammed
            returns to Bus 4 tomorrow after today’s parent pickup.
          </p>
          <ul className="mt-4 space-y-2 text-sm">
            {record.assignments.map((item) => (
              <li key={item.id} className="rounded-xl bg-paper px-3 py-2">
                <strong>{item.trip}</strong> {item.type === "BUS" ? `Bus ${item.busRoute?.number ?? "pending"}` : "Parent"}{" "}
                · {item.destination.toLowerCase()}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {gateHistory.length ? (
        <section className="rounded-2xl border border-line bg-card p-5">
          <h2 className="font-serif text-2xl">Gate status history</h2>
          <p className="text-sm text-muted">
            Arrival and dismissal changes are never deleted.
          </p>
          <table className="mt-4 w-full text-left text-sm">
            <thead className="text-muted">
              <tr>
                <th className="py-2">When</th>
                <th>Staff</th>
                <th>Field</th>
                <th>Previous</th>
                <th>New</th>
              </tr>
            </thead>
            <tbody>
              {gateHistory.map((row, index) => (
                <tr key={`${row.createdAt}-${index}`} className="border-t border-line">
                  <td className="py-2 whitespace-nowrap">
                    {formatDateTime(row.createdAt)}
                  </td>
                  <td>{row.actorName}</td>
                  <td>{row.field}</td>
                  <td>{gateHistoryLabel(row.field, row.previous)}</td>
                  <td>{gateHistoryLabel(row.field, row.next)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ) : null}

      <section className="rounded-2xl border border-line bg-card p-5">
        <h2 className="font-serif text-2xl">Audit history</h2>
        <p className="text-sm text-muted">Transportation history is never deleted.</p>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-muted">
              <tr>
                <th className="py-2">When</th>
                <th>Who</th>
                <th>Action</th>
                <th>Old</th>
                <th>New</th>
                <th>Approved by</th>
              </tr>
            </thead>
            <tbody>
              {audits.map((log) => (
                <tr key={log.id} className="border-t border-line align-top">
                  <td className="py-2 whitespace-nowrap">{formatDateTime(log.createdAt)}</td>
                  <td>{log.actor.name}</td>
                  <td>
                    {log.action}
                    {log.durationType ? ` · ${log.durationType}` : ""}
                  </td>
                  <td className="max-w-xs text-muted">{log.oldPlan}</td>
                  <td className="max-w-xs">{log.newPlan}</td>
                  <td>{log.approvedBy?.name ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function gateHistoryLabel(field: string, value: string) {
  if (field === "amArrival") return AM_LABEL[value as keyof typeof AM_LABEL] || value;
  if (field === "amFollowUp") return FOLLOW_LABEL[value as keyof typeof FOLLOW_LABEL] || value;
  if (field === "pmDismissal") return PM_LABEL[value as keyof typeof PM_LABEL] || value;
  return value || "—";
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-muted">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}
