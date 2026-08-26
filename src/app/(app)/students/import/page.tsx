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
        <h1 className="font-serif text-4xl">Student import</h1>
        <p className="mt-2 text-muted">
          Upload an Excel or CSV file. Required columns:{" "}
          <code>student_id</code>, <code>first_name</code>, <code>last_name</code>.
          Optional columns include grade, teacher, classroom, parent_name,
          parent_phone, home_address, daycare_name, am_type, am_bus, pm_type,
          and pm_bus.
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
