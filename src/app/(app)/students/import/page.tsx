import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { ImportForm } from "./ImportForm";
import { ImportPreviewForm } from "./ImportPreview";

export const maxDuration = 60;

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
          Use the Sankofa Family Master Excel file. Leave overwrite unchecked
          unless you mean to change names already on the list. The file loads
          in small groups so the full school list can finish. Stay on this
          page until you see “Finished.” Do not run any reset SQL.
        </p>
      </div>
      <div>
        <h2 className="font-serif text-2xl">Load the family master</h2>
        <p className="mt-1 text-sm text-muted">
          Choose Sankofa_Family_Master and click Load all students. About 12
          Not Returning rows are left out on purpose. The Gate should then
          show about 103 students.
        </p>
      </div>
      <ImportForm />
      <ImportPreviewForm />
      <a
        href="/sample-import.csv"
        className="inline-block text-sm font-semibold text-blue"
      >
        Download sample CSV
      </a>
    </div>
  );
}
