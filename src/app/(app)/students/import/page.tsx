import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { ImportForm } from "./ImportForm";
import { ImportPreviewForm } from "./ImportPreview";

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
          Preview returning and new-application files together first. Existing
          students are not overwritten unless you confirm. Columns can include
          ID, Student, Grade, Teacher, Parent, Phone, Address, City, ZIP, AM,
          and PM.
        </p>
      </div>
      <ImportPreviewForm />
      <div>
        <h2 className="font-serif text-2xl">Quick single-file upload</h2>
        <p className="mt-1 text-sm text-muted">
          Use this only for one file. Check the overwrite box if you intend to
          update students already in the system.
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
