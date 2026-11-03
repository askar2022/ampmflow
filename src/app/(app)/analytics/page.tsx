import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { loadCoordinatorAnalytics } from "@/lib/analytics";
import { AnalyticsBoard } from "./AnalyticsBoard";

export default async function AnalyticsPage() {
  const session = await getSession();
  if (!session) return null;
  if (session.role !== "ADMINISTRATOR" && session.role !== "COORDINATOR") {
    redirect("/dashboard");
  }

  const data = await loadCoordinatorAnalytics(session.schoolId);

  return (
    <div>
      <h1 className="sr-only">Analytics</h1>
      <AnalyticsBoard data={data} />
    </div>
  );
}
