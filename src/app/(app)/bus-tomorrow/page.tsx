import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { formatLongDate, schoolNow, todayKey } from "@/lib/dates";
import { busTomorrowFamilies, loadGateRoster } from "@/lib/gate";
import { BusTomorrowBoard } from "./BusTomorrowBoard";

export const dynamic = "force-dynamic";

export default async function BusTomorrowPage() {
  const session = await getSession();
  if (
    !session ||
    (session.role !== "ADMINISTRATOR" &&
      session.role !== "COORDINATOR" &&
      session.role !== "FRONT_DESK")
  ) {
    redirect("/dashboard");
  }

  const students = await loadGateRoster(session.schoolId);
  const families = busTomorrowFamilies(students);

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-muted">{formatLongDate(schoolNow())}</p>
        <h1 className="font-serif text-4xl">Bus Needed Tomorrow</h1>
        <p className="mt-2 max-w-3xl text-muted">
          {families.length} families ·{" "}
          {families.reduce((n, f) => n + f.students.length, 0)} students. A
          printed driver report includes only the families you select.
        </p>
      </div>
      <BusTomorrowBoard students={students} date={todayKey()} />
    </div>
  );
}
