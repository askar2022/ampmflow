import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { formatLongDate, schoolNow, todayKey } from "@/lib/dates";
import {
  lastUpdatedStamp,
  loadGateRoster,
  loadGradeConfirm,
  schoolGrades,
} from "@/lib/gate";
import { GradeDismissalBoard } from "./GradeDismissalBoard";

export const dynamic = "force-dynamic";

export default async function DismissalGradePage({
  searchParams,
}: {
  searchParams: Promise<{ grade?: string }>;
}) {
  const session = await getSession();
  if (
    !session ||
    (session.role !== "ADMINISTRATOR" &&
      session.role !== "COORDINATOR" &&
      session.role !== "FRONT_DESK")
  ) {
    redirect("/dashboard");
  }

  const params = await searchParams;
  const students = await loadGateRoster(session.schoolId);
  const grades = schoolGrades(students);
  const selectedGrade =
    grades.find((grade) => grade === params.grade) || grades[0] || "Kindergarten";
  const confirm = await loadGradeConfirm(
    session.schoolId,
    todayKey(),
    selectedGrade,
  );

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-muted">{formatLongDate(schoolNow())}</p>
        <h1 className="font-serif text-4xl">Dismissal by Grade/Class</h1>
        <p className="mt-2 max-w-3xl text-muted">
          Only the selected grade is shown. The active dismissal list includes
          students who physically arrived. Email sends this grade only.
        </p>
      </div>
      <GradeDismissalBoard
        grades={grades}
        selectedGrade={selectedGrade}
        students={students}
        confirmStatus={confirm.status}
        lastUpdated={lastUpdatedStamp(students)}
      />
    </div>
  );
}
