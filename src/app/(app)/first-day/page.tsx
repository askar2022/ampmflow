import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { formatLongDate, formatTime, schoolNow } from "@/lib/dates";
import {
  gateCounts,
  lastUpdatedStamp,
  loadGateRoster,
  loadImportSummary,
} from "@/lib/gate";
import { getSchoolIdentityById } from "@/lib/school";
import { prisma } from "@/lib/prisma";
import { FirstDayDashboard } from "./FirstDayDashboard";

export const dynamic = "force-dynamic";

export default async function FirstDayPage() {
  const session = await getSession();
  if (
    !session ||
    (session.role !== "ADMINISTRATOR" &&
      session.role !== "COORDINATOR" &&
      session.role !== "FRONT_DESK")
  ) {
    redirect("/dashboard");
  }

  const [students, importSummary, school] = await Promise.all([
    loadGateRoster(session.schoolId),
    loadImportSummary(session.schoolId),
    getSchoolIdentityById(session.schoolId),
  ]);
  const wakandaCount = students.length
    ? await prisma.student
        .count({
          where: {
            id: { in: students.map((student) => student.id) },
            OR: [
              { notes: { contains: "Wakanda", mode: "insensitive" } },
              { classroom: { name: { contains: "Wakanda", mode: "insensitive" } } },
            ],
          },
        })
        .catch(() => 0)
    : 0;
  const counts = gateCounts(students);
  const now = schoolNow();

  return (
    <FirstDayDashboard
      schoolName={school?.name || "Sankofa Prep"}
      counts={counts}
      lastUpdated={lastUpdatedStamp(students)}
      dateLabel={formatLongDate(now)}
      clock={formatTime(now)}
      importSummary={importSummary}
      students={students}
      wakandaCount={wakandaCount}
    />
  );
}
