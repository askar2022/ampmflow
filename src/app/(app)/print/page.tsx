import { Suspense } from "react";
import { getSession } from "@/lib/auth";
import { loadPrintDriverLists } from "@/lib/ridership";
import { DriverLists } from "./DriverLists";

export const dynamic = "force-dynamic";

async function SchoolPrintLists({ schoolId }: { schoolId: string }) {
  const lists = await loadPrintDriverLists(schoolId);
  return (
    <DriverLists
      riders={lists.riders}
      buses={lists.buses}
      vans={lists.vans}
      busDrivers={lists.busDrivers}
      aimSchool={lists.aimSchool}
    />
  );
}

export default async function PrintPage() {
  const session = await getSession();
  if (!session) return null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-4xl text-navy">Print list</h1>
        <p className="mt-2 max-w-3xl text-muted">
          Print for drivers in case they do not have the student roster from the
          bus company.
        </p>
      </div>

      <Suspense
        fallback={
          <div className="h-64 animate-pulse rounded-2xl border border-line bg-card" />
        }
      >
        <SchoolPrintLists schoolId={session.schoolId} />
      </Suspense>
    </div>
  );
}
