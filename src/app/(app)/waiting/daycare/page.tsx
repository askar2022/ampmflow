import { getSession } from "@/lib/auth";
import { StudentChangeRequestForm } from "../StudentChangeRequestForm";

export const dynamic = "force-dynamic";

export default async function WaitingDaycarePage({
  searchParams,
}: {
  searchParams: Promise<{ student?: string }>;
}) {
  const session = await getSession();
  if (!session) return null;
  const { student: startStudentId = "" } = await searchParams;

  return (
    <StudentChangeRequestForm
      kind="daycare"
      students={[]}
      loadRemote
      initialStudentId={startStudentId}
      canPermanent={
        session.role === "ADMINISTRATOR" || session.role === "COORDINATOR"
      }
    />
  );
}
