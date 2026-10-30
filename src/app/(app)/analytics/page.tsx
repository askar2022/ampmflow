import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { loadCoordinatorAnalytics } from "@/lib/analytics";
import { AnalyticsBoard } from "./AnalyticsBoard";
import { FridayTestEmail } from "./FridayTestEmail";

export default async function AnalyticsPage() {
  const session = await getSession();
  if (!session) return null;
  if (session.role !== "ADMINISTRATOR" && session.role !== "COORDINATOR") {
    redirect("/dashboard");
  }

  const data = await loadCoordinatorAnalytics(session.schoolId);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-4xl">Analytics</h1>
        <p className="mt-2 max-w-2xl text-muted">
          A short picture for the bus coordinator: how many students, buses, and
          vans are on file, and how often staff change a bus or request a new
          route. Leadership also gets this Friday at 12:00 p.m. Minnesota
          time — next Friday, one email per school.
        </p>
      </div>
      <FridayTestEmail email={session.email} />
      <AnalyticsBoard data={data} />
    </div>
  );
}
