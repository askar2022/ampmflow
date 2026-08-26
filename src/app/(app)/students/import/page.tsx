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
          Click <strong>Choose file</strong>, pick your Excel or CSV, then click{" "}
          <strong>Upload file</strong>. Columns can be ID, Student, Grade,
          Teacher, Room, AM, and PM.
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
