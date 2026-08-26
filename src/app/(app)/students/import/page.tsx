import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { ImportForm } from "./ImportForm";

export default async function ImportPage() {
  const session = await getSession();
  if (!session || (session.role !== "COORDINATOR" && session.role !== "ADMINISTRATOR")) {
    redirect("/students");
  }
  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="font-serif text-4xl">Upload students</h1>
        <p className="mt-2 text-muted">
          Choose an Excel or CSV file. Required columns: student_id, first_name,
          last_name. Add am_bus and pm_bus to create bus routes.
        </p>
      </div>
      <ImportForm />
      <a
        href="/sample-import.csv"
        className="inline-block text-sm font-semibold text-blue"
      >
        Download sample CSV
      </a>
    </div>
  );
}
