import { getSession } from "@/lib/auth";
import { loadCheckIns } from "@/lib/operations";
import { LiveRefresh } from "@/components/LiveRefresh";
import { CheckInBoard } from "./CheckInBoard";

export default async function CheckInPage({
  searchParams,
}: {
  searchParams: Promise<{ bus?: string }>;
}) {
  const session = await getSession();
  if (!session) return null;
  const { bus } = await searchParams;
  const busNumber = session.assignedBus || bus || "4";
  const rows = await loadCheckIns(session.schoolId, busNumber);

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <div>
        <h1 className="font-serif text-3xl">Bus assistant roster</h1>
        <p className="mt-1 text-sm text-muted">
          Confirm each child before the bus leaves. You cannot change the official
          assignment. Use Wrong Assignment if the list does not match the child.
        </p>
        <LiveRefresh />
      </div>
      <CheckInBoard busNumber={busNumber} rows={rows} />
    </div>
  );
}
