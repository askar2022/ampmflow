import { prisma } from "./prisma";
import type { PlanSnapshot, SessionUser } from "./types";

export async function writeAudit(args: {
  user: SessionUser;
  studentId?: string | null;
  action: string;
  trip?: string | null;
  durationType?: string | null;
  oldPlan?: PlanSnapshot | Record<string, unknown> | null;
  newPlan?: PlanSnapshot | Record<string, unknown> | null;
  approvedById?: string | null;
}) {
  return prisma.auditLog.create({
    data: {
      schoolId: args.user.schoolId,
      studentId: args.studentId ?? null,
      actorId: args.user.id,
      approvedById: args.approvedById ?? args.user.id,
      action: args.action,
      trip: args.trip ?? null,
      durationType: args.durationType ?? null,
      oldPlan: JSON.stringify(args.oldPlan ?? {}),
      newPlan: JSON.stringify(args.newPlan ?? {}),
    },
  });
}

export async function notifyCoordinators(
  schoolId: string,
  title: string,
  body: string,
) {
  const coordinators = await prisma.user.findMany({
    where: {
      schoolId,
      active: true,
      role: { in: ["COORDINATOR", "ADMINISTRATOR"] },
    },
  });
  if (!coordinators.length) return;
  await prisma.notification.createMany({
    data: coordinators.map((user) => ({
      schoolId,
      userId: user.id,
      title,
      body,
    })),
  });
}
