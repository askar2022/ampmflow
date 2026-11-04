import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { loadVehicles } from "@/lib/gate";
import { schoolLocalTime, todayKey } from "@/lib/dates";
import { loadCompanySchools } from "@/lib/company-access";
import { loadFrontDeskChangesToday } from "@/lib/transportation";
import { CompanyBoard, type CompanyRequest } from "./CompanyBoard";

function gradeOnly(grade: string) {
  return String(grade).replace(/^grade\s+/i, "") || "—";
}

export default async function CompanyPage({
  searchParams,
}: {
  searchParams: Promise<{ school?: string }>;
}) {
  const session = await getSession();
  if (!session) return null;
  if (session.role !== "BUS_COMPANY") redirect("/changes");

  const { school: wanted } = await searchParams;
  const schools = await loadCompanySchools(session);
  const selected =
    schools.find((school) => school.id === wanted || school.slug === wanted) ||
    schools[0];
  if (!selected) {
    return (
      <div>
        <h1 className="font-serif text-4xl text-navy">Today’s Changes</h1>
        <p className="mt-2 text-muted">
          No school is assigned to this login yet. Ask AMPM Flow to add the
          schools you serve.
        </p>
      </div>
    );
  }

  const [changes, vehicles, routes] = await Promise.all([
    loadFrontDeskChangesToday(selected.id),
    loadVehicles(selected.id).catch(() => []),
    prisma.busRoute.findMany({
      where: { schoolId: selected.id },
      select: { number: true },
      orderBy: { number: "asc" },
    }),
  ]);

  const completed = await prisma.changeRequest.findMany({
    where: {
      schoolId: selected.id,
      status: "COMPLETED",
      studentId: { in: changes.map((student) => student.id) },
      busNumber: { not: null },
    },
    select: { studentId: true, reviewedAt: true, updatedAt: true },
  });
  const day = todayKey();
  const assignedIds = new Set(
    completed
      .filter((row) =>
        schoolLocalTime(row.reviewedAt || row.updatedAt).dateKey === day,
      )
      .map((row) => row.studentId)
      .filter(Boolean),
  );

  const vans = vehicles
    .filter(
      (vehicle) =>
        vehicle.vehicleType.toUpperCase() === "VAN" || /van/i.test(vehicle.name),
    )
    .map((vehicle) => ({ id: vehicle.id, name: vehicle.name }));

  const rows: CompanyRequest[] = changes.map((student) => ({
    studentId: student.id,
    name: student.fullName,
    grade: gradeOnly(student.grade),
    teacher: student.teacherName || "—",
    parent:
      student.parentName && student.parentName !== "—"
        ? student.parentName
        : "—",
    trips: [
      ...(student.am.waitingForAssignment || !student.am.busNumber
        ? (["AM"] as const)
        : []),
      ...(student.pm.waitingForAssignment || !student.pm.busNumber
        ? (["PM"] as const)
        : []),
    ],
    changed: assignedIds.has(student.id),
  }));

  return (
    <CompanyBoard
      schools={schools}
      schoolId={selected.id}
      schoolName={selected.name}
      buses={[...new Set(routes.map((route) => route.number))]}
      vans={vans}
      rows={rows}
    />
  );
}
