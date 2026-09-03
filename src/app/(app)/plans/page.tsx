import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { loadStudents } from "@/lib/transportation";
import { ensureStarterBuses, listBusNumbers } from "@/app/actions/plans";
import { PlanBoard } from "./PlanBoard";

export const dynamic = "force-dynamic";

export default async function PlansPage() {
  const session = await getSession();
  if (!session || (session.role !== "ADMINISTRATOR" && session.role !== "COORDINATOR")) {
    redirect("/students");
  }

  await ensureStarterBuses();
  const [students, listed] = await Promise.all([
    loadStudents(session.schoolId),
    listBusNumbers(session.schoolId),
  ]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-serif text-4xl">AM & PM Plans</h1>
        <p className="mt-2 max-w-3xl text-muted">
          Morning and afternoon can be different. Set each trip as parent from
          home, bus from or to home, or bus from or to daycare. The Gate is
          still only for today’s check-in. This page is the regular bus and
          pickup list.
        </p>
      </div>
      <PlanBoard students={students} busNumbers={listed.numbers} />
    </div>
  );
}
